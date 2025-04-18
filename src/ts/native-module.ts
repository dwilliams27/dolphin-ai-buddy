import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const dolphinMemory = require('../build/Release/dolphin_memory.node');
const dolphinScreenGrab = require('../build/Release/offscreen_capture.node');
const dolphinSendKeys = require('../build/Release/send_keys.node');

export default {
  dolphinMemory,
  dolphinScreenGrab,
  dolphinSendKeys
};
