#!/usr/bin/env bun
export {};

interface TranscriptResponse {
  transcript?: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
  error?: string;
}

interface VideoMetadata {
  title?: string;
  description?: string;
  channel?: string;
}

interface ScriptOutput {
  success: boolean;
  videoId?: string;
  url?: string;
  title?: string;
  description?: string;
  channel?: string;
  transcript?: string;
  fallback?: boolean;
  error?: string;
}

function extractVideoId(url: string): string | null {
  // Remove leading/trailing whitespace
  url = url.trim();

  // Try different patterns to extract video ID
  const patterns = [
    // youtube.com/watch?v=VIDEO_ID
    /[?&]v=([a-zA-Z0-9_-]{11})(?:[&\s]|$)/,
    // youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/,
    // youtube.com/embed/VIDEO_ID
    /\/embed\/([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/,
    // youtube.com/v/VIDEO_ID
    /\/v\/([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/,
    // youtube.com/shorts/VIDEO_ID
    /\/shorts\/([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/,
    // youtube.com/live/VIDEO_ID
    /\/live\/([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/,
    // User/channel URLs with video ID at the end
    /[#/]([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

async function fetchTranscript(videoId: string): Promise<TranscriptResponse> {
  const apiUrl = `https://www.youtubevideotranscripts.com/api/transcript?videoId=${videoId}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(
      `Failed to fetch transcript: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function fetchTranscriptViaPython(videoId: string): Promise<TranscriptResponse> {
  const pythonScript = `
import json
from youtube_transcript_api import YouTubeTranscriptApi
ytt = YouTubeTranscriptApi()
transcript = ytt.fetch("${videoId}")
result = [{"text": t.text, "start": t.start, "duration": t.duration} for t in transcript]
print(json.dumps({"transcript": result}))
`;
  const proc = Bun.spawn(["python3", "-c", pythonScript], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Python fallback failed: ${stderr.trim()}`);
  }
  const output = await new Response(proc.stdout).text();
  return JSON.parse(output.trim());
}

async function fetchTranscriptChain(
  videoId: string,
): Promise<{ data: TranscriptResponse; fallback: boolean }> {
  try {
    const data = await fetchTranscript(videoId);
    if (data.error) {
      throw new Error(data.error);
    }
    return { data, fallback: false };
  } catch {
    const data = await fetchTranscriptViaPython(videoId);
    return { data, fallback: true };
  }
}

async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const proc = Bun.spawn(["yt-dlp", "--dump-json", "--no-download", url], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`yt-dlp failed: ${stderr.trim()}`);
  }
  const output = await new Response(proc.stdout).text();
  const json = JSON.parse(output.trim());
  return {
    title: json.title,
    description: json.description,
    channel: json.channel,
  };
}

function formatTranscript(data: TranscriptResponse): string {
  if (!data.transcript || !Array.isArray(data.transcript)) {
    return "";
  }

  // Join all transcript segments into a single text
  return data.transcript
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    const output: ScriptOutput = {
      success: false,
      error: "Please provide a YouTube URL as an argument",
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  const url = args[0];
  const videoId = extractVideoId(url);

  if (!videoId) {
    const output: ScriptOutput = {
      success: false,
      error: `Could not extract video ID from URL: ${url}`,
      url,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  // Validate video ID length
  if (videoId.length !== 11) {
    const output: ScriptOutput = {
      success: false,
      error: `Invalid video ID length. YouTube video IDs should be exactly 11 characters. Got: ${videoId}`,
      videoId,
      url,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  // Fetch metadata and transcript in parallel
  const [metadataResult, transcriptResult] = await Promise.allSettled([
    fetchVideoMetadata(videoId),
    fetchTranscriptChain(videoId),
  ]);

  // Handle transcript failure
  if (transcriptResult.status === "rejected") {
    const output: ScriptOutput = {
      success: false,
      error: transcriptResult.reason?.message ?? "Failed to fetch transcript",
      videoId,
      url,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  const { data, fallback } = transcriptResult.value;
  const transcriptText = formatTranscript(data);

  if (!transcriptText) {
    const output: ScriptOutput = {
      success: false,
      error: "No transcript data found. The video may not have captions available.",
      videoId,
      url,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  const metadata = metadataResult.status === "fulfilled" ? metadataResult.value : {};

  const output: ScriptOutput = {
    success: true,
    videoId,
    url,
    ...metadata,
    transcript: transcriptText,
  };
  if (fallback) {
    output.fallback = true;
  }

  console.log(JSON.stringify(output, null, 2));
}

main();
