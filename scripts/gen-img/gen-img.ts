#!/usr/bin/env bun
/**
 * gen-img - AI Image Generation
 *
 * Providers:
 * - openai (default): OpenAI gpt-image-2 via OPENAI_API_KEY env var
 * - replicate: Flux 2 Pro via Replicate API key in config.json
 *
 * Flow:
 * 1. Accept prompt + flags
 * 2. Generate descriptive filename via Claude Haiku
 * 3. Call provider to generate image
 * 4. Save to ~/Downloads/{generated-name}.{png|jpg}
 * 5. Show notification and copy path to clipboard
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

type Provider = "openai" | "replicate";

interface ReplicateConfig {
  apiKey: string;
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
}

interface OpenAIImageResponse {
  data: Array<{ b64_json?: string; url?: string }>;
  error?: { message: string };
}

interface Options {
  prompt: string;
  provider: Provider;
  model: string;
  size: string;
  quality: "low" | "medium" | "high" | "auto";
  inputs: string[];
}

const DOWNLOADS_DIR = join(process.env.HOME!, "Downloads");
const CLAUDE_PATH = join(process.env.HOME!, ".local/bin/claude");
const DEFAULT_OPENAI_MODEL = "gpt-image-2";
const DEFAULT_REPLICATE_MODEL = "black-forest-labs/flux-2-pro";

const getImageUrl = (output: string | string[]): string =>
  Array.isArray(output) ? output[0] : output;

function loadReplicateConfig(): ReplicateConfig {
  const configPath = join(import.meta.dir, "config.json");

  if (!existsSync(configPath)) {
    throw new Error(
      "Replicate config not found. Copy config.example.json to config.json and add your Replicate API key.",
    );
  }

  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  if (!config.apiKey) {
    throw new Error("No apiKey found in config.json");
  }

  return config;
}

const fallbackFilename = () => `image-${Date.now()}`;

async function generateFilename(prompt: string): Promise<string> {
  try {
    const proc = Bun.spawn(
      [
        CLAUDE_PATH,
        "-p",
        `Generate a short, descriptive filename (2-4 words, kebab-case, no extension, no quotes) for an image with this prompt: "${prompt}". Output ONLY the filename, nothing else.`,
        "--model",
        "haiku",
        "--output-format",
        "text",
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return fallbackFilename();

    const filename = output
      .trim()
      .replace(/['"]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toLowerCase();

    return filename || fallbackFilename();
  } catch {
    return fallbackFilename();
  }
}

async function generateOpenAI(opts: Options, outputPath: string): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY env var is not set");
  }

  const response =
    opts.inputs.length > 0 ? await openAIEdit(apiKey, opts) : await openAIGenerate(apiKey, opts);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const body: OpenAIImageResponse = await response.json();
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI response missing b64_json");
  }

  await Bun.write(outputPath, Buffer.from(b64, "base64"));
}

async function openAIGenerate(apiKey: string, opts: Options): Promise<Response> {
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      size: opts.size,
      quality: opts.quality,
      n: 1,
    }),
  });
}

async function openAIEdit(apiKey: string, opts: Options): Promise<Response> {
  const form = new FormData();
  form.append("model", opts.model);
  form.append("prompt", opts.prompt);
  form.append("size", opts.size);
  form.append("quality", opts.quality);
  form.append("n", "1");

  for (const path of opts.inputs) {
    if (!existsSync(path)) {
      throw new Error(`Input image not found: ${path}`);
    }
    form.append("image[]", Bun.file(path));
  }

  return fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
}

async function createReplicatePrediction(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { prompt, output_format: "jpg" },
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

  return pollReplicatePrediction(apiKey, prediction.id);
}

async function pollReplicatePrediction(apiKey: string, predictionId: string): Promise<string> {
  const maxAttempts = 60;
  const pollInterval = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
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

async function generateReplicate(opts: Options, outputPath: string): Promise<void> {
  const config = loadReplicateConfig();
  const url = await createReplicatePrediction(config.apiKey, opts.model, opts.prompt);
  await downloadImage(url, outputPath);
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
  const proc = Bun.spawn(["pbcopy"], { stdin: "pipe" });
  proc.stdin.write(text);
  proc.stdin.end();
  await proc.exited;
}

function printHelp(): void {
  console.log(`gen-img - AI Image Generation

USAGE
  gen-img.ts <prompt> [options]
  gen-img.ts --help

OPTIONS
  --provider <openai|replicate>  Image provider (default: openai)
  --model <id>                   Model ID
                                 - openai default:    ${DEFAULT_OPENAI_MODEL}
                                 - replicate default: ${DEFAULT_REPLICATE_MODEL}
  --size <WxH>                   Output size (default: 1024x1024, openai only)
  --quality <low|medium|high|auto>  Quality (default: auto, openai only)
  --input <path>                 Reference image (openai only, repeatable)
                                 Triggers /v1/images/edits (image-to-image)

PROVIDERS
  openai (default)
    Uses OpenAI's image generation endpoint.
    Requires OPENAI_API_KEY env var.
    Output format: PNG. Saved to ~/Downloads/<descriptive-name>.png.

  replicate
    Uses Replicate's predictions API (Flux 2 Pro by default).
    Requires apiKey in config.json (see config.example.json).
    Output format: JPEG. Saved to ~/Downloads/<descriptive-name>.jpg.

BEHAVIOR
  1. Generates a descriptive filename via Claude Haiku
  2. Sends prompt to selected provider
  3. Saves image to ~/Downloads/
  4. Copies file path to clipboard
  5. Shows macOS notification
  6. Prints the output path to stdout

EXAMPLES
  gen-img.ts "a cat wearing a top hat"
  gen-img.ts "minimalist coffee logo, white background" --quality high
  gen-img.ts "neon cyberpunk skyline" --provider replicate
  gen-img.ts "portrait" --size 1024x1536`);
}

function parseArgs(argv: string[]): Options | null {
  let prompt: string | undefined;
  let provider: Provider = "openai";
  let model: string | undefined;
  let size = "1024x1024";
  let quality: Options["quality"] = "auto";
  const inputs: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return null;
    if (arg === "--provider") {
      const value = argv[++i];
      if (value !== "openai" && value !== "replicate") {
        throw new Error(`Invalid --provider: ${value} (expected openai|replicate)`);
      }
      provider = value;
    } else if (arg === "--model") {
      model = argv[++i];
    } else if (arg === "--size") {
      size = argv[++i];
    } else if (arg === "--quality") {
      const value = argv[++i];
      if (value !== "low" && value !== "medium" && value !== "high" && value !== "auto") {
        throw new Error(`Invalid --quality: ${value} (expected low|medium|high|auto)`);
      }
      quality = value;
    } else if (arg === "--input") {
      inputs.push(argv[++i]);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else if (prompt === undefined) {
      prompt = arg;
    } else {
      throw new Error(`Unexpected positional arg: ${arg}`);
    }
  }

  if (!prompt) {
    throw new Error("Missing prompt");
  }

  if (inputs.length > 0 && provider !== "openai") {
    throw new Error("--input is only supported with --provider openai");
  }

  return {
    prompt,
    provider,
    model: model ?? (provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_REPLICATE_MODEL),
    size,
    quality,
    inputs,
  };
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  let opts: Options;
  try {
    const parsed = parseArgs(argv);
    if (!parsed) {
      printHelp();
      process.exit(0);
    }
    opts = parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}\n`);
    printHelp();
    process.exit(1);
  }

  try {
    const ext = opts.provider === "openai" ? "png" : "jpg";
    const filename = await generateFilename(opts.prompt);
    const outputPath = join(DOWNLOADS_DIR, `${filename}.${ext}`);

    if (opts.provider === "openai") {
      await generateOpenAI(opts, outputPath);
    } else {
      await generateReplicate(opts, outputPath);
    }

    await copyToClipboard(outputPath);
    await notify("gen-img", `Saved: ${filename}.${ext}`);

    console.log(outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await notify("gen-img", `Error: ${message}`, false);
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
