#!/usr/bin/env bun
/**
 * Raygent - Launch Claude Code in tmux via Raycast (headless)
 *
 * Flow:
 * 1. Generate session name + determine cwd via Claude Sonnet
 * 2. Create unique tmux session in correct directory
 * 3. Send claude command with prompt
 */

import {
  generateSessionConfig,
  loadConfig,
  findExactMatch,
  type SessionConfig,
} from "./lib/router-agent";
import { buildClaudeArgs } from "./lib/claude-cmd";
import {
  createSession,
  sendKeys,
  generateUniqueName,
  hasSession,
  createPane,
  killSession,
} from "./lib/tmux";
import { writeFileSync } from "fs";

async function main() {
  const prompt = process.argv[2];

  if (!prompt) {
    console.error('Usage: raygent.ts "your prompt"');
    process.exit(1);
  }

  try {
    // Check for exact keyword match first (skip router)
    const cfg = await loadConfig();
    const exactMatch = findExactMatch(prompt, cfg);

    let sessionConfig: SessionConfig;
    if (exactMatch) {
      sessionConfig = {
        name: exactMatch.workspace,
        cwd: exactMatch.config.path,
        tmuxSession: exactMatch.config.tmuxSession,
      };
    } else {
      sessionConfig = await generateSessionConfig(prompt);
    }

    let target: string;

    // Scheduled runs carry this marker (injected by agent-scheduler's
    // run-task.sh). They supersede prior fires, so for a fixed session we
    // reap the leftover session instead of stacking another pane — otherwise
    // an interactive Claude that finished its task but idles in the TUI never
    // frees its pane, and successive fires fill the window until `split-window`
    // has no room left ("Failed to create pane in session: ...").
    const isScheduled = prompt.includes("<agent-scheduler");

    if (sessionConfig.tmuxSession) {
      // Fixed session mode
      if (isScheduled && hasSession(sessionConfig.tmuxSession)) {
        // Reap the previous fire's session (kills its idle pane + Claude),
        // then start fresh — one pane per run, never wedges.
        killSession(sessionConfig.tmuxSession);
        createSession(sessionConfig.tmuxSession, sessionConfig.cwd);
        target = sessionConfig.tmuxSession;
        console.log(`Reaped + restarted: ${sessionConfig.tmuxSession} @ ${sessionConfig.cwd}`);
      } else if (hasSession(sessionConfig.tmuxSession)) {
        // Interactive/Raycast use: keep stacking panes (useful for live work).
        target = createPane(sessionConfig.tmuxSession, sessionConfig.cwd);
        console.log(`Added pane to: ${sessionConfig.tmuxSession} @ ${sessionConfig.cwd}`);
      } else {
        createSession(sessionConfig.tmuxSession, sessionConfig.cwd);
        target = sessionConfig.tmuxSession;
        console.log(`Started: ${sessionConfig.tmuxSession} @ ${sessionConfig.cwd}`);
      }
    } else {
      // Default mode: unique session names
      const sessionName = generateUniqueName(sessionConfig.name);
      createSession(sessionName, sessionConfig.cwd);
      target = sessionName;
      console.log(`Started: ${sessionName} @ ${sessionConfig.cwd}`);
    }

    const args = buildClaudeArgs(process.env.CLAUDE_EXTRA_ARGS);
    const promptFile = `/tmp/raygent-prompt-${Date.now()}.txt`;
    writeFileSync(promptFile, prompt);
    sendKeys(target, `claude ${args} -- "$(cat ${promptFile})" && rm ${promptFile}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
