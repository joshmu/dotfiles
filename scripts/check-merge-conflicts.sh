#!/bin/bash

# check-merge-conflicts.sh
# Check if merging a target branch into current branch would cause conflicts

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}❌ Not a git repository${NC}"
    exit 1
fi

# Check if target branch is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: check-merge-conflicts <target-branch>${NC}"
    echo -e "   Example: check-merge-conflicts develop"
    exit 1
fi

TARGET_BRANCH="$1"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected - stashing temporarily...${NC}"
    git stash push -q -m "merge-check-temp-stash-$(date +%s)"
    STASHED=true
else
    STASHED=false
fi

echo -e "${YELLOW}🔍 Checking for conflicts...${NC}"
echo -e "   Current branch: ${CURRENT_BRANCH}"
echo -e "   Target branch:  ${TARGET_BRANCH}"
echo ""

# Fetch latest from origin
echo -e "${YELLOW}📥 Fetching from origin...${NC}"
if ! git fetch origin > /dev/null 2>&1; then
    echo -e "${RED}❌ Failed to fetch from origin${NC}"
    exit 1
fi

# Check if target branch exists
if ! git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
    echo -e "${RED}❌ Target branch 'origin/${TARGET_BRANCH}' does not exist${NC}"
    exit 1
fi

# Attempt merge without committing
echo -e "${YELLOW}🔀 Attempting merge...${NC}"
MERGE_OUTPUT=$(git merge --no-commit --no-ff "origin/${TARGET_BRANCH}" 2>&1)
MERGE_EXIT_CODE=$?

if [ $MERGE_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ No conflicts! Safe to merge${NC}"
    git merge --abort > /dev/null 2>&1

    # Restore stashed changes if any
    if [ "$STASHED" = true ]; then
        echo -e "${YELLOW}♻️  Restoring stashed changes...${NC}"
        git stash pop -q
    fi

    exit 0
else
    # Check if it's actually conflicts or another error
    if echo "$MERGE_OUTPUT" | grep -q "CONFLICT"; then
        # Get list of conflicted files using ls-files (more reliable)
        CONFLICTED_FILES=$(git ls-files -u | cut -f2 | sort -u)

        if [ -z "$CONFLICTED_FILES" ]; then
            echo -e "${RED}❌ Merge failed but no conflict markers found${NC}"
            echo -e "${YELLOW}Error output:${NC}"
            echo "$MERGE_OUTPUT"
            git merge --abort > /dev/null 2>&1
            exit 1
        fi

        # Count total conflicts across all files
        TOTAL_CONFLICTS=0
        while IFS= read -r file; do
            if [ -n "$file" ]; then
                conflict_count=$(grep -c "^<<<<<<< " "$file" 2>/dev/null || echo "0")
                TOTAL_CONFLICTS=$((TOTAL_CONFLICTS + conflict_count))
            fi
        done <<< "$CONFLICTED_FILES"

        echo -e "${RED}🚫 ${TOTAL_CONFLICTS} conflicts detected!${NC}"
        echo ""

        # Show conflicted files with conflict counts
        echo -e "${YELLOW}📊 Conflicted files:${NC}"
        while IFS= read -r file; do
            if [ -n "$file" ]; then
                conflict_count=$(grep -c "^<<<<<<< " "$file" 2>/dev/null || echo "0")
                echo -e "   ${file} (${conflict_count})"
            fi
        done <<< "$CONFLICTED_FILES"
        echo ""

        git merge --abort > /dev/null 2>&1

        # Restore stashed changes if any
        if [ "$STASHED" = true ]; then
            echo -e "${YELLOW}♻️  Restoring stashed changes...${NC}"
            git stash pop -q
        fi

        exit 1
    else
        echo -e "${RED}❌ Merge failed with non-conflict error${NC}"
        echo "$MERGE_OUTPUT"
        git merge --abort > /dev/null 2>&1

        # Restore stashed changes if any
        if [ "$STASHED" = true ]; then
            echo -e "${YELLOW}♻️  Restoring stashed changes...${NC}"
            git stash pop -q
        fi

        exit 1
    fi
fi
