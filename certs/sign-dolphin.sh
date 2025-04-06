# Find the path to Dolphin
DOLPHIN_PATH="REPLACE_ME"

# Check if the app exists
if [ ! -d "$DOLPHIN_PATH" ]; then
    echo "Dolphin not found at $DOLPHIN_PATH"
    exit 1
fi

# Sign the application with debug entitlements
sudo codesign --force --sign "dolphin-ai-buddy" --entitlements dolphin-debug.entitlements "$DOLPHIN_PATH"

# Verify signing
codesign -vvv -d "$DOLPHIN_PATH"
