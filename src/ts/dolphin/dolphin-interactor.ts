import { existsSync, mkdirSync, writeFileSync } from 'fs';
import native from "@/ts/native-module.js";
import { generateTimestampedFilename, getKeyCode, SCREENSHOTS_DIR } from '@/ts/utils.js';
import { execSync } from 'child_process';
import { DolphinMemoryEngine } from '@/ts/dolphin/dolphin-memory-engine.js';

export class DolphinInteractor {
  private static instance: DolphinInteractor;
  private _dolphinMemoryEngine: any;
  private _gameId: string = "";
  private _pid: number = 0;

  constructor() {
    if (DolphinInteractor.instance) {
      throw new Error("DolphinInteractor is a singleton class");
    }
    DolphinInteractor.instance = this;
    this._dolphinMemoryEngine = new DolphinMemoryEngine();
    this._pid = this._dolphinMemoryEngine.getPID();
    this._gameId = this._dolphinMemoryEngine.read(0, 6).toString('utf-8');
  }

  static getInstance(): DolphinInteractor {
    return this.instance;
  }

  get dme() {
    return this._dolphinMemoryEngine;
  }

  get pid() {
    return this._pid;
  }

  get gameId() {
    return this._gameId;
  }

  captureDolphinOffscreen() {
    const imageData = native.dolphinScreenGrab.captureWindowByPID(this.pid, this.gameId);
    
    if (!imageData || !imageData.buffer || imageData.buffer.length === 0) {
      return new Error('Failed to capture window content');
    }
  
    if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const filename = generateTimestampedFilename('screenshot', 'png');
    const outputPath = `${SCREENSHOTS_DIR}/${filename}`;
    writeFileSync(outputPath, imageData.buffer);
    console.error(`Screenshot saved to: ${outputPath}`);
  
    return filename;
  }

  sendKeys(key: string, modifier?: string) {
    const result = native.dolphinSendKeys.sendKeyToWindow(this.pid, this.gameId, getKeyCode(key));
    console.log('SendKeys result:', result);
  }

  // Didn't work rip
  // sendKeysToPID(key: string, modifier?: string): boolean {  
  //   const script = `
  //     tell application "System Events"
  //       set targetProcess to first process whose unix id is ${this.pid}
  //       set targetWindow to null
  //       set foundWindowTitle to ""
        
  //       repeat with w in windows of targetProcess
  //         if name of w contains "${this.gameId}" then
  //           set targetWindow to w
  //           set foundWindowTitle to name of w
  //           exit repeat
  //         end if
  //       end repeat
        
  //       if targetWindow is not null then
  //         tell targetProcess
  //           tell targetWindow
  //             key code ${getKeyCode(key)}${modifier ? ` using ${modifier.toLowerCase()}` : ''} 
  //           end tell
  //         end tell
  //         return foundWindowTitle
  //       else
  //         return "Failed to find window"
  //       end if
  //     end tell
  //   `;
    
  //   try {
  //     const result = execSync(`osascript -e '${script}'`);
  //     console.error(`Keystroke sent to window: ${result}`);
  //     return true;
  //   } catch (e) {
  //     console.error("Failed to send keystroke:", e);
  //     return false;
  //   }
  // }
}
