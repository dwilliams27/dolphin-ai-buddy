#pragma once

#include <mach/mach.h>
#include <vector>

#include "common_types.h"

struct MemoryRegionInfo {
  mach_vm_address_t address;
  mach_vm_size_t size;
  vm_prot_t protection;
};

namespace DolphinComm
{
  class IDolphinProcess
{
public:
  

protected:
  
};

class MacDolphinProcess : public IDolphinProcess
{
public:
  MacDolphinProcess() {}

  int getPID() const { return m_PID; };
  u64 getEmuRAMAddressStart() const { return m_emuRAMAddressStart; };
  bool isMEM2Present() const { return m_MEM2Present; };
  bool isARAMAccessible() const { return m_ARAMAccessible; };
  bool hasEmuRAMInformation() const { return m_emuRAMAddressStart != 0; };
  u64 getARAMAddressStart() const { return m_emuARAMAdressStart; };
  u64 getMEM2AddressStart() const { return m_MEM2AddressStart; };
  u64 getMEM1ToMEM2Distance() const
  {
    if (!m_MEM2Present)
      return 0;
    return m_MEM2AddressStart - m_emuRAMAddressStart;
  };
  bool findPID();
  bool obtainEmuRAMInformation();
  bool readAtOffset(mach_vm_address_t baseAddr, uint32_t offset, char* buffer, size_t size);
  bool writeAtOffset(mach_vm_address_t baseAddr, uint32_t offset, char* buffer, size_t size);

private:
  task_t m_task;
  task_t m_currentTask;
  int m_PID = -1;
  u64 m_emuRAMAddressStart = 0;
  u64 m_emuARAMAdressStart = 0;
  u64 m_MEM2AddressStart = 0;
  bool m_ARAMAccessible = false;
  bool m_MEM2Present = false;
};
}  // namespace DolphinComm
