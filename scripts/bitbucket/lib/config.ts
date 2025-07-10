#!/usr/bin/env bun
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface BitbucketConfig {
  username: string;
  appPassword: string;
  workspace: string;
  defaultBaseBranch: string;
}

function loadEnvFile(envPath: string): Record<string, string> {
  const env: Record<string, string> = {};
  
  if (!existsSync(envPath)) {
    return env;
  }

  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      // Remove quotes if present
      env[key.trim()] = value.replace(/^["']|["']$/g, '');
    }
  }

  return env;
}

export function loadConfig(): BitbucketConfig {
  const scriptDir = new URL('..', import.meta.url).pathname;
  const envPath = join(scriptDir, '.env');
  
  // Load .env file if it exists
  const fileEnv = loadEnvFile(envPath);
  
  // Merge with process.env (process.env takes precedence)
  const env = { ...fileEnv, ...process.env };

  const username = env.BITBUCKET_USERNAME;
  const appPassword = env.BITBUCKET_APP_PASSWORD;
  const workspace = env.BITBUCKET_WORKSPACE || 'brevilledigital';
  const defaultBaseBranch = env.BITBUCKET_DEFAULT_BASE_BRANCH || 'master';

  if (!username || !appPassword) {
    console.error('❌ Missing required environment variables');
    console.error('');
    console.error('Please set the following environment variables:');
    console.error('  - BITBUCKET_USERNAME');
    console.error('  - BITBUCKET_APP_PASSWORD');
    console.error('');
    console.error('You can either:');
    console.error(`  1. Create a .env file at: ${envPath}`);
    console.error('  2. Set them as environment variables');
    console.error('');
    console.error('Example .env file:');
    console.error('  BITBUCKET_USERNAME=your-username');
    console.error('  BITBUCKET_APP_PASSWORD=your-app-password');
    console.error('  BITBUCKET_WORKSPACE=brevilledigital');
    process.exit(1);
  }

  return {
    username,
    appPassword,
    workspace,
    defaultBaseBranch,
  };
}

export function getCurrentRepo(): string | null {
  try {
    // Try to get repo name from current git remote
    const proc = Bun.spawnSync(['git', 'remote', 'get-url', 'origin']);
    if (proc.exitCode !== 0) {
      return null;
    }

    const remoteUrl = proc.stdout.toString().trim();
    
    // Extract repo name from various URL formats
    // SSH: git@bitbucket.org:workspace/repo.git
    // HTTPS: https://bitbucket.org/workspace/repo.git
    const match = remoteUrl.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return match[2];
    }

    return null;
  } catch {
    return null;
  }
}

export function getCurrentBranch(): string | null {
  try {
    const proc = Bun.spawnSync(['git', 'rev-parse', '--abbrev-ref', 'HEAD']);
    if (proc.exitCode !== 0) {
      return null;
    }
    return proc.stdout.toString().trim();
  } catch {
    return null;
  }
}