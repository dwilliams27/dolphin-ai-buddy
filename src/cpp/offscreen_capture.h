#include <string>
#include <vector>

namespace offscreen_capture {

/**
 * Structure to hold image data and metadata
 */
struct CaptureResult {
    std::vector<uint8_t> buffer;
    int width;
    int height;
    bool success;
    std::string error;
};

/**
 * Captures a screenshot from a process with the given PID
 * 
 * @param pid The process ID of the application (Dolphin)
 * @return CaptureResult with the image data and metadata
 */
CaptureResult CaptureWindowByPID(pid_t pid);

}  // namespace offscreen_capture
