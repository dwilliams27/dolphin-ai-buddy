#include "offscreen_capture.h"
#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ApplicationServices/ApplicationServices.h>

namespace offscreen_capture {

CaptureResult CaptureWindowByPID(pid_t pid) {
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
    
    // Get the first window (main window)
    AXUIElementRef windowElement = (AXUIElementRef)CFArrayGetValueAtIndex(windowsArray, 0);
    
    // Get window bounds
    CGRect windowBounds;
    AXValueRef axPosition, axSize;
    CGPoint position = {0.0, 0.0};
    CGSize size = {0.0, 0.0};
    
    axError = AXUIElementCopyAttributeValue(windowElement, kAXPositionAttribute, (CFTypeRef*)&axPosition);
    if (axError == kAXErrorSuccess) {
        AXValueGetValue(axPosition, (AXValueType)kAXValueCGPointType, &position);
        CFRelease(axPosition);
    }
    
    axError = AXUIElementCopyAttributeValue(windowElement, kAXSizeAttribute, (CFTypeRef*)&axSize);
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
    
    for (NSDictionary* windowInfo in windows) {
        NSNumber* ownerPID = [windowInfo objectForKey:(__bridge NSString*)kCGWindowOwnerPID];
        if ([ownerPID intValue] == pid) {
            windowID = [[windowInfo objectForKey:(__bridge NSString*)kCGWindowNumber] unsignedIntValue];
            break;
        }
    }
    
    // No need to release windows with __bridge_transfer above
    
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
