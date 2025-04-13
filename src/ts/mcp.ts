import { DolphinMemoryEngine } from "@/ts/dolphin-memory-engine.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export interface ActionReplayCode {
  name: string;
  description: string;
  code: string;
}

export class DabMcpServer {
  private server: McpServer;
  private dme?: DolphinMemoryEngine;
  private transport: StdioServerTransport;

  constructor() {
    this.server = new McpServer({
      name: "Dolphin-Ai-Buddy",
      version: "0.0.1",
    });
    this.transport = new StdioServerTransport();

    this.registerBasicTools();
  }

  setDME(dme: DolphinMemoryEngine) {
    this.dme = dme;
  }

  registerBasicTools() {
    this.server.tool(
      "readBytes",
      "Read memory directly from the emulator's RAM. Specify the offset from the start of the emulated RAM in bytes, and the number of bytes to read.",
      { offset: z.number(), numberOfBytesToRead: z.number() },
      async ({ offset, numberOfBytesToRead }) => {
        const data = this.dme?.read(offset, numberOfBytesToRead);
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
      "Write memory directly to the emulator's RAM. Specify the offset from the start of the emulated RAM in bytes, and a string of hex data to write.",
      { offset: z.number(), data: z.string() },
      async ({ offset, data }) => {
        const buffer = Buffer.from(data, "hex");
        const success = this.dme?.write(offset, buffer);
        return {
          content: [
            { type: "text", text: `Wrote ${buffer.length} bytes to offset ${offset}` },
            { type: "text", text: `Data: ${buffer.toString("hex")}` }
          ]
        };
      }
    );
  }

  async connect() {
    return this.server.connect(this.transport);
  }
}
