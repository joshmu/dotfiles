#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { ElevenLabsTTS } from "./elevenlabs-tts";

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

interface NotificationOptions {
  session?: string;
  event?: string;
  message?: string;
  voiceId?: string;
  outputDir?: string;
  play?: boolean;
}

class NotificationSoundGenerator {
  private tts: ElevenLabsTTS;
  private soundsDir: string;

  constructor() {
    this.tts = new ElevenLabsTTS();
    this.soundsDir = join(process.env.HOME!, ".claude", "sounds");
    this.ensureSoundsDir();
  }

  private ensureSoundsDir(): void {
    if (!existsSync(this.soundsDir)) {
      mkdirSync(this.soundsDir, { recursive: true });
    }
  }

  private getNotificationText(options: NotificationOptions): string {
    if (options.message) {
      return options.message;
    }

    const parts: string[] = [];

    // Base greeting
    if (options.session) {
      parts.push(`Claude is ready in ${options.session.toLowerCase()} session`);
    } else {
      parts.push("Claude is ready");
    }

    // Add event type if specified
    if (options.event) {
      switch (options.event.toLowerCase()) {
        case "complete":
        case "done":
          parts.push("Task completed");
          break;
        case "error":
          parts.push("Error occurred");
          break;
        case "start":
          parts.push("Starting task");
          break;
        case "stop":
          parts.push("Session ended");
          break;
        default:
          parts.push(options.event);
      }
    }

    return parts.join(". ");
  }

  async generateSound(options: NotificationOptions): Promise<string> {
    const text = this.getNotificationText(options);
    const filename = this.getFileName(options);
    const outputPath = join(options.outputDir || this.soundsDir, filename);

    log.info(`Generating: "${text}"`);

    try {
      await this.tts.generateSpeech({
        text,
        outputFile: outputPath,
        voiceId: options.voiceId,
        modelId: "eleven_turbo_v2_5", // Use fast model for notifications
      });

      if (options.play) {
        await this.playSound(outputPath);
      }

      return outputPath;
    } catch (error) {
      log.error(`Failed to generate sound: ${error}`);
      throw error;
    }
  }

  private getFileName(options: NotificationOptions): string {
    const parts: string[] = ["claude"];

    if (options.session) {
      parts.push(options.session.toLowerCase());
    }

    if (options.event) {
      parts.push(options.event.toLowerCase());
    }

    // Add timestamp to ensure uniqueness if custom message
    if (options.message) {
      parts.push(Date.now().toString());
    }

    return `${parts.join("-")}.mp3`;
  }

  async playSound(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      log.error(`Sound file not found: ${filePath}`);
      return;
    }

    try {
      // Use afplay on macOS
      await $`afplay ${filePath}`.quiet();
      log.success("Sound played");
    } catch (error) {
      log.error(`Failed to play sound: ${error}`);
    }
  }

  async generateCommonSounds(): Promise<void> {
    const commonNotifications = [
      { event: "ready", message: "Claude is ready" },
      { event: "complete", message: "Task completed successfully" },
      { event: "error", message: "An error has occurred" },
      { event: "stop", message: "Session ended" },
      { event: "start", message: "Starting new task" },
      { event: "test", message: "Test complete" },
      { event: "build", message: "Build finished" },
      { event: "deploy", message: "Deployment complete" },
    ];

    log.info("Generating common notification sounds...");

    for (const notification of commonNotifications) {
      try {
        const path = await this.generateSound(notification);
        log.success(`Generated: ${notification.event} → ${path}`);
      } catch (error) {
        log.error(`Failed to generate ${notification.event}: ${error}`);
      }
    }
  }

  async generateSessionSounds(sessions: string[]): Promise<void> {
    log.info("Generating session-specific sounds...");

    for (const session of sessions) {
      const notifications = [
        { session, event: "ready" },
        { session, event: "complete" },
        { session, event: "error" },
      ];

      for (const notification of notifications) {
        try {
          const path = await this.generateSound(notification);
          log.success(`Generated: ${session}/${notification.event} → ${path}`);
        } catch (error) {
          log.error(`Failed to generate ${session}/${notification.event}: ${error}`);
        }
      }
    }
  }

  async listSounds(): Promise<void> {
    try {
      const result = await $`ls -la ${this.soundsDir}/*.mp3 2>/dev/null || echo "No sounds found"`.quiet();
      const output = result.stdout.toString();
      
      if (output.includes("No sounds found")) {
        log.warn("No generated sounds found");
        console.log(`Run '${process.argv[1]} --generate' to create sounds`);
      } else {
        console.log("\nGenerated Sounds:");
        console.log("─".repeat(60));
        console.log(output);
      }
    } catch (error) {
      log.error(`Failed to list sounds: ${error}`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Notification Sound Generator for Claude Code

Usage:
  generate-notification-sound [options]

Options:
  --generate             Generate common notification sounds
  --session <name>       Generate sounds for specific session
  --sessions <s1,s2>     Generate sounds for multiple sessions
  --message <text>       Custom message to speak
  --event <type>         Event type (ready, complete, error, etc.)
  --voice <id>           Voice ID to use
  --output-dir <path>    Output directory (default: ~/.claude/sounds)
  --play                 Play the generated sound
  --list                 List all generated sounds

Examples:
  # Generate all common sounds
  ./generate-notification-sound.ts --generate

  # Generate for specific tmux session
  ./generate-notification-sound.ts --session dev --event ready --play

  # Custom message
  ./generate-notification-sound.ts --message "Your build is complete" --play

  # Generate for multiple sessions
  ./generate-notification-sound.ts --sessions "dev,prod,test"

  # List existing sounds
  ./generate-notification-sound.ts --list
`);
    process.exit(0);
  }

  const generator = new NotificationSoundGenerator();

  // Handle list command
  if (args.includes("--list")) {
    await generator.listSounds();
    process.exit(0);
  }

  // Handle generate common sounds
  if (args.includes("--generate")) {
    await generator.generateCommonSounds();
    
    // Also check for sessions to generate
    const sessionsIndex = args.indexOf("--sessions");
    if (sessionsIndex !== -1 && args[sessionsIndex + 1]) {
      const sessions = args[sessionsIndex + 1].split(",");
      await generator.generateSessionSounds(sessions);
    }
    
    process.exit(0);
  }

  // Parse options for single sound generation
  const options: NotificationOptions = {
    play: args.includes("--play"),
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case "--session":
        options.session = args[++i];
        break;
      case "--event":
        options.event = args[++i];
        break;
      case "--message":
        options.message = args[++i];
        break;
      case "--voice":
        options.voiceId = args[++i];
        break;
      case "--output-dir":
        options.outputDir = args[++i];
        break;
      case "--sessions":
        const sessions = args[++i].split(",");
        await generator.generateSessionSounds(sessions);
        process.exit(0);
    }
  }

  // Generate single sound if options provided
  if (options.message || options.session || options.event) {
    try {
      const path = await generator.generateSound(options);
      console.log(path); // Output path for scripting
    } catch (error) {
      log.error(`Failed to generate sound: ${error}`);
      process.exit(1);
    }
  } else {
    log.warn("No action specified. Use --help for usage information.");
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