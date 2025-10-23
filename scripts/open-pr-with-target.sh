#!/bin/bash

# open-pr-with-target.sh
# Open PR creation page in browser with custom target branch

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}❌ Not a git repository${NC}"
    exit 1
fi

# Check if target branch is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: open-pr-with-target <target-branch> [source-branch]${NC}"
    echo -e "   Example: open-pr-with-target develop"
    echo -e "   Example: open-pr-with-target develop feature/my-branch"
    exit 1
fi

TARGET_BRANCH="$1"
# Use provided source branch or default to current checked out branch
if [ -n "$2" ]; then
    SOURCE_BRANCH="$2"
else
    SOURCE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi
REMOTE_URL=$(git remote get-url origin 2>/dev/null)

if [ -z "$REMOTE_URL" ]; then
    echo -e "${RED}❌ No remote 'origin' found${NC}"
    exit 1
fi

echo -e "${YELLOW}🔗 Opening PR creation page...${NC}"
echo -e "   Source branch: ${SOURCE_BRANCH}"
echo -e "   Target branch: ${TARGET_BRANCH}"
echo ""

# Check if source branch exists on remote, push if not
if ! git ls-remote --exit-code --heads origin "${SOURCE_BRANCH}" > /dev/null 2>&1; then
    echo -e "${YELLOW}📤 Branch not on remote, pushing...${NC}"
    if git push -u origin "${SOURCE_BRANCH}"; then
        echo -e "${YELLOW}✓ Branch pushed successfully${NC}"
        echo ""
    else
        echo -e "${RED}❌ Failed to push branch${NC}"
        exit 1
    fi
fi

# Detect if GitHub or Bitbucket and construct URL
if echo "$REMOTE_URL" | grep -q "github.com"; then
    # GitHub format: https://github.com/owner/repo/compare/target...current?expand=1
    BASE_URL=$(echo "$REMOTE_URL" | sed -E 's|^git@github.com:(.*).git$|https://github.com/\1|' | sed -E 's|^https://github.com/(.*).git$|https://github.com/\1|')
    PR_URL="${BASE_URL}/compare/${TARGET_BRANCH}...${SOURCE_BRANCH}?expand=1"
    open "$PR_URL"
elif echo "$REMOTE_URL" | grep -q "bitbucket.org"; then
    # Bitbucket format: https://bitbucket.org/workspace/repo/pull-requests/new?source=current&dest=target
    BASE_URL=$(echo "$REMOTE_URL" | sed -E 's|^git@bitbucket.org:(.*).git$|https://bitbucket.org/\1|' | sed -E 's|^https://[^@]*@bitbucket.org/(.*).git$|https://bitbucket.org/\1|')
    PR_URL="${BASE_URL}/pull-requests/new?source=${SOURCE_BRANCH}&dest=${TARGET_BRANCH}"
    open "$PR_URL"
else
    echo -e "${RED}❌ Unknown remote: $REMOTE_URL${NC}"
    exit 1
fi
