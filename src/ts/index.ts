import { DabMcpServer } from '@/ts/mcp.js';
import { DolphinInteractor } from '@/ts/dolphin/dolphin-interactor.js';

// async function initMemoryEngine() {
//   console.log("Initializing Dolphin Memory Engine...");
  
//   const engine = new DolphinMemoryEngine();
  
//   const data = engine.read(0x0, 256);
//   console.log("Memory dump:");
//   console.log(hexDump(data));

//   const buff = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
//   engine.write(0, buff);

//   const data2 = engine.read(0, 256);
//   console.log("Memory dump after:");
//   console.log(hexDump(data2));

//   const strings = extractStringsFromBuffer(data);
//   console.log("Extracted strings:");
//   strings.forEach(str => {
//     console.log(str);
//   });
// }

// initMemoryEngine();

const interactor = new DolphinInteractor();
const mcpInstance = new DabMcpServer(interactor);
mcpInstance.connect();
interactor.captureDolphinOffscreen();
interactor.sendKeys('1');

process.on('SIGINT', () => {
  console.log('Shutting down MCP server...');
  process.exit(0);
});
