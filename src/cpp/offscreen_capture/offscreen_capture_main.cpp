#include <napi.h>
#include "offscreen_capture.h"

namespace {

// Node.js addon method to capture a window by PID
Napi::Value CaptureWindowByPID(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Check arguments
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Process ID (number) expected as first argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Get the PID from the arguments
    pid_t pid = info[0].As<Napi::Number>().Int32Value();
    
    // Get the optional gameId
    std::string gameId = "";
    if (info.Length() >= 2 && info[1].IsString()) {
        gameId = info[1].As<Napi::String>().Utf8Value();
    }
    
    // Capture the window
    offscreen_capture::CaptureResult result = offscreen_capture::CaptureWindowByPID(pid, gameId);
    
    // Create a return object
    Napi::Object returnObj = Napi::Object::New(env);
    
    if (result.success) {
        // Add the image buffer to the return object
        Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(
            env, 
            result.buffer.data(), 
            result.buffer.size()
        );
        
        returnObj.Set("buffer", buffer);
        returnObj.Set("width", Napi::Number::New(env, result.width));
        returnObj.Set("height", Napi::Number::New(env, result.height));
        returnObj.Set("success", Napi::Boolean::New(env, true));
    } else {
        // If capture failed, return error information
        returnObj.Set("success", Napi::Boolean::New(env, false));
        returnObj.Set("error", Napi::String::New(env, result.error));
    }
    
    return returnObj;
}

// Initialize the addon
Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
    exports.Set("captureWindowByPID", Napi::Function::New(env, CaptureWindowByPID));
    return exports;
}

NODE_API_MODULE(offscreen_capture, InitModule)

}  // namespace
