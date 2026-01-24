#!/usr/bin/env bun
/**
 * gen-img - AI Image Generation via Raycast
 *
 * Flow:
 * 1. Accept prompt from argument
 * 2. Generate descriptive filename via Claude Haiku
 * 3. Call Replicate API (Google Imagen 4) to generate image
 * 4. Poll for completion, download image
 * 5. Save to ~/Downloads/{generated-name}.jpg
 * 6. Show notification and copy path to clipboard
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface Config {
  apiKey: string;
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
}

const getImageUrl = (output: string | string[]): string =>
  Array.isArray(output) ? output[0] : output;

const DOWNLOADS_DIR = join(process.env.HOME!, "Downloads");
const REPLICATE_MODEL = "google/imagen-4";
const CLAUDE_PATH = join(process.env.HOME!, ".local/bin/claude");

function loadConfig(): Config {
  const configPath = join(import.meta.dir, "config.json");

  if (!existsSync(configPath)) {
    throw new Error("Config file not found. Copy config.example.json to config.json and add your API key.");
  }

  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  if (!config.apiKey) {
    throw new Error("No API key found in config.json");
  }

  return config;
}

const fallbackFilename = () => `image-${Date.now()}`;

async function generateFilename(prompt: string): Promise<string> {
  try {
    const proc = Bun.spawn([
      CLAUDE_PATH,
      "-p",
      `Generate a short, descriptive filename (2-4 words, kebab-case, no extension, no quotes) for an image with this prompt: "${prompt}". Output ONLY the filename, nothing else.`,
      "--model",
      "haiku",
      "--output-format",
      "text",
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return fallbackFilename();

    const filename = output.trim()
      .replace(/['"]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toLowerCase();

    return filename || fallbackFilename();
  } catch {
    return fallbackFilename();
  }
}

async function createPrediction(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { prompt },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error (${response.status}): ${error}`);
  }

  const prediction: ReplicatePrediction = await response.json();

  if (prediction.status === "succeeded" && prediction.output) {
    return getImageUrl(prediction.output);
  }

  return pollPrediction(apiKey, prediction.id);
}

async function pollPrediction(apiKey: string, predictionId: string): Promise<string> {
  const maxAttempts = 60;
  const pollInterval = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to poll prediction: ${response.statusText}`);
    }

    const prediction: ReplicatePrediction = await response.json();

    if (prediction.status === "succeeded" && prediction.output) {
      return getImageUrl(prediction.output);
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error || "Image generation failed");
    }

    await Bun.sleep(pollInterval);
  }

  throw new Error("Timeout waiting for image generation");
}

async function downloadImage(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await Bun.write(outputPath, buffer);
}

const escapeAppleScript = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

async function notify(title: string, message: string, success = true): Promise<void> {
  try {
    const sound = success ? "Glass" : "Basso";
    const escapedTitle = escapeAppleScript(title);
    const escapedMessage = escapeAppleScript(message);
    await Bun.spawn([
      "osascript",
      "-e",
      `display notification "${escapedMessage}" with title "${escapedTitle}" sound name "${sound}"`,
    ]).exited;
  } catch {}
}

async function copyToClipboard(text: string): Promise<void> {
  const proc = Bun.spawn(["pbcopy"], {
    stdin: "pipe",
  });
  proc.stdin.write(text);
  proc.stdin.end();
  await proc.exited;
}

async function main() {
  const prompt = process.argv[2];

  if (!prompt) {
    console.error('Usage: gen-img.ts "your image prompt"');
    process.exit(1);
  }

  try {
    const config = loadConfig();
    const [filename, imageUrl] = await Promise.all([
      generateFilename(prompt),
      createPrediction(config.apiKey, prompt),
    ]);

    const outputPath = join(DOWNLOADS_DIR, `${filename}.jpg`);
    await downloadImage(imageUrl, outputPath);

    await copyToClipboard(outputPath);
    await notify("gen-img", `Saved: ${filename}.jpg`);

    console.log(outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await notify("gen-img", `Error: ${message}`, false);
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
