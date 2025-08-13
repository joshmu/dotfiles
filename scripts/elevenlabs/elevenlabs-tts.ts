#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { createHash } from "crypto";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Helper functions for colored output
const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg: string) => console.error(`${colors.red}✗${colors.reset}  ${msg}`),
};

interface Config {
  apiKey: string;
  voiceId: string;
  modelId?: string;
  outputFormat?: string;
  stability?: number;
  similarityBoost?: number;
  cacheDir?: string;
}

interface TTSOptions {
  text: string;
  outputFile?: string;
  voiceId?: string;
  modelId?: string;
  noCache?: boolean;
  format?: string;
}

class ElevenLabsTTS {
  private config: Config;
  private cacheDir: string;

  constructor() {
    this.config = this.loadConfigSync();
    // Expand ~ to home directory if present
    if (this.config.cacheDir && this.config.cacheDir.startsWith("~")) {
      this.cacheDir = this.config.cacheDir.replace("~", process.env.HOME!);
    } else {
      this.cacheDir = this.config.cacheDir || join(process.env.HOME!, ".cache", "elevenlabs");
    }
    this.ensureCacheDir();
  }

  private loadConfigSync(): Config {
    const configPath = join(__dirname, "config.json");
    
    if (!existsSync(configPath)) {
      log.error("Config file not found. Please run setup.sh first.");
      process.exit(1);
    }

    try {
      const configContent = readFileSync(configPath, "utf-8");
      const config = JSON.parse(configContent);
      
      // Check for API key in environment variable as fallback
      if (!config.apiKey && process.env.ELEVENLABS_API_KEY) {
        config.apiKey = process.env.ELEVENLABS_API_KEY;
      }

      if (!config.apiKey) {
        log.error("No API key found. Please set ELEVENLABS_API_KEY or run setup.sh");
        process.exit(1);
      }

      return config;
    } catch (error) {
      log.error(`Failed to load config: ${error}`);
      process.exit(1);
    }
  }

  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCacheFileName(text: string, voiceId: string): string {
    const hash = createHash("md5").update(`${text}-${voiceId}`).digest("hex");
    return join(this.cacheDir, `${hash}.mp3`);
  }

  async generateSpeech(options: TTSOptions): Promise<string> {
    const voiceId = options.voiceId || this.config.voiceId;
    const modelId = options.modelId || this.config.modelId || "eleven_turbo_v2_5";
    const format = options.format || this.config.outputFormat || "mp3_44100_128";

    // Check cache first
    if (!options.noCache) {
      const cacheFile = this.getCacheFileName(options.text, voiceId);
      if (existsSync(cacheFile)) {
        log.info("Using cached audio");
        
        // If specific output file requested, copy from cache
        if (options.outputFile) {
          await $`cp ${cacheFile} ${options.outputFile}`.quiet();
          return options.outputFile;
        }
        return cacheFile;
      }
    }

    // Prepare the request
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format}`;
    
    const requestBody = {
      text: options.text,
      model_id: modelId,
      voice_settings: {
        stability: this.config.stability || 0.5,
        similarity_boost: this.config.similarityBoost || 0.75,
      },
    };

    log.info("Generating speech with ElevenLabs...");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": this.config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error (${response.status}): ${error}`);
      }

      // Get the audio data
      const audioBuffer = await response.arrayBuffer();
      
      // Determine output file
      let outputPath: string;
      if (options.outputFile) {
        outputPath = resolve(options.outputFile);
      } else {
        outputPath = this.getCacheFileName(options.text, voiceId);
      }

      // Save the audio file
      await Bun.write(outputPath, audioBuffer);
      
      // Also save to cache if not already there
      if (!options.noCache && options.outputFile) {
        const cacheFile = this.getCacheFileName(options.text, voiceId);
        await Bun.write(cacheFile, audioBuffer);
      }

      log.success(`Audio saved to: ${outputPath}`);
      return outputPath;

    } catch (error) {
      log.error(`Failed to generate speech: ${error}`);
      throw error;
    }
  }

  async listVoices(): Promise<void> {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": this.config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log("\nAvailable Voices:");
      console.log("─".repeat(60));
      
      for (const voice of data.voices) {
        console.log(`${colors.cyan}${voice.name}${colors.reset}`);
        console.log(`  ID: ${voice.voice_id}`);
        if (voice.labels) {
          const labels = Object.entries(voice.labels)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
          console.log(`  Labels: ${labels}`);
        }
        console.log("");
      }
    } catch (error) {
      log.error(`Failed to list voices: ${error}`);
      process.exit(1);
    }
  }

  async clearCache(): Promise<void> {
    try {
      await $`rm -rf ${this.cacheDir}/*`.quiet();
      log.success("Cache cleared");
    } catch (error) {
      log.error(`Failed to clear cache: ${error}`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
ElevenLabs Text-to-Speech CLI

Usage:
  elevenlabs-tts <text>                  Generate speech from text
  elevenlabs-tts --file <input> <output> Generate speech from file
  elevenlabs-tts --list-voices           List available voices
  elevenlabs-tts --clear-cache           Clear the audio cache
  
Options:
  --output, -o <file>    Output file path (default: cached)
  --voice, -v <id>       Voice ID to use
  --model, -m <id>       Model ID (default: eleven_turbo_v2_5)
  --no-cache             Don't use cached audio
  --format <fmt>         Output format (default: mp3_44100_128)
  
Examples:
  elevenlabs-tts "Hello, world!"
  elevenlabs-tts "Your build is complete" -o notification.mp3
  elevenlabs-tts --file input.txt output.mp3
  echo "Test message" | elevenlabs-tts
`);
    process.exit(0);
  }

  const tts = new ElevenLabsTTS();

  // Handle special commands
  if (args.includes("--list-voices")) {
    await tts.listVoices();
    process.exit(0);
  }

  if (args.includes("--clear-cache")) {
    await tts.clearCache();
    process.exit(0);
  }

  // Parse options
  const options: TTSOptions = {
    text: "",
    noCache: args.includes("--no-cache"),
  };

  // Handle file input
  if (args.includes("--file")) {
    const fileIndex = args.indexOf("--file");
    const inputFile = args[fileIndex + 1];
    const outputFile = args[fileIndex + 2];
    
    if (!inputFile || !outputFile) {
      log.error("--file requires input and output file paths");
      process.exit(1);
    }

    try {
      const file = Bun.file(inputFile);
      options.text = await file.text();
      options.outputFile = outputFile;
    } catch (error) {
      log.error(`Failed to read input file: ${error}`);
      process.exit(1);
    }
  } else {
    // Parse text and options
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === "--output" || arg === "-o") {
        options.outputFile = args[++i];
      } else if (arg === "--voice" || arg === "-v") {
        options.voiceId = args[++i];
      } else if (arg === "--model" || arg === "-m") {
        options.modelId = args[++i];
      } else if (arg === "--format") {
        options.format = args[++i];
      } else if (!arg.startsWith("-")) {
        options.text = arg;
      }
    }

    // If no text provided, try to read from stdin
    if (!options.text) {
      try {
        options.text = await Bun.stdin.text();
        options.text = options.text.trim();
      } catch {
        // No stdin available
      }
    }

    if (!options.text) {
      log.error("No text provided. Use --help for usage information.");
      process.exit(1);
    }
  }

  try {
    const outputPath = await tts.generateSpeech(options);
    
    // Output just the path for easy piping to other commands
    console.log(outputPath);
    
  } catch (error) {
    log.error(`Failed to generate speech: ${error}`);
    process.exit(1);
  }
}

// Run the CLI
if (import.meta.main) {
  main().catch((error) => {
    log.error(`Unexpected error: ${error}`);
    process.exit(1);
  });
}

export { ElevenLabsTTS };