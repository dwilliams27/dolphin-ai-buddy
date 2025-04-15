#include <napi.h>
#include "memory_accessor.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  return MemoryAccessor::Init(env, exports);
}

NODE_API_MODULE(dolphin_memory, InitAll)
