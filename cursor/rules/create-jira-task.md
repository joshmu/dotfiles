---
description: Outlines the best practices for creating a new issue in Jira.
globs:
alwaysApply: false
---
# Create Jira Issue

This rule outlines the best practices for creating a new issue in Jira. It is designed to be generic and applicable across different projects. Following these guidelines ensures that issues are clear, actionable, and easy to track.

## 1. Core Principles of a Good Jira Issue

-   **Clarity and Conciseness**: The issue should be easy to understand at a glance.
-   **Completeness**: Provide all necessary details for someone to start working on it.
-   **Actionability**: Clearly define what needs to be done.
-   **Consistency**: Use a standardized format for all issues.

## 2. Information to Include

### **Essential Fields**

-   **Project Key**: The unique identifier for the Jira project (e.g., `PROJ`).
-   **Issue Type**: The type of work item (e.g., `Task`, `Story`, `Bug`, `Epic`).
-   **Summary**: A clear and concise title.
    -   *Good*: `Submit button unresponsive on Contact Us form`
    -   *Bad*: `Button broken`
-   **Description**: A detailed explanation of the task. Use the template below for consistency.

### **Optional but Recommended Fields**

-   **Assignee**: The person responsible for the task. Can be left unassigned for the team to pick up.
-   **Parent Link**: If the issue is part of a larger body of work, link it to the parent Epic or Task.
-   **Labels**: Add relevant labels for easier filtering and reporting (e.g., `frontend`, `api`, `bug`).
-   **Priority**: Indicate the urgency of the task.

## 3. Description Template

A good description is key to an effective Jira issue. Here is a recommended template:

```markdown
### User Story
As a [user type], I want to [perform some action] so that I can [achieve some goal].

### Acceptance Criteria
- [ ] Criterion 1: A specific, measurable, and testable condition that must be met.
- [ ] Criterion 2: Another condition.

### Steps to Reproduce (for bugs)
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

### Technical Notes (optional)
- Any technical details, considerations, or implementation suggestions can go here.
- Links to relevant documentation or designs.
```

## 4. Constructing the Tool Call

Use the `jira` MCP `jira_create_issue` tool to create the ticket.

### Example Tool Call

```json
{
  "tool_name": "<TOOL_NAME>",
  "arguments": {
    "project_key": "<PROJECT_KEY>",
    "issue_type": "<ISSUE_TYPE>",
    "summary": "Clear and Concise Summary",
    "description": "...",
    "assignee": "<ASSIGNEE_EMAIL (optional)>",
    "additional_fields": {
      "parent": "<PARENT_ISSUE_KEY (optional)>"
    }
  }
}
```

*This document should be updated as new patterns and conventions are discovered.*
