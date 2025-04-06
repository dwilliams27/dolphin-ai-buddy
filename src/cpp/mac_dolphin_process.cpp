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
    
    // Make sure the process continues running
    ptrace(PT_CONTINUE, m_PID, (caddr_t)1, 0);
  } else {
    std::cerr << "Failed to attach with ptrace: " << strerror(errno) << "\n";
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
  
  // Try a simpler approach to get memory regions
  mach_vm_address_t regionAddr = 0;
  mach_vm_size_t size = 0;
  vm_region_basic_info_data_64_t info;
  mach_msg_type_number_t count = VM_REGION_BASIC_INFO_COUNT_64;
  mach_port_t object_name;
  
  std::cout << "Scanning memory regions with simplified approach:\n";
  int regionCount = 0;
  
  // Use basic info only at first to see if we can get any regions
  while (mach_vm_region(m_task, &regionAddr, &size, VM_REGION_BASIC_INFO_64, 
                        (vm_region_info_t)&info, &count, &object_name) == KERN_SUCCESS) {
    regionCount++;
    
    // Log only some regions to avoid excessive output
    if (regionCount % 100 == 0 || size > 0x1000000) {
      std::cout << "Region " << regionCount << ": addr=0x" << std::hex << regionAddr 
                << ", size=0x" << size 
                << ", protection=0x" << info.protection 
                << std::dec << "\n";
    }
    
    // Move to next region
    regionAddr += size;
    count = VM_REGION_BASIC_INFO_COUNT_64;
  }
  
  std::cout << "Total regions scanned: " << regionCount << "\n";

  // Clean up
  ptrace(PT_DETACH, m_PID, 0, 0);
  
  // For debugging purposes, return true if we found any regions at all
  return (regionCount > 0);
}

bool MacDolphinProcess::testMemoryRegions()
{
  // Try to read from potential memory regions
  const int numCandidates = 9;
  mach_vm_address_t candidates[numCandidates] = {
    0x11e800000, 0x126840000, 0x133800000, 0x161000000, 
    0x1ea000000, 0x1ebee4000, 0x22a72c000, 0x22cc88000, 0x282000000
  };
  
  std::cout << "Testing potential memory regions:\n";
  
  for (int i = 0; i < numCandidates; i++) {
    mach_vm_address_t addr = candidates[i];
    
    // Try to read 256 bytes from the region
    char buffer[256];
    vm_size_t bytesRead;
    kern_return_t result = vm_read_overwrite(m_task, addr, 256, 
                                           (vm_address_t)buffer, &bytesRead);
    
    if (result == KERN_SUCCESS) {
      std::cout << "Successfully read from region at 0x" << std::hex << addr << std::dec << "\n";
      
      // Print first 16 bytes in hex to examine the content
      std::cout << "First 16 bytes: ";
      for (int j = 0; j < 16; j++) {
        std::cout << std::hex << std::setw(2) << std::setfill('0') 
                  << (int)(unsigned char)buffer[j] << " ";
      }
      std::cout << std::dec << "\n";
      
      // If we see typical GC/Wii header bytes or patterns, this might be it
      // GameCube and Wii games often have recognizable data at specific offsets
      
      // Check for some common values in RAM when Dolphin is running
      // For example, 0x80000000 is often the base address in GC memory
      uint32_t value;
      std::memcpy(&value, buffer, sizeof(uint32_t));
      
      // Just a heuristic - if values look like pointers in the GameCube's address space
      // (often starting with 0x8...)
      if ((value & 0x80000000) || 
          // Or check for other patterns you might expect
          (buffer[0] == 0x00 && buffer[1] == 0x00 && buffer[2] == 0x00)) {
        
        std::cout << "This region has patterns consistent with GameCube/Wii memory!\n";
        m_emuRAMAddressStart = addr;
        
        // Try reading from a few known offsets where certain values should be
        // For example, many GameCube games store important data at specific addresses
        char buffer[32];
        readAtOffset(addr, 0x0, buffer, 32);       // Game start
        readAtOffset(addr, 0x80000000, buffer, 32); // Common GC memory mapping start
        readAtOffset(addr, 0x8000, buffer, 32);     // Some games have important data here
        
        return true;
      }
    } else {
      std::cout << "Failed to read from region at 0x" << std::hex << addr 
                << ", error: " << result << std::dec << "\n";
    }
  }
  
  std::cout << "None of the memory regions match expected patterns\n";
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

void MacDolphinProcess::detachFromProcess()
{
  if (m_PID != -1)
  {
    ptrace(PT_DETACH, m_PID, 0, 0);
    std::cout << "Detached from process\n";
  }
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
