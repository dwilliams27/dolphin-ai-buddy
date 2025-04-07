{
  "targets": [
    {
      "target_name": "dolphin_memory",
      "sources": [
        "src/cpp/main.cpp",
        "src/cpp/memory_accessor.cpp",
        "src/cpp/memory_common.cpp",
        "src/cpp/mac_dolphin_process.cpp"
      ],
      "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15"
      }
    }
  ]
}
