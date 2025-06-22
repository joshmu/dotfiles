---
description: Outlines the rules and conventions for interacting with the user's Obsidian vault.
globs: 
alwaysApply: false
---
# Obsidian Vault Integration

This document outlines the rules and conventions for interacting with the user's Obsidian vault. The goal is to ensure that AI-assisted actions are consistent with the user's existing knowledge management system, which is primarily focused on engineering topics.

## Vault Structure

- **Root Path**: `/Users/joshmu/Desktop/obsidian`
- **Key Folders**:
    - `daily/`: Contains daily notes with tasks.
    - `areas/`: Contains notes organized by specific topics or domains.
    - `inbox/`: A default location for notes that don't fit into a specific area yet.
    - `assets/`: For storing images, PDFs, and other non-markdown files.

## Note Placement

1.  **Review Areas**: Before creating a new note, review the existing folders within `areas/` to find the most appropriate location. The current areas are:
    - `crypto-bot`
    - `breville`
    - `dev`
    - `personal`
    - `vervio`
    - `finance`
    - `health`

2.  **Search First**: Always perform a keyword search within the vault to see if a similar note already exists. This helps prevent duplication and encourages linking related ideas.

3.  **Use the Inbox**: If you are uncertain where a note should be placed, put it in the `inbox/` folder. The user will triage it later.

## Daily Notes & Task Management

- The `daily/` folder contains notes for each day, named in a consistent format (e.g., `YYYY-MM-DD.md`).
- Each daily note contains a list of tasks for that day using Markdown checkboxes `[ ]`.
- At the end of the day, any unfinished tasks (`[ ]`) should be rolled over to the next day's note. Completed tasks (`[x]`) are not carried over.

## Note Creation & Formatting

### Frontmatter (Properties)

Use the following frontmatter structure for all new notes to ensure consistency. This combines the user's existing pattern with best practices.

```yaml
---
id: a-unique-kebab-case-id
date: YYYY-MM-DD
tags:
  - relevant-tag-1
  - relevant-tag-2
status: sprout # E.g., sprout, evergreen, fleeting
aliases: [Synonym, Abbreviation]
---
```

- **`id`**: A unique, descriptive identifier in `kebab-case`. Should match the filename without the extension.
- **`date`**: The creation date of the note.
- **`tags`**: A list of broad, thematic tags. Keep them simple and consistent.
- **`status`**: The state of the note.
    - `sprout`: A new idea that is expected to grow.
    - `evergreen`: A well-developed, permanent note.
    - `fleeting`: A quick thought or temporary note.
- **`aliases`**: Optional synonyms or abbreviations for the note title to improve searchability. Use sparingly.

### Content

- **Atomic Notes**: Each note should focus on a single, atomic idea.
- **Markdown**: Use Markdown for clear formatting.
    - Use headers (`#`, `##`) for structure.
    - Use lists (`-`, `*`, `1.`) for clarity.
    - Use **bold** and *italics* to emphasize key points.
- **Linking**:
    - Create descriptive links to other notes (e.g., `[[YYYY-MM-DD|Zettelkasten methodology]]`).
    - Reference other files if they share common information or goals to build a connected web of knowledge.
    - Use backlinks to connect related ideas. Consider creating "hub" or "Map of Content" (MOC) notes for larger topics.

### File Naming

- **Format**: Use `kebab-case` for filenames.
- **Descriptive**: Filenames should be descriptive of the note's content.
- **Example**: `design-system-contribution.md`

## Workflow Summary

1.  **Conceptualize**: Identify the core idea for the new note.
2.  **Search**: Search the vault for existing notes on the topic.
    - If found, consider updating the existing note or linking to it.
    - If not found, proceed to create a new note.
3.  **Locate**: Determine the best folder within `areas/`. If unsure, use `inbox/`.
4.  **Create**:
    - Create the new file with a descriptive, kebab-case name.
    - Add the appropriate frontmatter.
    - Write the content following the principles of atomic notes and clear Markdown formatting.
    - Link to other relevant notes.
5.  **Refine**: Revisit notes periodically to refine them, add new connections, and update their status.

---

*This document should be updated as new patterns and conventions are discovered.*
