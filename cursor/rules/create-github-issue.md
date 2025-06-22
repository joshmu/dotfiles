---
description: Outlines the best practices for creating a new issue in a GitHub repository.
globs:
alwaysApply: false
---
# Create GitHub Issue

This rule outlines the best practices for creating a new issue in a GitHub repository. Following these guidelines ensures that issues are clear, actionable, and easy to track.

## 1. Core Principles of a Good GitHub Issue

-   **Clear Title**: A concise and descriptive title.
-   **Detailed Body**: A thorough description of the issue, request, or bug.
-   **Reproducibility**: For bugs, provide clear steps to reproduce the problem.
-   **Defined Scope**: Clearly state the expected outcome and acceptance criteria.

## 2. Information to Include

### **Essential Fields**

-   **Owner**: The GitHub username or organization that owns the repository
-   **Repository**: The name of the repository
-   **Title**: A concise and descriptive summary of the issue.
-   **Body**: A detailed description. Use the template below for consistency.

### **Optional but Recommended Fields**

-   **Assignees**: A list of GitHub usernames to assign to the issue.
-   **Labels**: A list of labels to help categorize the issue.
-   **Milestone**: The milestone to which this issue belongs.
-   **Projects**: The project boards to add this issue to.

## 3. Issue Body Template

A good issue body is crucial. Here is a recommended template:

```markdown
### Description

A clear and concise description of the feature request or bug.

### User Story (for features)

As a [user type], I want to [perform some action] so that I can [achieve some goal].

### Steps to Reproduce (for bugs)

1.  Go to '...'
2.  Click on '....'
3.  See error / unexpected behavior.

### Expected Behavior

A clear and concise description of what you expected to happen.

### Actual Behavior

A clear and concise description of what actually happened. Include screenshots or logs if possible.

### Acceptance Criteria

- [ ] Criterion 1: A specific, measurable, and testable condition.
- [ ] Criterion 2: Another condition that must be met for the issue to be considered done.
```

## 4. Best Practices for Labels

A good labeling system helps categorize and prioritize work. Consider using prefixed labels:

-   **Type**: `type: bug`, `type: feature`, `type: documentation`, `type: chore`
-   **Status**: `status: to-do`, `status: in-progress`, `status: needs-review`
-   **Priority**: `priority: high`, `priority: medium`, `priority: low`
-   **Area**: `area: auth`, `area: ui`, `area: api`

## 5. Constructing the Tool Call

Use the `mcp_github_create_issue` tool to create the issue.

### Example Tool Call

```json
{
  "tool_name": "mcp_github_create_issue",
  "arguments": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "title": "Example GitHub Issue Title",
    "body": "...",
    "assignees": [
      "<USERNAME (optional)>"
    ],
    "labels": [
      "type: task",
      "status: to-do"
    ]
  }
}
```

*This document should be updated as new patterns and conventions are discovered.*
