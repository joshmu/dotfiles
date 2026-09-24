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
  setSessionOption,
} from "./lib/tmux";
import { writeFileSync } from "fs";
import { randomUUID } from "crypto";
import {
  HERDR_WORKSPACE_LABEL,
  appendRegistry,
  currentHerdrSession,
  ensureServer,
  herdrAvailable,
  openRunTab,
  runInPane,
  runLabel,
} from "./lib/herdr";

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

    // Scheduled runs carry this marker (injected by agent-scheduler's
    // run-task.sh). They get a pre-provisioned Claude session id and are tagged
    // (tmux session options / herdr run registry) so agent-scheduler's reaper can
    // find the transcript and tell a scheduled launch apart from the user's own.
    const isScheduled = prompt.includes("<agent-scheduler");
    const taskId = prompt.match(/<agent-scheduler task-id="([^"]*)"/)?.[1] ?? "scheduled";
    const claudeSessionId = randomUUID();
    let args = buildClaudeArgs(process.env.CLAUDE_EXTRA_ARGS);
    if (isScheduled) args += ` --session-id ${claudeSessionId}`;
    const promptFile = `/tmp/raygent-prompt-${Date.now()}.txt`;
    writeFileSync(promptFile, prompt);
    const claudeCmd = `claude ${args} -- "$(cat ${promptFile})" && rm ${promptFile}`;

    // Scheduled runs can opt into Herdr (AGENT_SCHEDULER_MUX=herdr, set by
    // run-task.sh from schedules.json): one tab per run in a shared workspace.
    // Falls back to tmux when herdr is missing or fails.
    if (isScheduled && process.env.AGENT_SCHEDULER_MUX === "herdr") {
      if (!herdrAvailable()) {
        console.log("herdr not found; falling back to tmux");
      } else {
        try {
          ensureServer();
          const label = runLabel(taskId);
          const { tabId, paneId } = openRunTab(sessionConfig.cwd, label);
          appendRegistry({
            tabId,
            paneId,
            label,
            task: taskId,
            claudeSessionId,
            launched: Math.floor(Date.now() / 1000),
            herdrSession: currentHerdrSession(),
          });
          runInPane(paneId, claudeCmd);
          console.log(
            `Started herdr tab: ${HERDR_WORKSPACE_LABEL}/${label} (${tabId}) @ ${sessionConfig.cwd}`,
          );
          return;
        } catch (e) {
          console.log(
            `herdr launch failed (${e instanceof Error ? e.message : e}); falling back to tmux`,
          );
        }
      }
    }

    let target: string;

    if (sessionConfig.tmuxSession) {
      // Fixed session mode
      if (isScheduled && hasSession(sessionConfig.tmuxSession)) {
        // Scheduled fires supersede prior ones: reap the leftover session
        // instead of stacking panes — an interactive Claude idling in the TUI
        // never frees its pane, and successive fires would fill the window until
        // `split-window` has no room left. One pane per run, never wedges.
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

    if (isScheduled) {
      setSessionOption(target, "sched_task", taskId);
      setSessionOption(target, "sched_claude_session", claudeSessionId);
      setSessionOption(target, "sched_launched", String(Math.floor(Date.now() / 1000)));
    }
    sendKeys(target, claudeCmd);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
