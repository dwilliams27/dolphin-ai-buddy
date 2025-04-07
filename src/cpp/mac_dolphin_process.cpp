#ifdef __APPLE__

#include "mac_dolphin_process.h"
#include "common_utils.h"
#include "memory_common.h"

#include <cstdlib>
#include <iostream>
#include <iomanip>
#include <mach/mach_vm.h>
#include <memory>
#include <string_view>
#include <sys/sysctl.h>
#include <sys/ptrace.h>

namespace DolphinComm
{
bool MacDolphinProcess::findPID()
{
  Common::UpdateMemoryValues();
  static const int mib[4] = {CTL_KERN, KERN_PROC, KERN_PROC_ALL, 0};

  size_t procSize = 0;
  if (sysctl((int*)mib, 4, NULL, &procSize, NULL, 0) == -1)
    return false;

  auto procs = std::make_unique<kinfo_proc[]>(procSize / sizeof(kinfo_proc));
  if (sysctl((int*)mib, 4, procs.get(), &procSize, NULL, 0) == -1)
    return false;

  static const char* const s_dolphinProcessName{std::getenv("DME_DOLPHIN_PROCESS_NAME")};

  m_PID = -1;
  for (int i = 0; i < procSize / sizeof(kinfo_proc); i++)
  {
    const std::string_view name{procs[i].kp_proc.p_comm};
    const bool match{s_dolphinProcessName ? name == s_dolphinProcessName :
                                            (name == "Dolphin" || name == "dolphin-emu")};
    if (match)
    {
      m_PID = procs[i].kp_proc.p_pid;
    }
  }

  if (m_PID == -1)
    return false;
  return true;
}

bool MacDolphinProcess::obtainEmuRAMInformation()
{
  if (ptrace(PT_ATTACH, m_PID, 0, 0) == 0) {
    int status;
    waitpid(m_PID, &status, 0);
    std::cout << "Successfully attached with ptrace\n";
    
    ptrace(PT_DETACH, m_PID, 0, 0);
  } else {
    std::cerr << "Failed to attach with ptrace: " << strerror(errno) << "; did you re-sign Dolphin and node? Could be a SIP issue\n";
    return false;
  }

  m_currentTask = mach_task_self(); // Use this explicitly instead of current_task()
  std::cout << "Current task: " << m_currentTask << "\n";
  
  // Try task_for_pid first, then fall back to task_name_for_pid if needed
  kern_return_t error = task_for_pid(m_currentTask, m_PID, &m_task);
  if (error != KERN_SUCCESS) {
    std::cout << "task_for_pid failed with code: " << error << "\n";
    std::cout << "Trying task_name_for_pid instead...\n";
    
    error = task_name_for_pid(m_currentTask, m_PID, &m_task);
    if (error != KERN_SUCCESS) {
      std::cout << "task_name_for_pid also failed with code: " << error << "\n";
      ptrace(PT_DETACH, m_PID, 0, 0);
      return false;
    }
  }
  
  std::cout << "Successfully got task port: " << m_task << "\n";
  
  mach_vm_address_t regionAddr = 0;
  mach_vm_size_t size = 0;
  vm_region_extended_info_data_t regInfo;
  vm_region_basic_info_data_64_t basInfo;
  vm_region_top_info_data_t topInfo;
  mach_msg_type_number_t cnt = VM_REGION_EXTENDED_INFO_COUNT;
  mach_port_t obj;
  bool MEM1Found = false;
  unsigned int MEM1Obj = 0;
  while (mach_vm_region(m_task, &regionAddr, &size, VM_REGION_EXTENDED_INFO, (int*)&regInfo, &cnt,
                        &obj) == KERN_SUCCESS)
  {
    cnt = VM_REGION_BASIC_INFO_COUNT_64;
    if (mach_vm_region(m_task, &regionAddr, &size, VM_REGION_BASIC_INFO_64, (int*)&basInfo, &cnt,
                       &obj) != KERN_SUCCESS)
      break;
    cnt = VM_REGION_TOP_INFO_COUNT;
    if (mach_vm_region(m_task, &regionAddr, &size, VM_REGION_TOP_INFO, (int*)&topInfo, &cnt,
                       &obj) != 0)
      break;

    if (!m_MEM2Present && size == Common::GetMEM2Size() &&
        basInfo.offset == Common::GetMEM1Size() + 0x40000)
    {
      m_MEM2Present = true;
      m_MEM2AddressStart = regionAddr;
    }

    // if these are true, then it is very likely the correct region, but we cannot guarantee
    if ((!MEM1Found || (MEM1Found && MEM1Obj == topInfo.obj_id)) && size == Common::GetMEM1Size() &&
        regInfo.share_mode == SM_TRUESHARED &&
        basInfo.max_protection == (VM_PROT_READ | VM_PROT_WRITE))
    {
      if (basInfo.offset == 0x0)
      {
        m_emuRAMAddressStart = regionAddr;
        MEM1Found = true;
      }
      else if (basInfo.offset == Common::GetMEM1Size() + 0x40000)
      {
        m_emuARAMAdressStart = regionAddr;
        m_ARAMAccessible = true;
      }

      MEM1Found = true;
      MEM1Obj = topInfo.obj_id;
    }

    regionAddr += size;
    cnt = VM_REGION_EXTENDED_INFO_COUNT;
  }

  if (m_MEM2Present)
  {
    m_emuARAMAdressStart = 0;
    m_ARAMAccessible = false;
  }

  if (m_emuRAMAddressStart != 0) {
    std::cout << "Found emulated RAM at address 0x" << std::hex << m_emuRAMAddressStart;
    if (m_MEM2Present) {
        std::cout << ", MEM2 at address 0x" << m_MEM2AddressStart;
    }
    std::cout << std::dec << "\n";
    return true;
  }
  if (m_emuARAMAdressStart != 0) {
    std::cout << "Got ARAM " << std::hex << m_emuARAMAdressStart << "\n";
  }
  std::cout << "Failed to find emulated RAM address\n";
  return false;
}

bool MacDolphinProcess::readAtOffset(mach_vm_address_t baseAddr, uint32_t offset, char* buffer, size_t size)
{
  vm_size_t bytesRead;
  kern_return_t result = vm_read_overwrite(m_task, baseAddr + offset, size, 
                                         (vm_address_t)buffer, &bytesRead);

  if (result != KERN_SUCCESS) {
    return false;
  }
  return true;
}

bool MacDolphinProcess::readFromRAM(const u32 offset, char* buffer, size_t size,
                                    const bool withBSwap)
{
  vm_size_t nread;
  u64 RAMAddress = 0;
  if (m_ARAMAccessible)
  {
    if (offset >= Common::ARAM_FAKESIZE)
      RAMAddress = m_emuRAMAddressStart + offset - Common::ARAM_FAKESIZE;
    else
      RAMAddress = m_emuARAMAdressStart + offset;
  }
  else if (offset >= (Common::MEM2_START - Common::MEM1_START))
  {
    RAMAddress = m_MEM2AddressStart + offset - (Common::MEM2_START - Common::MEM1_START);
  }
  else
  {
    RAMAddress = m_emuRAMAddressStart + offset;
  }

  std::cout << "RAMAddress: " << RAMAddress << "\n";

  if (vm_read_overwrite(m_task, RAMAddress, size, reinterpret_cast<vm_address_t>(buffer), &nread) != KERN_SUCCESS) {
    std::cout << "Failed vm_read_overwrite\n";
    return false;
  }
  if (nread != size) {
    std::cout << "nread != size\n";
    return false;
  }

  if (withBSwap)
  {
    switch (size)
    {
    case 2:
    {
      u16 halfword = 0;
      std::memcpy(&halfword, buffer, sizeof(u16));
      halfword = Common::bSwap16(halfword);
      std::memcpy(buffer, &halfword, sizeof(u16));
      break;
    }
    case 4:
    {
      u32 word = 0;
      std::memcpy(&word, buffer, sizeof(u32));
      word = Common::bSwap32(word);
      std::memcpy(buffer, &word, sizeof(u32));
      break;
    }
    case 8:
    {
      u64 doubleword = 0;
      std::memcpy(&doubleword, buffer, sizeof(u64));
      doubleword = Common::bSwap64(doubleword);
      std::memcpy(buffer, &doubleword, sizeof(u64));
      break;
    }
    }
  }

  return true;
}

bool MacDolphinProcess::writeToRAM(const u32 offset, const char* buffer, const size_t size,
                                   const bool withBSwap)
{
  u64 RAMAddress = 0;
  if (m_ARAMAccessible)
  {
    if (offset >= Common::ARAM_FAKESIZE)
      RAMAddress = m_emuRAMAddressStart + offset - Common::ARAM_FAKESIZE;
    else
      RAMAddress = m_emuARAMAdressStart + offset;
  }
  else if (offset >= (Common::MEM2_START - Common::MEM1_START))
  {
    RAMAddress = m_MEM2AddressStart + offset - (Common::MEM2_START - Common::MEM1_START);
  }
  else
  {
    RAMAddress = m_emuRAMAddressStart + offset;
  }

  char* bufferCopy = new char[size];
  std::memcpy(bufferCopy, buffer, size);

  if (withBSwap)
  {
    switch (size)
    {
    case 2:
    {
      u16 halfword = 0;
      std::memcpy(&halfword, bufferCopy, sizeof(u16));
      halfword = Common::bSwap16(halfword);
      std::memcpy(bufferCopy, &halfword, sizeof(u16));
      break;
    }
    case 4:
    {
      u32 word = 0;
      std::memcpy(&word, bufferCopy, sizeof(u32));
      word = Common::bSwap32(word);
      std::memcpy(bufferCopy, &word, sizeof(u32));
      break;
    }
    case 8:
    {
      u64 doubleword = 0;
      std::memcpy(&doubleword, bufferCopy, sizeof(u64));
      doubleword = Common::bSwap64(doubleword);
      std::memcpy(bufferCopy, &doubleword, sizeof(u64));
      break;
    }
    }
  }

  if (vm_write(m_task, RAMAddress, reinterpret_cast<vm_offset_t>(bufferCopy), size) != KERN_SUCCESS)
  {
    delete[] bufferCopy;
    return false;
  }

  delete[] bufferCopy;
  return true;
}
}  // namespace DolphinComm
#endif
