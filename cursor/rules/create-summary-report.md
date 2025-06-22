---
description: Process for generating a periodic summary report of work activities.
globs: 
alwaysApply: false
---
# Rule: Create Summary Report

This document outlines the process for generating a periodic summary report of work activities.

## Report Objectives

A great Markdown summary report should be:

- **Clear and Structured**: Use hierarchical headings (`#`, `##`) to organize content logically.
- **Concise**: Summarize key points without unnecessary detail. Use bulleted lists for readability.
- **Visually Clear**: Use **bold** for important terms and *italics* for emphasis.
- **Contextual**: Include inline `code` snippets for technical references.
- **Reproducible**: Where applicable, integrate code, outputs, and links to original sources (like Jira tickets or Git commits).

## 1. Define Scope

- **Prompt User**: Ask for the scope of the report. The primary scopes are "Vervio" and "Breville".
- **Determine Timeframe**: Ask for the reporting period (e.g., "weekly", "monthly"). Default to weekly (last 7 days).

## 2. Gather Data

Based on the defined scope, gather data from the following sources. If a tool is not available or enabled, note its omission in the final report.

### Git History

- **Identify Source Directory**: Use `tech-stack-info.mdc` to find the root folder containing all repositories for the specified scope (e.g., `/Users/joshmu/work/breville/source`).
- **Execute Aggregate Git Log**: Run the following shell command to loop through all repos and gather the commit history in one step:

    ```bash
    cd /path/to/source && for d in */; do if [ -d "$d/.git" ]; then echo "### ${d%/}" | sed 's/-/_/g' ; (cd "$d" && git log --author="<email>" --since="<timeframe>" --pretty=format:"- %s (%h) on %ad" --date=short); echo ""; fi; done
    ```

- **Parameters**:
  - Replace `<email>` with the email address from `tech-stack-info.mdc`.
  - Replace `<timeframe>` with the user-specified period (e.g., "1 month ago").
- **Collect Commits**: The command's output is the full, formatted list of commits, ready for the report.

### Jira Tickets

- **JQL Query**: Execute a search with the following JQL to find all interactions (assigned, reported, or watched) across all projects:
  - `(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser() OR assignee WAS currentUser()) AND updated >= -30d ORDER BY updated DESC`
  - Adjust the timeframe (`-30d`) based on the user's request.
- **Tool Optimization**: Request essential fields to identify interaction type: `summary,status,updated,assignee,reporter`.
- **Synthesize**: When creating the report, for each ticket, check if the user is the `assignee` or `reporter`. If neither, the interaction is as a `Watcher` or `Past Assignee`. Prepend the interaction type (e.g., `[Assignee]`, `[Reporter]`, `[Watcher]`) to the ticket summary.

### Confluence Documents

- **Tool**: Use the `mcp_confluence_confluence_search` tool.
- **CQL Query**: Execute a search with the following CQL to find documents the user has contributed to:
  - `contributor = currentUser() AND lastModified > startOfMonth("-1M")`
  - Adjust the timeframe as needed (e.g., `startOfWeek()` for weekly).
- **Tool Optimization**: The tool returns the title, so no extra field selection is needed. The summary provided is also helpful for context.

### GitHub Activity (for Vervio scope)

- Use the GitHub MCP tool to search for activity by the user (`mu@joshmu.com`) in the `vervio-digital/ai-retail-agent` repository within the specified timeframe.

## 3. Synthesize and Format Report

- **Structure**: Create a Markdown document with the following structure:
  - A main heading with the report title (e.g., `# Breville - Weekly Summary - YYYY-MM-DD`).
  - Subheadings for each data source (e.g., `## Git Commits`, `## Jira Tickets`).
  - Bulleted lists for the items under each subheading.
- **Content**: Populate the sections with the data gathered in the previous step. If no activity is found for a source, state "No activity found for this period."

## 4. Save the Report in Obsidian

- **Determine Path**:
  - If scope is "Breville", path is `/Users/joshmu/Desktop/obsidian/areas/breville/summaries/`.
  - If scope is "Vervio", path is `/Users/joshmu/Desktop/obsidian/areas/vervio/summaries/`.
- **Generate Filename**:
  - Use the format: `YYYY-MM-DD-<scope>-<period>-summary.md`.
  - Example: `2024-07-29-breville-weekly-summary.md`.
- **Save File**: Write the generated Markdown content to the specified file path.
- **Confirmation**: Inform the user that the report has been created and provide the file path.

---

*This document should be updated as new patterns and conventions are discovered.*
