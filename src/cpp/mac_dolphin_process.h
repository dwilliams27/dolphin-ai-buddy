#pragma once

#include <mach/mach.h>

#include "common_types.h"

namespace DolphinComm
{
  class IDolphinProcess
{
public:
  virtual ~IDolphinProcess() {}
  virtual bool findPID() = 0;
  virtual bool obtainEmuRAMInformation() = 0;
  virtual bool readFromRAM(const u32 offset, char* buffer, const size_t size,
                           const bool withBSwap) = 0;
  virtual bool writeToRAM(const u32 offset, const char* buffer, const size_t size,
                          const bool withBSwap) = 0;

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

protected:
  int m_PID = -1;
  u64 m_emuRAMAddressStart = 0;
  u64 m_emuARAMAdressStart = 0;
  u64 m_MEM2AddressStart = 0;
  bool m_ARAMAccessible = false;
  bool m_MEM2Present = false;
};

class MacDolphinProcess : public IDolphinProcess
{
public:
  MacDolphinProcess() {}
  bool findPID() override;
  bool obtainEmuRAMInformation() override;
  bool testMemoryRegions();
  void testReadAtOffset(mach_vm_address_t baseAddr, uint32_t offset);
  void detachFromProcess();
  bool readFromRAM(const u32 offset, char* buffer, size_t size, const bool withBSwap) override;
  bool writeToRAM(const u32 offset, const char* buffer, const size_t size,
                  const bool withBSwap) override;

private:
  task_t m_task;
  task_t m_currentTask;
};
}  // namespace DolphinComm
