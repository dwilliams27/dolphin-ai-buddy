import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const dolphinMemory = require('../build/Release/dolphin_memory.node');

export default dolphinMemory;
