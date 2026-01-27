#!/usr/bin/env bun
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface BitbucketConfig {
  username: string;
  appPassword: string;
  workspace: string;
  defaultBaseBranch: string;
}

interface ConfigJson {
  username: string;
  appPassword: string;
  workspace?: string;
  defaultBaseBranch?: string;
}

function loadJsonConfig(configPath: string): ConfigJson | null {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as ConfigJson;
    
    // Validate required fields
    if (!config.username || !config.appPassword) {
      console.error('❌ Invalid config.json: missing required fields (username, appPassword)');
      process.exit(1);
    }
    
    return config;
  } catch (error) {
    console.error('❌ Error parsing config.json:', error);
    process.exit(1);
  }
}

export function loadConfig(): BitbucketConfig {
  const scriptDir = new URL('..', import.meta.url).pathname;
  const configPath = join(scriptDir, 'config.json');
  
  // Try to load config.json
  const config = loadJsonConfig(configPath);
  
  if (!config) {
    console.error('❌ Configuration file not found');
    console.error('');
    console.error(`Please create a config.json file at: ${configPath}`);
    console.error('');
    console.error('You can copy the example file:');
    console.error('  cp config.json.example config.json');
    console.error('');
    console.error('Then edit it with your Bitbucket credentials:');
    console.error('  {');
    console.error('    "username": "your-username",');
    console.error('    "appPassword": "your-app-password",');
    console.error('    "workspace": "your-workspace",');
    console.error('    "defaultBaseBranch": "master"');
    console.error('  }');
    console.error('');
    console.error('Create app password at: https://bitbucket.org/account/settings/app-passwords/');
    process.exit(1);
  }

  return {
    username: config.username,
    appPassword: config.appPassword,
    workspace: config.workspace || 'your-workspace',
    defaultBaseBranch: config.defaultBaseBranch || 'master',
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