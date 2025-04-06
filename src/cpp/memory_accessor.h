#pragma once
#include <napi.h>
#include "mac_dolphin_process.h"

class MemoryAccessor : public Napi::ObjectWrap<MemoryAccessor> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  MemoryAccessor(const Napi::CallbackInfo& info);

private:
  static Napi::FunctionReference constructor;
  
  DolphinComm::MacDolphinProcess m_process;
  
  Napi::Value Detatch(const Napi::CallbackInfo& info);
  Napi::Value Hook(const Napi::CallbackInfo& info);
  Napi::Value IsHooked(const Napi::CallbackInfo& info);
  Napi::Value ReadBytes(const Napi::CallbackInfo& info);
  Napi::Value WriteBytes(const Napi::CallbackInfo& info);
};
