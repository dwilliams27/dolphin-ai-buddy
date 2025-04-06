#include "memory_accessor.h"

#include <iostream>

Napi::FunctionReference MemoryAccessor::constructor;

Napi::Object MemoryAccessor::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "MemoryAccessor", {
    InstanceMethod("testMemoryRegions", &MemoryAccessor::TestMemoryRegions),
    InstanceMethod("readAtOffset", &MemoryAccessor::ReadAtOffset),
    InstanceMethod("detatch", &MemoryAccessor::Detatch),
    InstanceMethod("hook", &MemoryAccessor::Hook),
    InstanceMethod("isHooked", &MemoryAccessor::IsHooked),
    InstanceMethod("readBytes", &MemoryAccessor::ReadBytes),
    InstanceMethod("writeBytes", &MemoryAccessor::WriteBytes)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("MemoryAccessor", func);
  return exports;
}

MemoryAccessor::MemoryAccessor(const Napi::CallbackInfo& info) 
  : Napi::ObjectWrap<MemoryAccessor>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
}

Napi::Value MemoryAccessor::Detatch(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  m_process.detachFromProcess();

  return Napi::Boolean::New(env, true);
}

Napi::Value MemoryAccessor::TestMemoryRegions(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  m_process.testMemoryRegions();

  return Napi::Boolean::New(env, true);
}

Napi::Value MemoryAccessor::ReadAtOffset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Address, offset, and size arguments expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsBigInt() || !info[1].IsNumber() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "Address must be bigint, offset and size must be numbers").ThrowAsJavaScriptException();
    return env.Null();
  }

  bool lossless;
  uint64_t baseAddr = info[0].As<Napi::BigInt>().Uint64Value(&lossless);
  if (!lossless) {
    Napi::Error::New(env, "Address conversion was not lossless").ThrowAsJavaScriptException();
    return env.Null();
  }
  uint32_t offset = info[1].As<Napi::Number>().ToNumber().Uint32Value();
  size_t size = info[2].As<Napi::Number>().Uint32Value();
  std::vector<uint8_t> bytes(size);

  bool success = m_process.readAtOffset(baseAddr, offset, reinterpret_cast<char*>(bytes.data()), size);

  if (!success) {
    Napi::Error::New(env, "ReadAtOffset: Failed to read memory").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, bytes.data(), size);
  return buffer;
}

Napi::Value MemoryAccessor::Hook(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  bool success = m_process.findPID();
  if (success) {
    std::cout << "Found Dolphin PID!\n";
    success = m_process.obtainEmuRAMInformation();
  }

  return Napi::Boolean::New(env, success);
}

Napi::Value MemoryAccessor::IsHooked(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  bool hooked = m_process.hasEmuRAMInformation();
  
  return Napi::Boolean::New(env, hooked);
}

Napi::Value MemoryAccessor::ReadBytes(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Address and size arguments expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Address and size must be numbers").ThrowAsJavaScriptException();
    return env.Null();
  }

  uint64_t address = info[0].As<Napi::Number>().Int64Value();
  size_t size = info[1].As<Napi::Number>().Uint32Value();

  if (!m_process.hasEmuRAMInformation()) {
    Napi::Error::New(env, "Not hooked to Dolphin process").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::vector<uint8_t> bytes(size);
  bool success = m_process.readFromRAM(address, reinterpret_cast<char*>(bytes.data()), size, false);

  if (!success) {
    Napi::Error::New(env, "Failed to read memory").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, bytes.data(), size);
  return buffer;
}

Napi::Value MemoryAccessor::WriteBytes(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Address and buffer arguments expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsBuffer()) {
    Napi::TypeError::New(env, "Address must be a number and data must be a buffer").ThrowAsJavaScriptException();
    return env.Null();
  }

  uint64_t address = info[0].As<Napi::Number>().Int64Value();
  Napi::Buffer<uint8_t> buffer = info[1].As<Napi::Buffer<uint8_t>>();
  size_t size = buffer.Length();
  const uint8_t* data = buffer.Data();

  if (!m_process.hasEmuRAMInformation()) {
    Napi::Error::New(env, "Not hooked to Dolphin process").ThrowAsJavaScriptException();
    return env.Null();
  }

  bool success = m_process.writeToRAM(address, reinterpret_cast<const char*>(data), size, false);

  return Napi::Boolean::New(env, success);
}
