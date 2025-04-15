import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const dolphinMemory = require('../build/Release/dolphin_memory.node');
const dolphinScreenGrab = require('../build/Release/offscreen_capture.node');

export default {
  dolphinMemory,
  dolphinScreenGrab
};
