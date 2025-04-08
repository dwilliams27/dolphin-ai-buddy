#include "memory_accessor.h"

#include <iostream>

Napi::FunctionReference MemoryAccessor::constructor;

Napi::Object MemoryAccessor::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "MemoryAccessor", {
    InstanceMethod("readAtOffset", &MemoryAccessor::ReadAtOffset),
    InstanceMethod("writeAtOffset", &MemoryAccessor::WriteAtOffset),
    InstanceMethod("hook", &MemoryAccessor::Hook),
    InstanceMethod("isHooked", &MemoryAccessor::IsHooked),
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

Napi::Value MemoryAccessor::ReadAtOffset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Address, offset, and size arguments expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  if ((!info[0].IsNumber() && !info[0].IsBigInt()) || !info[1].IsNumber() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "Address must be a number or bigint, offset and size must be numbers").ThrowAsJavaScriptException();
    return env.Null();
  }

  uint64_t baseAddr;
  if (info[0].IsBigInt()) {
    bool lossless;
    baseAddr = info[0].As<Napi::BigInt>().Uint64Value(&lossless);
    if (!lossless) {
      Napi::Error::New(env, "Address conversion was not lossless").ThrowAsJavaScriptException();
      return env.Null();
    }
  } else {
    // Handle regular number
    baseAddr = static_cast<uint64_t>(info[0].As<Napi::Number>().DoubleValue());
  }

  uint32_t offset = info[1].As<Napi::Number>().Uint32Value();
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

Napi::Value MemoryAccessor::WriteAtOffset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 4) {
    Napi::TypeError::New(env, "Address, offset, buffer, and size arguments expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  if ((!info[0].IsNumber() && !info[0].IsBigInt()) || !info[1].IsNumber() || !info[2].IsBuffer() || !info[3].IsNumber()) {
    Napi::TypeError::New(env, "Address must be a number or bigint, buffer must be a buffer, and offset and size must be numbers").ThrowAsJavaScriptException();
    return env.Null();
  }

  uint64_t baseAddr;
  if (info[0].IsBigInt()) {
    bool lossless;
    baseAddr = info[0].As<Napi::BigInt>().Uint64Value(&lossless);
    if (!lossless) {
      Napi::Error::New(env, "Address conversion was not lossless").ThrowAsJavaScriptException();
      return env.Null();
    }
  } else {
    // Handle regular number
    baseAddr = static_cast<uint64_t>(info[0].As<Napi::Number>().DoubleValue());
  }

  uint32_t offset = info[1].As<Napi::Number>().Uint32Value();
  size_t size = info[2].As<Napi::Number>().Uint32Value();
  Napi::Buffer<uint8_t> buffer = info[3].As<Napi::Buffer<uint8_t>>();
  std::vector<uint8_t> bytes(size);

  bool success = m_process.writeAtOffset(baseAddr, offset, reinterpret_cast<char*>(buffer.Data()), size);

  return Napi::Boolean::New(env, success);
}

Napi::Value MemoryAccessor::Hook(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  bool success = m_process.findPID();
  
  if (success) {
    std::cout << "Found Dolphin PID!\n";
    success = m_process.obtainEmuRAMInformation();
  }

  u64 emuRAMAddressStart = m_process.getEmuRAMAddressStart();

  return Napi::Number::New(env, emuRAMAddressStart);
}

Napi::Value MemoryAccessor::IsHooked(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  bool hooked = m_process.hasEmuRAMInformation();
  
  return Napi::Boolean::New(env, hooked);
}
