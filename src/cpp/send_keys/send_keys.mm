#import <Foundation/Foundation.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Cocoa/Cocoa.h>
#import <node_api.h>

// Helper function to simulate key press and release
void SimulateKeyEvent(CGKeyCode keyCode, bool keyDown) {
    CGEventSourceRef source = CGEventSourceCreate((CGEventSourceStateID)1);
    CGEventRef event = CGEventCreateKeyboardEvent(source, keyCode, keyDown);
    CGEventPost((CGEventTapLocation)0, event);
    CFRelease(event);
    CFRelease(source);
}

// Helper function to perform key press and release with delay
void PressAndReleaseKey(CGKeyCode keyCode, int delayMicroseconds) {
    SimulateKeyEvent(keyCode, true);  // Key down
    usleep(delayMicroseconds);        // Small delay
    SimulateKeyEvent(keyCode, false); // Key up
}

// Helper function to simulate modifier + key combination
void SimulateKeyWithModifiers(CGKeyCode keyCode, CGEventFlags modifiers) {
    CGEventSourceRef source = CGEventSourceCreate((CGEventSourceStateID)1);
    
    // Create key down event with modifiers
    CGEventRef keyDownEvent = CGEventCreateKeyboardEvent(source, keyCode, true);
    CGEventSetFlags(keyDownEvent, modifiers);
    CGEventPost((CGEventTapLocation)0, keyDownEvent);
    
    // Small delay between down and up
    usleep(10000);
    
    // Create key up event with same modifiers
    CGEventRef keyUpEvent = CGEventCreateKeyboardEvent(source, keyCode, false);
    CGEventSetFlags(keyUpEvent, modifiers);
    CGEventPost((CGEventTapLocation)0, keyUpEvent);
    
    CFRelease(keyUpEvent);
    CFRelease(keyDownEvent);
    CFRelease(source);
}

// Find window with given title substring and PID
bool FindWindowByTitleAndPID(pid_t pid, const char* titleSubstring, CGWindowID* outWindowID, char* outWindowTitle, size_t titleBufferSize) {
    CFArrayRef windowList = CGWindowListCopyWindowInfo(kCGWindowListOptionAll, kCGNullWindowID);
    bool found = false;
    
    for (id windowInfo in (__bridge NSArray*)windowList) {
        NSDictionary* window = (__bridge NSDictionary*)windowInfo;
        NSNumber* windowPID = [window objectForKey:(id)kCGWindowOwnerPID];
        NSString* windowTitle = [window objectForKey:(id)kCGWindowName];
        
        if ([windowPID intValue] == pid && 
            windowTitle != nil && 
            [windowTitle rangeOfString:@(titleSubstring) options:NSCaseInsensitiveSearch].location != NSNotFound) {
            *outWindowID = [[window objectForKey:(id)kCGWindowNumber] unsignedIntValue];
            
            // Copy window title to output buffer
            if (outWindowTitle != NULL && titleBufferSize > 0) {
                const char* utf8Title = [windowTitle UTF8String];
                strncpy(outWindowTitle, utf8Title, titleBufferSize - 1);
                outWindowTitle[titleBufferSize - 1] = '\0';
            }
            
            found = true;
            break;
        }
    }
    
    CFRelease(windowList);
    return found;
}

// Node.js binding functions
napi_value SendKeyToWindow(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 3;
    napi_value args[3];
    
    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 3) {
        napi_throw_error(env, NULL, "Expected 3 arguments: PID, windowTitleSubstring, keyCode");
        napi_value result;
        napi_get_undefined(env, &result);
        return result;
    }
    
    // Parse arguments
    int32_t pid;
    char titleSubstring[256];
    int32_t keyCode;
    size_t strLen;
    
    status = napi_get_value_int32(env, args[0], &pid);
    status = napi_get_value_string_utf8(env, args[1], titleSubstring, 256, &strLen);
    status = napi_get_value_int32(env, args[2], &keyCode);
    
    // Find the window (for validation only)
    CGWindowID windowID;
    char windowTitle[512] = {0};
    bool windowFound = FindWindowByTitleAndPID((pid_t)pid, titleSubstring, &windowID, windowTitle, sizeof(windowTitle));
    
    napi_value result;
    napi_create_object(env, &result);
    
    if (!windowFound) {
        napi_value successProp, errorValue;
        napi_get_boolean(env, false, &successProp);
        napi_create_string_utf8(env, "Window not found", NAPI_AUTO_LENGTH, &errorValue);
        
        napi_set_named_property(env, result, "success", successProp);
        napi_set_named_property(env, result, "error", errorValue);
        return result;
    }
    
    // Send the keystroke directly (no window focus needed)
    PressAndReleaseKey((CGKeyCode)keyCode, 50000); // 50ms delay
    
    napi_value successProp, windowIDValue, windowTitleValue;
    napi_get_boolean(env, true, &successProp);
    napi_create_int32(env, (int32_t)windowID, &windowIDValue);
    napi_create_string_utf8(env, windowTitle, NAPI_AUTO_LENGTH, &windowTitleValue);
    
    napi_set_named_property(env, result, "success", successProp);
    napi_set_named_property(env, result, "windowID", windowIDValue);
    napi_set_named_property(env, result, "windowTitle", windowTitleValue);
    
    return result;
}

napi_value SendKeyWithModifiersToWindow(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 4;
    napi_value args[4];
    
    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 4) {
        napi_throw_error(env, NULL, "Expected 4 arguments: PID, windowTitleSubstring, keyCode, modifierFlags");
        napi_value result;
        napi_get_undefined(env, &result);
        return result;
    }
    
    // Parse arguments
    int32_t pid;
    char titleSubstring[256];
    int32_t keyCode;
    int32_t modifierFlags;
    size_t strLen;
    
    status = napi_get_value_int32(env, args[0], &pid);
    status = napi_get_value_string_utf8(env, args[1], titleSubstring, 256, &strLen);
    status = napi_get_value_int32(env, args[2], &keyCode);
    status = napi_get_value_int32(env, args[3], &modifierFlags);
    
    // Find the window (for validation only)
    CGWindowID windowID;
    char windowTitle[512] = {0};
    bool windowFound = FindWindowByTitleAndPID((pid_t)pid, titleSubstring, &windowID, windowTitle, sizeof(windowTitle));
    
    napi_value result;
    napi_create_object(env, &result);
    
    if (!windowFound) {
        napi_value successProp, errorValue;
        napi_get_boolean(env, false, &successProp);
        napi_create_string_utf8(env, "Window not found", NAPI_AUTO_LENGTH, &errorValue);
        
        napi_set_named_property(env, result, "success", successProp);
        napi_set_named_property(env, result, "error", errorValue);
        return result;
    }
    
    // Send the keystroke with modifiers directly (no window focus needed)
    SimulateKeyWithModifiers((CGKeyCode)keyCode, (CGEventFlags)modifierFlags);
    
    napi_value successProp, windowIDValue, windowTitleValue;
    napi_get_boolean(env, true, &successProp);
    napi_create_int32(env, (int32_t)windowID, &windowIDValue);
    napi_create_string_utf8(env, windowTitle, NAPI_AUTO_LENGTH, &windowTitleValue);
    
    napi_set_named_property(env, result, "success", successProp);
    napi_set_named_property(env, result, "windowID", windowIDValue);
    napi_set_named_property(env, result, "windowTitle", windowTitleValue);
    
    return result;
}

// Initialize the module
napi_value Init(napi_env env, napi_value exports) {
    napi_status status;
    napi_value fn;
    
    status = napi_create_function(env, NULL, 0, SendKeyToWindow, NULL, &fn);
    if (status != napi_ok) return NULL;
    status = napi_set_named_property(env, exports, "sendKeyToWindow", fn);
    if (status != napi_ok) return NULL;
    
    status = napi_create_function(env, NULL, 0, SendKeyWithModifiersToWindow, NULL, &fn);
    if (status != napi_ok) return NULL;
    status = napi_set_named_property(env, exports, "sendKeyWithModifiersToWindow", fn);
    if (status != napi_ok) return NULL;
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
