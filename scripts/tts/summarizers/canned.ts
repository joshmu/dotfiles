#!/usr/bin/env bun

interface Ctx {
  hookEvent?: string;
  sessionName?: string;
  windowName?: string;
  message?: string;
}

const eventPhrases: Record<string, string> = {
  Stop: "finished",
  SubagentStop: "agent completed",
  UserPromptSubmit: "needs your assistance",
  PreToolUse: "needs your permission",
  PostToolUse: "completed task",
  Notification: "ready",
};

function messageSegment(message: string): string {
  const lower = message.toLowerCase();
  if (/^(done|complete|completed)$/i.test(lower)) return "done";
  // Otherwise use the raw message verbatim — preserves intent
  // (e.g. "Claude is waiting for your input").
  return message;
}

export function pickPhrase(ctx: Ctx): string {
  const session = (ctx.sessionName || "").trim().toLowerCase();
  const window = (ctx.windowName || "").trim();

  let msg: string;
  if (ctx.message) {
    msg = messageSegment(ctx.message);
  } else {
    msg = (ctx.hookEvent && eventPhrases[ctx.hookEvent]) || "requires attention";
  }

  if (!session) return msg || "notification";
  const prefix = window ? `${session}-${window}` : session;
  return `${prefix} - ${msg}`;
}

async function main() {
  if (process.stdin.isTTY && !process.argv.slice(2).length) {
    process.exit(0);
  }
  const input = await Bun.stdin.text();
  let ctx: Ctx = {};
  try {
    const parsed = JSON.parse(input || "{}");
    ctx = parsed.ctx || parsed;
  } catch {}
  console.log(pickPhrase(ctx));
}

if (import.meta.main) {
  main().catch((e) => {
    if (process.env.DEBUG) console.error(e);
    process.exit(1);
  });
}
