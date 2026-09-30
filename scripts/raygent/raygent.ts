#!/usr/bin/env bun
/**
 * Raygent - Launch Claude Code from Raycast
 *
 * Flow:
 * 1. Name the session (and pick a cwd unless the machine pins one) via the Haiku router
 * 2. Raycast prompts: named Herdr agent in the "slack" (Slack context) or "raycast"
 *    workspace when config.launch.mux
 *    is "herdr", else tmux. Scheduled prompts: tmux, or Herdr "schedules" when opted in.
 * 3. Deliver the prompt
 */

import {
  generateSessionConfig,
  loadConfig,
  findExactMatch,
  type Config,
  type SessionConfig,
} from "./lib/router-agent";
import { buildClaudeArgs, buildClaudeArgv } from "./lib/claude-cmd";
import { launchWorkspace, resolveLaunch } from "./lib/launch";
import { toAgentName, uniqueAgentName } from "./lib/agent-name";
import {
  SLACK_TOKEN,
  findSlackAgent,
  focusAgent,
  liveAgents,
  promptAgent,
  reinject,
  spawnAgent,
} from "./lib/herdr-agent";
import { pickSlackRef, slackKey, withSlackContext } from "./lib/slack-link";
import { resolveLabel, workspaceFor } from "./lib/slack";
import {
  clipboardChangeCount,
  clipboardChangedSinceLastLaunch,
  readClipboard,
  recordClipboardSeen,
} from "./lib/clipboard";
import { notify } from "./lib/notify";
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

interface SlackTarget {
  key: string;
  label: string;
}

/** Slack link from the prompt or a freshly copied clipboard; names the session and adds context. */
async function resolveSlack(
  rawPrompt: string,
  cfg: Config,
  isScheduled: boolean,
): Promise<{ prompt: string; routingPrompt: string; slack?: SlackTarget }> {
  if (isScheduled) return { prompt: rawPrompt, routingPrompt: rawPrompt };
  const count = clipboardChangeCount();
  const picked = pickSlackRef({
    prompt: rawPrompt,
    clipboard: readClipboard(),
    clipboardChanged: clipboardChangedSinceLastLaunch(count),
    isScheduled,
  });
  recordClipboardSeen(count);
  if (!picked.ref) return { prompt: picked.prompt, routingPrompt: picked.prompt };
  const key = slackKey(picked.ref);
  const label =
    (await resolveLabel(key, picked.ref, cfg.slack)) ??
    `slack-${picked.ref.channelId.toLowerCase()}`;
  console.log(`slack: ${key} -> ${label}${picked.fromClipboard ? " (clipboard)" : ""}`);
  return {
    prompt: withSlackContext(
      picked.prompt,
      picked.ref,
      workspaceFor(picked.ref, cfg.slack)?.mcpServer,
    ),
    routingPrompt: picked.prompt,
    slack: { key, label },
  };
}

async function main() {
  const rawPrompt = process.argv[2];

  if (!rawPrompt) {
    console.error('Usage: raygent.ts "your prompt"');
    process.exit(1);
  }

  try {
    const cfg = await loadConfig();
    // Scheduled runs carry this marker (injected by agent-scheduler's
    // run-task.sh). They get a pre-provisioned Claude session id and are tagged
    // (tmux session options / herdr run registry) so agent-scheduler's reaper can
    // find the transcript and tell a scheduled launch apart from the user's own.
    const isScheduled = rawPrompt.includes("<agent-scheduler");
    const taskId = rawPrompt.match(/<agent-scheduler task-id="([^"]*)"/)?.[1] ?? "scheduled";
    const launch = resolveLaunch(cfg, isScheduled);
    const { prompt, routingPrompt, slack } = await resolveSlack(rawPrompt, cfg, isScheduled);

    // Exact keyword match first; a Slack name with a pinned cwd needs no router at all.
    const exactMatch = findExactMatch(routingPrompt, cfg);
    let sessionConfig: SessionConfig;
    if (exactMatch) {
      sessionConfig = {
        name: exactMatch.workspace,
        cwd: exactMatch.config.path,
        tmuxSession: exactMatch.config.tmuxSession,
      };
    } else if (slack && launch.fixedCwd) {
      sessionConfig = { name: slack.label, cwd: launch.fixedCwd };
    } else {
      sessionConfig = await generateSessionConfig(routingPrompt);
    }
    if (slack) sessionConfig.name = slack.label;
    if (launch.fixedCwd) sessionConfig.cwd = launch.fixedCwd;

    const claudeSessionId = randomUUID();
    if (launch.mux === "herdr" && herdrAvailable()) {
      if (launchInHerdr(prompt, sessionConfig, claudeSessionId, launch.focus, slack)) return;
    }

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
            kind: "schedule",
            workspaceLabel: HERDR_WORKSPACE_LABEL,
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
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    notify(`Launch failed: ${msg.slice(0, 150)}`);
    process.exit(1);
  }
}

/**
 * Raycast prompt as a named Herdr agent. Returns false only when nothing was
 * launched, so the caller can fall back to tmux without duplicating the session.
 */
function launchInHerdr(
  prompt: string,
  sessionConfig: SessionConfig,
  claudeSessionId: string,
  focus: boolean,
  slack?: SlackTarget,
): boolean {
  let name: string;
  try {
    ensureServer();
    const agents = liveAgents();
    const existing = slack && findSlackAgent(agents, slack.key, toAgentName(slack.label));
    if (existing) {
      const target = existing.name ?? existing.paneId;
      const outcome = reinject(target, prompt);
      console.log(`re-inject ${target}: ${outcome}`);
      notify(`${target} ← ${outcome === "delivered" ? "re-injected" : outcome}`);
      if (focus) focusAgent(target);
      return true;
    }
    const taken = agents.flatMap((a) => (a.name ? [a.name] : []));
    name = uniqueAgentName(toAgentName(sessionConfig.name), taken);
    const argv = [
      ...buildClaudeArgv(process.env.CLAUDE_EXTRA_ARGS),
      "--session-id",
      claudeSessionId,
      "-n",
      name,
    ];
    const workspaceLabel = launchWorkspace(Boolean(slack));
    const { tabId, paneId } = spawnAgent({
      name,
      workspaceLabel,
      cwd: sessionConfig.cwd,
      claudeArgv: argv,
      tokens: slack ? { [SLACK_TOKEN]: slack.key } : undefined,
    });
    appendRegistry({
      tabId,
      paneId,
      label: name,
      task: "raygent",
      claudeSessionId,
      launched: Math.floor(Date.now() / 1000),
      herdrSession: currentHerdrSession(),
      kind: "raygent",
      workspaceLabel,
      agentName: name,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`herdr launch failed (${msg}); falling back to tmux`);
    notify(`Herdr unavailable, using tmux: ${msg.slice(0, 120)}`);
    return false;
  }
  try {
    promptAgent(name, prompt);
    console.log(
      `Started herdr agent: ${launchWorkspace(Boolean(slack))}/${name} @ ${sessionConfig.cwd}`,
    );
    notify(`${name} ← new`);
    if (focus) focusAgent(name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`prompt to ${name} failed: ${msg}`);
    notify(`${name} started but the prompt was not delivered: ${msg.slice(0, 100)}`);
  }
  return true;
}

main();
