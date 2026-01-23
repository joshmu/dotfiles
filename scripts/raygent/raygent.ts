#!/usr/bin/env bun
/**
 * Raygent - Launch Claude Code in tmux via Raycast (headless)
 *
 * Flow:
 * 1. Generate session name + determine cwd via Claude Sonnet
 * 2. Create unique tmux session in correct directory
 * 3. Send claude command with prompt
 */

import { generateSessionConfig } from './lib/router-agent';
import { createSession, sendKeys, generateUniqueName } from './lib/tmux';

async function main() {
  const prompt = process.argv[2];

  if (!prompt) {
    console.error('Usage: raygent.ts "your prompt"');
    process.exit(1);
  }

  try {
    // 1. Generate name + cwd via Sonnet
    const config = await generateSessionConfig(prompt);

    // 2. Ensure unique session name
    const sessionName = generateUniqueName(config.name);

    // 3. Create tmux session in correct directory
    createSession(sessionName, config.cwd);

    // 4. Send claude command - escape quotes in prompt
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    sendKeys(sessionName, `claude "${escapedPrompt}"`);

    console.log(`Started: ${sessionName} @ ${config.cwd}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
