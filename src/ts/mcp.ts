import { DolphinInteractor } from "@/ts/dolphin/dolphin-interactor.js";
import { DolphinMemoryEngine } from "@/ts/dolphin/dolphin-memory-engine.js";
import { hexToBytes, isPngFile, SCREENSHOTS_DIR } from "@/ts/utils.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { z } from "zod";

export interface ActionReplayCode {
  name: string;
  description: string;
  code: string;
}

export class DabMcpServer {
  private server: McpServer;
  private interactor: DolphinInteractor;
  private transport: StdioServerTransport;

  constructor(interactor: DolphinInteractor) {
    this.server = new McpServer({
      name: "Dolphin-Ai-Buddy",
      version: "0.0.1",
    });
    this.transport = new StdioServerTransport();

    this.registerBasicTools();
    this.interactor = interactor;
  }

  registerBasicTools() {
    this.server.tool(
      "readBytes",
      "Read memory directly from the emulator's RAM. You MUST specify both an offset (as a hex string) from the starting address of the game's RAM, and the number of bytes to read.",
      { offset: z.string(), numberOfBytesToRead: z.number().nonnegative() },
      async ({ offset, numberOfBytesToRead }) => {
        const data = this.interactor.dme?.read(hexToBytes(offset), numberOfBytesToRead);
        return {
          content: [
            { type: "text", text: `Read ${numberOfBytesToRead} bytes from offset ${offset}` },
            { type: "text", text: `Data: ${data?.toString("hex")}` }
          ]
        };
      }
    );
    this.server.tool(
      "writeBytes",
      "Write memory directly to the emulator's RAM.  You MUST specify both an offset (as a hex string) from the starting address of the game's RAM, and a hex string representing the bytes to write.",
      { offset: z.string(), data: z.string() },
      async ({ offset, data }) => {
        const buffer = Buffer.from(data, "hex");
        const success = this.interactor.dme?.write(hexToBytes(offset), buffer);
        return {
          content: [
            { type: "text", text: `Wrote ${buffer.length} bytes to offset ${offset}` },
            { type: "text", text: `Data: ${buffer.toString("hex")}` }
          ]
        };
      }
    );
    this.server.tool(
      "captureScreenshot",
      "Take a screenshot of the game.",
      {},
      async (_) => {
        const filename = this.interactor.captureDolphinOffscreen();
        return {
          content: [
            { type: "text", text: `Successfully saved screenshot as ${filename}` },
          ]
        };
      }
    );
    this.server.tool(
      "viewLatestScreenshot",
      "View the latest screenshot taken.",
      {},
      async (_) => {
        try {
          const files = (await readdir(SCREENSHOTS_DIR)).sort();
          const latestFile = files[files.length - 1];
          const filePath = path.join(SCREENSHOTS_DIR, latestFile!);
          
          // Check if file exists and is a PNG
          if (!await isPngFile(filePath)) {
            throw new Error(`File ${latestFile} is not a valid PNG screenshot`);
          }
          
          // Read the file as Base64
          const fileBuffer = await readFile(filePath);
          const base64Data = fileBuffer.toString('base64');
          
          return {
            content: [
              { type: "image", data: `data:image/png;base64,${base64Data}`, mimeType: "image/png" },
            ]
          };
        } catch (error: any) {
          return {
            content: [
              { type: "text", text: "Could not get latest screenshot" },
            ]
          };
        }
      }
    );
    // this.server.resource(
    //   "list-screenshots",
    //   "screenshots://list",
    //   async (uri) => {
    //     try {
    //       const files = await readdir(SCREENSHOTS_DIR);
    //       const screenshotFiles = [];
          
    //       for (const file of files) {
    //         const filePath = path.join(SCREENSHOTS_DIR, file);
    //         if (await isPngFile(filePath)) {
    //           screenshotFiles.push(file);
    //         }
    //       }
          
    //       return {
    //         contents: [
    //           {
    //             uri: uri.href,
    //             text: JSON.stringify({ screenshots: screenshotFiles }, null, 2)
    //           }
    //         ]
    //       };
    //     } catch (error: any) {
    //       console.error("Error listing screenshots:", error);
    //       throw new Error(`Failed to list screenshots: ${error.message}`);
    //     }
    //   }
    // );
    // this.server.resource(
    //   "get-latest-screenshot",
    //   "screenshots://latest",
    //   async (uri) => {
    //     try {
    //       const files = (await readdir(SCREENSHOTS_DIR)).sort();
    //       const latestFile = files[files.length - 1];
    //       const filePath = path.join(SCREENSHOTS_DIR, latestFile!);
          
    //       // Check if file exists and is a PNG
    //       if (!await isPngFile(filePath)) {
    //         throw new Error(`File ${latestFile} is not a valid PNG screenshot`);
    //       }
          
    //       // Read the file as Base64
    //       const fileBuffer = await readFile(filePath);
    //       const base64Data = fileBuffer.toString('base64');
          
    //       return {
    //         contents: [
    //           {
    //             uri: uri.href,
    //             text: `data:image/png;base64,${base64Data}`
    //           }
    //         ]
    //       };
    //     } catch (error: any) {
    //       console.error(`Error getting screenshot ${uri.pathname}:`, error);
    //       throw new Error(`Failed to get screenshot: ${error.message}`);
    //     }
    //   }
    // );
  }

  async connect() {
    return this.server.connect(this.transport);
  }
}
