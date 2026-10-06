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
import { launchWorkspace, resolveLaunch, type LaunchPlan } from "./lib/launch";
import { matchAgent } from "./lib/agent-target";
import { toAgentName, uniqueAgentName } from "./lib/agent-name";
import {
  SLACK_TOKEN,
  findSlackAgent,
  focusAgent,
  liveAgents,
  promptAgent,
  reinject,
  spawnAgent,
  unbindSlackAgent,
} from "./lib/herdr-agent";
import { pickSlackRef, slackKey, withSlackContext } from "./lib/slack-link";
import {
  adoptLiveAgents,
  planSlackLaunch,
  readSessions,
  transcriptLastActive,
  writeSessions,
} from "./lib/slack-sessions";
import { resolveLabel, workspaceFor } from "./lib/slack";
import { readClipboardState } from "./lib/clipboard";
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
import { existsSync, writeFileSync } from "fs";
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
  fresh: boolean;
}

interface Resolved {
  prompt: string; // what the agent receives (Slack context prepended when bound)
  routingPrompt: string; // the user's words, commands removed
  slack?: SlackTarget;
  target?: string; // `:<query>`
  fresh: boolean;
  slackMod: boolean; // `s`: the prompt asked for the copied Slack link
}

/** Slack link typed in the prompt, or with `s` the latest copied one; names the session. */
async function resolveSlack(
  rawPrompt: string,
  cfg: Config,
  isScheduled: boolean,
): Promise<Resolved> {
  if (isScheduled)
    return { prompt: rawPrompt, routingPrompt: rawPrompt, fresh: false, slackMod: false };
  const picked = pickSlackRef({ prompt: rawPrompt, clipboard: readClipboardState, isScheduled });
  const base = {
    routingPrompt: picked.prompt,
    target: picked.target,
    fresh: picked.fresh,
    slackMod: picked.mods.includes("slack"),
  };
  if (!picked.ref) return { ...base, prompt: picked.prompt };
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
    slack: { key, label, fresh: picked.fresh },
    ...base,
  };
}

/**
 * `:<query>`: send to the existing agent the picker ranks first. On no match nothing
 * launches and the prompt goes to the clipboard so it isn't lost. With `s` the prompt
 * carries the copied link's Slack context. Returns whether the prompt was dispatched.
 */
function sendToTarget(query: string, r: Resolved, launch: LaunchPlan): boolean {
  const miss = (why: string) => {
    Bun.spawnSync(["pbcopy"], { stdin: new Blob([r.routingPrompt]) });
    console.log(`:${query}: ${why}; prompt copied to the clipboard`);
    notify(`:${query} ${why}. Prompt copied to the clipboard.`);
    return false;
  };
  if (launch.mux !== "herdr" || !herdrAvailable()) return miss("needs Herdr");
  try {
    ensureServer();
  } catch (e) {
    return miss(`Herdr unavailable (${e instanceof Error ? e.message : e})`);
  }
  const pane = matchAgent(query);
  if (!pane) return miss("matched no agent");
  const agent = liveAgents().find((a) => a.paneId === pane);
  const label = agent?.name ?? pane;
  const outcome = reinject(agent?.name ?? pane, r.prompt);
  console.log(`:${query} -> ${label}: ${outcome}${r.slack ? ` (slack ${r.slack.key})` : ""}`);
  notify(`${label} ← :${query}${outcome === "delivered" ? "" : ` (${outcome})`}`);
  if (launch.focus) focusAgent(agent?.name ?? pane);
  return true;
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
    const resolved = await resolveSlack(rawPrompt, cfg, isScheduled);
    const { prompt, routingPrompt, slack } = resolved;

    if (resolved.slackMod && !slack) {
      // `s` asked for Slack context; don't launch without it. Keep the prompt for a retry.
      Bun.spawnSync(["pbcopy"], { stdin: new Blob([rawPrompt]) });
      console.log("s: no Slack link copied; prompt copied to the clipboard");
      notify("s: no Slack link copied. Prompt copied to the clipboard.");
      return;
    }
    if (resolved.target) {
      sendToTarget(resolved.target, resolved, launch);
      return;
    }

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
    // agent-scheduler's run-task.sh logs this id so its health monitor can read
    // the run's transcript (~/.claude/projects/*/<id>.jsonl) and judge the outcome.
    if (isScheduled) console.log(`claude-session: ${claudeSessionId}`);
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
    // A herdr failure fails the run (exit 1, so run-task.sh logs FAIL) rather
    // than falling back to tmux, where an unattended run goes unnoticed.
    if (isScheduled && process.env.AGENT_SCHEDULER_MUX === "herdr") {
      if (!herdrAvailable()) throw new Error("herdr not found on PATH");
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
        const msg = e instanceof Error ? e.message : String(e);
        // After a herdr upgrade the running server speaks an older protocol until
        // it is restarted. Restarting it kills every live pane, so leave that to the user.
        // The hint leads because the launch-failed notification truncates the message.
        const hint = msg.includes("protocol_mismatch")
          ? "herdr server is older than the client, restart it (herdr server stop && herdr): "
          : "";
        throw new Error(`${hint}herdr launch failed (${msg})`);
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
  let verb = "new";
  let launchedCwd = sessionConfig.cwd;
  try {
    ensureServer();
    const agents = liveAgents();
    let sessions = slack ? adoptLiveAgents(readSessions(), agents) : {};
    const stored = slack ? sessions[slack.key] : undefined;
    const plan = slack
      ? planSlackLaunch({
          live: findSlackAgent(agents, slack.key, toAgentName(slack.label)),
          stored,
          lastActiveMs: stored ? transcriptLastActive(stored.sessionId) : null,
          fresh: slack.fresh,
          now: Date.now(),
        })
      : ({ kind: "fresh" } as const);

    if (plan.kind === "reinject") {
      const target = plan.agent.name ?? plan.agent.paneId;
      const outcome = reinject(target, prompt);
      console.log(`re-inject ${target}: ${outcome}`);
      notify(`${target} ← ${outcome === "delivered" ? "re-injected" : outcome}`);
      if (focus) focusAgent(target);
      if (slack) writeSessions(sessions);
      return true;
    }

    // `:new` while a tab is open: the old agent stays, unbound from the conversation.
    const live = slack && findSlackAgent(agents, slack.key, toAgentName(slack.label));
    if (live && plan.kind === "fresh") unbindSlackAgent(live.paneId);
    const resume = plan.kind === "resume" ? plan.session : undefined;
    const taken = agents.flatMap((a) => (a.name ? [a.name] : []));
    name = uniqueAgentName(toAgentName(resume?.name ?? sessionConfig.name), taken);
    const sessionId = resume?.sessionId ?? claudeSessionId;
    const cwd = resume && existsSync(resume.cwd) ? resume.cwd : sessionConfig.cwd;
    const argv = [
      ...buildClaudeArgv(process.env.CLAUDE_EXTRA_ARGS),
      ...(resume ? ["--resume", sessionId] : ["--session-id", sessionId]),
      "-n",
      name,
    ];
    const workspaceLabel = launchWorkspace(Boolean(slack));
    const { tabId, paneId } = spawnAgent({
      name,
      workspaceLabel,
      cwd,
      claudeArgv: argv,
      tokens: slack ? { [SLACK_TOKEN]: slack.key } : undefined,
    });
    if (slack) {
      // Slack sessions are resumable, so they are never reaped; close their tabs freely.
      sessions = { ...sessions, [slack.key]: { sessionId, name, cwd, recordedAt: Date.now() } };
      writeSessions(sessions);
    } else {
      appendRegistry({
        tabId,
        paneId,
        label: name,
        task: "raygent",
        claudeSessionId: sessionId,
        launched: Math.floor(Date.now() / 1000),
        herdrSession: currentHerdrSession(),
        kind: "raygent",
        workspaceLabel,
        agentName: name,
      });
    }
    verb = resume ? "resumed" : "new";
    launchedCwd = cwd;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`herdr launch failed (${msg}); falling back to tmux`);
    notify(`Herdr unavailable, using tmux: ${msg.slice(0, 120)}`);
    return false;
  }
  try {
    promptAgent(name, prompt);
    console.log(
      `Started herdr agent (${verb}): ${launchWorkspace(Boolean(slack))}/${name} @ ${launchedCwd}`,
    );
    notify(`${name} ← ${verb}`);
    if (focus) focusAgent(name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`prompt to ${name} failed: ${msg}`);
    notify(`${name} started but the prompt was not delivered: ${msg.slice(0, 100)}`);
  }
  return true;
}

main();
