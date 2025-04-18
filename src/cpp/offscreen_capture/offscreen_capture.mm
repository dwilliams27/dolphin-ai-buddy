#include "offscreen_capture.h"
#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ApplicationServices/ApplicationServices.h>

namespace offscreen_capture {

CaptureResult CaptureWindowByPID(pid_t pid, const std::string& gameId) {
    CaptureResult result;
    result.success = false;
    
    NSAutoreleasePool* pool = [[NSAutoreleasePool alloc] init];
    
    // Find the application with the given PID
    NSRunningApplication* app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
    
    if (!app) {
        result.error = "Process with the given PID not found";
        [pool release];
        return result;
    }
    
    // Create an accessibility element for the application
    AXUIElementRef appElement = AXUIElementCreateApplication(pid);
    
    if (!appElement) {
        result.error = "Failed to create accessibility element for the application";
        [pool release];
        return result;
    }
    
    // Get all windows from the application
    CFArrayRef windowsArray;
    AXError axError = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute, (CFTypeRef*)&windowsArray);
    
    if (axError != kAXErrorSuccess || !windowsArray) {
        if (appElement) CFRelease(appElement);
        
        result.error = "Failed to get windows from application";
        [pool release];
        return result;
    }
    
    if (CFArrayGetCount(windowsArray) == 0) {
        CFRelease(windowsArray);
        CFRelease(appElement);
        
        result.error = "Application has no windows";
        [pool release];
        return result;
    }
    
    // Find the game window - look for the window with the gameId in its title
    AXUIElementRef gameWindowElement = NULL;
    
    for (CFIndex i = 0; i < CFArrayGetCount(windowsArray); i++) {
        AXUIElementRef currentWindow = (AXUIElementRef)CFArrayGetValueAtIndex(windowsArray, i);
        
        // Get window title to see if it's the game window
        CFStringRef windowTitle;
        if (AXUIElementCopyAttributeValue(currentWindow, kAXTitleAttribute, (CFTypeRef*)&windowTitle) == kAXErrorSuccess) {
            NSString *title = (__bridge NSString*)windowTitle;
            NSLog(@"Window title: %@", title);
            
            // Check if the gameId is part of the window title
            if (!gameId.empty()) {
                NSString *gameIdNS = [NSString stringWithUTF8String:gameId.c_str()];
                if ([title rangeOfString:gameIdNS options:NSCaseInsensitiveSearch].location != NSNotFound) {
                    gameWindowElement = currentWindow;
                    NSLog(@"Found window with matching game ID: %@", title);
                    CFRelease(windowTitle);
                    break;
                }
            }
            
            // Get window size as a fallback
            AXValueRef axSize;
            CGSize windowSize = {0, 0};
            
            if (AXUIElementCopyAttributeValue(currentWindow, kAXSizeAttribute, (CFTypeRef*)&axSize) == kAXErrorSuccess) {
                AXValueGetValue(axSize, (AXValueType)kAXValueCGSizeType, &windowSize);
                CFRelease(axSize);
                
                // Log window size for debugging
                NSLog(@"Window size: %.0f x %.0f", windowSize.width, windowSize.height);
            }
            
            CFRelease(windowTitle);
        }
    }
    
    // If we didn't find a window with matching gameId, fall back to heuristics
    if (!gameWindowElement) {
        NSLog(@"No window with matching game ID found, falling back to heuristics");
        CGSize largestSize = {0, 0};
        
        for (CFIndex i = 0; i < CFArrayGetCount(windowsArray); i++) {
            AXUIElementRef currentWindow = (AXUIElementRef)CFArrayGetValueAtIndex(windowsArray, i);
            
            // Get window title to see if it has FPS or other game indicators
            CFStringRef windowTitle;
            if (AXUIElementCopyAttributeValue(currentWindow, kAXTitleAttribute, (CFTypeRef*)&windowTitle) == kAXErrorSuccess) {
                NSString *title = (__bridge NSString*)windowTitle;
                
                // Get window size
                AXValueRef axSize;
                CGSize windowSize = {0, 0};
                
                if (AXUIElementCopyAttributeValue(currentWindow, kAXSizeAttribute, (CFTypeRef*)&axSize) == kAXErrorSuccess) {
                    AXValueGetValue(axSize, (AXValueType)kAXValueCGSizeType, &windowSize);
                    CFRelease(axSize);
                    
                    // If window is larger or has game indicators in title
                    if ((windowSize.width > largestSize.width && windowSize.height > largestSize.height) ||
                        ([title rangeOfString:@"Dolphin"].location == NSNotFound && // Not the main Dolphin window
                        ([title rangeOfString:@"FPS"].location != NSNotFound || // Game windows often show FPS
                         [title rangeOfString:@"|"].location != NSNotFound))) { // Game windows often have | in title
                        
                        largestSize = windowSize;
                        gameWindowElement = currentWindow;
                        NSLog(@"Found likely game window: %@", title);
                    }
                }
                
                CFRelease(windowTitle);
            }
        }
    }
    
    // If we still didn't find a game window, fall back to the first window
    if (!gameWindowElement && CFArrayGetCount(windowsArray) > 0) {
        gameWindowElement = (AXUIElementRef)CFArrayGetValueAtIndex(windowsArray, 0);
        NSLog(@"Falling back to first window");
    }
    
    // Get window bounds for the selected window
    CGRect windowBounds;
    AXValueRef axPosition, axSize;
    CGPoint position = {0.0, 0.0};
    CGSize size = {0.0, 0.0};
    
    axError = AXUIElementCopyAttributeValue(gameWindowElement, kAXPositionAttribute, (CFTypeRef*)&axPosition);
    if (axError == kAXErrorSuccess) {
        AXValueGetValue(axPosition, (AXValueType)kAXValueCGPointType, &position);
        CFRelease(axPosition);
    }
    
    axError = AXUIElementCopyAttributeValue(gameWindowElement, kAXSizeAttribute, (CFTypeRef*)&axSize);
    if (axError == kAXErrorSuccess) {
        AXValueGetValue(axSize, (AXValueType)kAXValueCGSizeType, &size);
        CFRelease(axSize);
    }
    
    windowBounds = CGRectMake(position.x, position.y, size.width, size.height);
    
    // Get window ID
    NSArray* windows = (__bridge_transfer NSArray*)CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID
    );
    
    CGWindowID windowID = 0;
    CFStringRef gameWindowTitle = NULL;
    AXUIElementCopyAttributeValue(gameWindowElement, kAXTitleAttribute, (CFTypeRef*)&gameWindowTitle);
    NSString *targetTitle = gameWindowTitle ? (__bridge NSString*)gameWindowTitle : nil;
    
    // Try to find the matching window ID
    for (NSDictionary* windowInfo in windows) {
        NSNumber* ownerPID = [windowInfo objectForKey:(__bridge NSString*)kCGWindowOwnerPID];
        NSString* windowName = [windowInfo objectForKey:(__bridge NSString*)kCGWindowName];
        
        if ([ownerPID intValue] == pid) {
            // If we have a title to match and it matches, use this window
            if (targetTitle && windowName && [windowName isEqualToString:targetTitle]) {
                windowID = [[windowInfo objectForKey:(__bridge NSString*)kCGWindowNumber] unsignedIntValue];
                NSLog(@"Found exact window title match: %@", windowName);
                break;
            }
            
            // If we don't have a specific title or haven't found a match yet, store this as a candidate
            if (windowID == 0) {
                windowID = [[windowInfo objectForKey:(__bridge NSString*)kCGWindowNumber] unsignedIntValue];
            }
            
            // If this is a likely game window (not the launcher), use it
            if (windowName && 
                ([windowName rangeOfString:@"FPS"].location != NSNotFound ||
                 [windowName rangeOfString:@"|"].location != NSNotFound ||
                 [windowName rangeOfString:@"Dolphin"].location == NSNotFound)) {
                windowID = [[windowInfo objectForKey:(__bridge NSString*)kCGWindowNumber] unsignedIntValue];
                NSLog(@"Found likely game window: %@", windowName);
                break;
            }
        }
    }
    
    if (gameWindowTitle) {
        CFRelease(gameWindowTitle);
    }
    
    if (windowID == 0) {
        CFRelease(windowsArray);
        CFRelease(appElement);
        
        result.error = "Failed to find window ID for application";
        [pool release];
        return result;
    }
    
    // Capture the window image
    CGImageRef windowImage = CGWindowListCreateImage(
        windowBounds,
        kCGWindowListOptionIncludingWindow,
        windowID,
        kCGWindowImageBoundsIgnoreFraming | kCGWindowImageShouldBeOpaque
    );
    
    NSLog(@"Capturing window ID: %u with size: %.0f x %.0f", windowID, size.width, size.height);
    
    if (!windowImage) {
        CFRelease(windowsArray);
        CFRelease(appElement);
        
        result.error = "Failed to capture window image";
        [pool release];
        return result;
    }
    
    // Convert to PNG
    CFMutableDataRef pngData = CFDataCreateMutable(NULL, 0);
    CGImageDestinationRef destination = CGImageDestinationCreateWithData(pngData, kUTTypePNG, 1, NULL);
    
    if (!destination) {
        CFRelease(windowImage);
        CFRelease(windowsArray);
        CFRelease(appElement);
        CFRelease(pngData);
        
        result.error = "Failed to create image destination";
        [pool release];
        return result;
    }
    
    CGImageDestinationAddImage(destination, windowImage, NULL);
    bool finalized = CGImageDestinationFinalize(destination);
    
    if (finalized) {
        // Get data from CFData
        const UInt8* buffer = CFDataGetBytePtr(pngData);
        CFIndex length = CFDataGetLength(pngData);
        
        // Copy to our vector
        result.buffer.assign(buffer, buffer + length);
        result.width = CGImageGetWidth(windowImage);
        result.height = CGImageGetHeight(windowImage);
        result.success = true;
    } else {
        result.error = "Failed to convert image to PNG";
    }
    
    // Cleanup
    CFRelease(destination);
    CFRelease(pngData);
    CFRelease(windowImage);
    CFRelease(windowsArray);
    CFRelease(appElement);
    
    [pool release];
    return result;
}

}  // namespace offscreen_capture
