#!/usr/bin/env bun
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Template locations to check, in order of precedence
 */
const TEMPLATE_LOCATIONS = [
  '.bitbucket/pull_request_template.md',
  '.github/pull_request_template.md',
  'pull_request_template.md',
  '.bitbucket/PULL_REQUEST_TEMPLATE.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'PULL_REQUEST_TEMPLATE.md',
];

/**
 * Load PR template from various standard locations
 */
export function loadPRTemplate(repoPath?: string): string | null {
  const basePath = repoPath || process.cwd();
  
  for (const templatePath of TEMPLATE_LOCATIONS) {
    const fullPath = path.join(basePath, templatePath);
    if (existsSync(fullPath)) {
      try {
        const template = readFileSync(fullPath, 'utf-8');
        console.log(`📄 Found PR template at: ${templatePath}`);
        return template;
      } catch (error) {
        console.error(`⚠️  Error reading template at ${fullPath}:`, error);
      }
    }
  }
  
  return null;
}

/**
 * Process template variables
 * Replaces common template variables with actual values
 */
export function processTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let processed = template;
  
  // Replace variables in format {{variable}} or ${variable}
  for (const [key, value] of Object.entries(variables)) {
    processed = processed.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    processed = processed.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }
  
  // Remove any remaining unmatched variables
  processed = processed.replace(/\{\{[^}]+\}\}/g, '');
  processed = processed.replace(/\$\{[^}]+\}/g, '');
  
  return processed;
}

/**
 * Common template variables that can be used in PR templates
 */
export interface TemplateVariables {
  branch?: string;
  sourceBranch?: string;
  destinationBranch?: string;
  author?: string;
  date?: string;
  ticketNumber?: string;
  title?: string;
}

/**
 * Extract ticket number from branch name
 * Supports common patterns like: feature/JIRA-123-description, BSD-456-fix
 */
export function extractTicketNumber(branchName: string): string | null {
  // Common ticket patterns
  const patterns = [
    /([A-Z]{2,}-\d+)/,  // JIRA-123, BSD-456
    /(\d{4,})/,         // 1234 (numeric only)
  ];
  
  for (const pattern of patterns) {
    const match = branchName.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Generate template variables from context
 */
export function generateTemplateVariables(
  sourceBranch: string,
  destinationBranch: string,
  title?: string,
  author?: string
): TemplateVariables {
  const ticketNumber = extractTicketNumber(sourceBranch);
  
  return {
    branch: sourceBranch,
    sourceBranch,
    destinationBranch,
    author: author || process.env.USER || 'Unknown',
    date: new Date().toISOString().split('T')[0],
    ticketNumber: ticketNumber || '',
    title: title || '',
  };
}