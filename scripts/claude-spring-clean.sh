#!/bin/bash
set -euo pipefail

# Claude Code Spring Clean - Analyze usage of skills, commands, and agents
# Identifies stale/unused resources for cleanup
# Compatible with macOS bash 3.x (no associative arrays)

CLAUDE_DIR="${HOME}/.claude"
SKILLS_DIR="${CLAUDE_DIR}/skills"
COMMANDS_DIR="${CLAUDE_DIR}/commands"
AGENTS_DIR="${CLAUDE_DIR}/agents"
HISTORY_FILE="${CLAUDE_DIR}/history.jsonl"
PROJECTS_DIR="${CLAUDE_DIR}/projects"

DEEP_MODE=false
FORMAT="table"

# Built-in commands to exclude
BUILTINS="^(exit|quit|q|clear|compact|context|mcp|init|tasks|resume|permissions|login|logout|rename|help|config|doctor|memory|cost|status|plugin|model|fast|bug|fork|terminal-setup|vim|ide|plan|skills|agents|keybindings|export|statusline|privacy-settings|output-style|rewind|stats|specify|implement|clarify)$"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Analyze Claude Code skill, command, and agent usage to find stale items.

OPTIONS:
  --deep        Parse project transcripts for programmatic Skill invocations
                (slower, ~45-60s, but catches skills invoked via Skill tool)
  --format FMT  Output format: table (default), json, csv
  -h, --help    Show this help

EXAMPLES:
  $(basename "$0")              # Fast mode - history.jsonl only
  $(basename "$0") --deep       # Include transcript analysis
  $(basename "$0") --format csv # CSV output
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deep) DEEP_MODE=true; shift ;;
    --format) FORMAT="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

case "$FORMAT" in
  table|json|csv) ;;
  *) echo "Invalid format: $FORMAT (use table, json, or csv)" >&2; exit 1 ;;
esac

TMPDIR_CLEAN=$(mktemp -d)
trap 'rm -rf "$TMPDIR_CLEAN"' EXIT

RESOURCES_FILE="$TMPDIR_CLEAN/resources.tsv"
HISTORY_USAGE="$TMPDIR_CLEAN/history_usage.tsv"
DEEP_USAGE="$TMPDIR_CLEAN/deep_usage.tsv"

# Step 1: Enumerate all resources -> resources.tsv (type\tname)
: > "$RESOURCES_FILE"

if [[ -d "$SKILLS_DIR" ]]; then
  for dir in "$SKILLS_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    echo "skill	$(basename "$dir")" >> "$RESOURCES_FILE"
  done
fi

if [[ -d "$COMMANDS_DIR" ]]; then
  for file in "$COMMANDS_DIR"/*.md; do
    [[ -f "$file" ]] || continue
    echo "command	$(basename "$file" .md)" >> "$RESOURCES_FILE"
  done
fi

if [[ -d "$AGENTS_DIR" ]]; then
  for file in "$AGENTS_DIR"/*.md; do
    [[ -f "$file" ]] || continue
    echo "agent	$(basename "$file" .md)" >> "$RESOURCES_FILE"
  done
fi

# Step 2: Extract slash command usage from history.jsonl
# Output: name\tepoch_seconds (one line per invocation)
: > "$HISTORY_USAGE"

if [[ -f "$HISTORY_FILE" ]]; then
  jq -r '
    select(.display | startswith("/")) |
    (.display | ltrimstr("/") | split(" ")[0] | gsub("\\s";"")) as $cmd |
    select($cmd | length > 0) |
    select($cmd | test("/") | not) |
    [($cmd), (.timestamp / 1000 | floor | tostring)] | @tsv
  ' "$HISTORY_FILE" 2>/dev/null | \
  grep -vE "$BUILTINS" >> "$HISTORY_USAGE" || true
fi

# Step 3: Deep mode - extract Skill tool_use from transcripts
: > "$DEEP_USAGE"

if $DEEP_MODE; then
  echo "Scanning transcripts for programmatic Skill invocations..." >&2

  skill_files=$(grep -rl '"name":"Skill"' "$PROJECTS_DIR"/ 2>/dev/null || true)
  total=$(echo "$skill_files" | grep -c . || echo 0)

  if [[ $total -gt 0 ]]; then
    echo "Found $total transcript files with Skill invocations..." >&2
    processed=0

    echo "$skill_files" | while IFS= read -r f; do
      processed=$((processed + 1))
      if [[ $((processed % 20)) -eq 0 ]]; then
        echo "  Processing $processed/$total..." >&2
      fi

      jq -r '
        select(.message.content != null) |
        .timestamp as $ts |
        .message.content[]? |
        select(.name == "Skill") |
        [
          (.input.skill // "" | split(":") | last),
          ($ts // "")
        ] | @tsv
      ' "$f" 2>/dev/null || true
    done >> "$DEEP_USAGE"
  else
    echo "No transcript files found with Skill invocations." >&2
  fi

  # Convert ISO timestamps to epoch seconds in deep usage
  if [[ -s "$DEEP_USAGE" ]]; then
    awk -F'\t' '{
      cmd = $1
      ts = $2
      if (ts != "" && ts != "null") {
        # Convert ISO8601 to epoch using date command
        gsub(/\.[0-9]+Z$/, "", ts)
        gsub(/T/, " ", ts)
        cmd_str = "date -j -f \"%Y-%m-%d %H:%M:%S\" \"" ts "\" \"+%s\" 2>/dev/null"
        cmd_str | getline epoch
        close(cmd_str)
        if (epoch == "") epoch = 0
      } else {
        epoch = 0
      }
      print cmd "\t" epoch
    }' "$DEEP_USAGE" > "$TMPDIR_CLEAN/deep_converted.tsv"
    mv "$TMPDIR_CLEAN/deep_converted.tsv" "$DEEP_USAGE"
  fi

  echo "Transcript scan complete." >&2
fi

# Step 4: Compute usage stats with awk, sort externally, then format
NOW=$(date +%s)
SORTED_FILE="$TMPDIR_CLEAN/sorted.tsv"

# First pass: merge resources with usage data, output pipe-delimited rows
awk -F'\t' -v now="$NOW" '
# Load resources (file 1)
FILENAME == ARGV[1] {
  key = $1 ":" $2
  res_type[key] = $1
  res_name[key] = $2
  res_count[key] = 0
  res_last[key] = 0
  res_order[++num_res] = key
  name_type[$2] = $1
  next
}

# Load history usage (file 2)
FILENAME == ARGV[2] {
  cmd = $1; ts = int($2)
  if (cmd in name_type) {
    key = name_type[cmd] ":" cmd
    if (key in res_type) {
      res_count[key]++
      if (ts > res_last[key]) res_last[key] = ts
    }
  }
  next
}

# Load deep usage (file 3)
FILENAME == ARGV[3] {
  cmd = $1; ts = int($2)
  if (cmd in name_type) {
    key = name_type[cmd] ":" cmd
    if (key in res_type) {
      res_count[key]++
      if (ts > res_last[key]) res_last[key] = ts
    }
  }
  next
}

END {
  for (i = 1; i <= num_res; i++) {
    key = res_order[i]
    count = res_count[key]
    ts = res_last[key]
    if (ts > 0) {
      days = int((now - ts) / 86400)
      cmd = "date -j -f \"%s\" " ts " \"+%Y-%m-%d\" 2>/dev/null"
      cmd | getline last_date
      close(cmd)
      if (last_date == "") last_date = "unknown"
    } else {
      days = 999999
      last_date = "never"
    }
    # Output: sort_key|name|type|last_date|count|days
    printf "%09d|%s|%s|%s|%d|%d\n", days, res_name[key], res_type[key], last_date, count, days
  }
}
' "$RESOURCES_FILE" "$HISTORY_USAGE" "$DEEP_USAGE" | sort -t'|' -k1 -rn > "$SORTED_FILE"

# Second pass: format output
case "$FORMAT" in
  table)
    printf "\n%-42s %-9s %-12s %10s %10s\n" "NAME" "TYPE" "LAST_USED" "USE_COUNT" "DAYS_SINCE"
    printf "%-42s %-9s %-12s %10s %10s\n" \
      "------------------------------------------" \
      "---------" \
      "------------" \
      "----------" \
      "----------"

    used=0; never=0; stale90=0
    skills=0; commands=0; agents=0

    while IFS='|' read -r _sort name type last_date count days; do
      if [[ "$days" == "999999" ]]; then
        days_display="∞"
      else
        days_display="$days"
      fi
      printf "%-42s %-9s %-12s %10s %10s\n" "$name" "$type" "$last_date" "$count" "$days_display"

      if [[ "$count" -gt 0 ]]; then
        used=$((used + 1))
        if [[ "$days" -gt 90 && "$days" -ne 999999 ]]; then
          stale90=$((stale90 + 1))
        fi
      else
        never=$((never + 1))
      fi
      case "$type" in
        skill) skills=$((skills + 1)) ;;
        command) commands=$((commands + 1)) ;;
        agent) agents=$((agents + 1)) ;;
      esac
    done < "$SORTED_FILE"

    total=$((skills + commands + agents))
    echo ""
    echo "--- Summary ---"
    echo "Total: $total ($skills skills, $commands commands, $agents agents)"
    echo "Used: $used | Never used: $never | Stale (>90 days): $stale90"
    if $DEEP_MODE; then
      echo "Mode: deep (history.jsonl + transcripts)"
    else
      echo "Mode: fast (history.jsonl only)"
      echo "Tip: Run with --deep to catch programmatic Skill invocations"
    fi
    echo ""
    ;;

  json)
    total=$(wc -l < "$SORTED_FILE" | tr -d ' ')
    echo "["
    line_num=0
    while IFS='|' read -r _sort name type last_date count days; do
      line_num=$((line_num + 1))
      if [[ "$days" == "999999" ]]; then
        days_json="null"
      else
        days_json="$days"
      fi
      comma=","
      if [[ "$line_num" -eq "$total" ]]; then comma=""; fi
      printf '  {"name":"%s","type":"%s","last_used":"%s","use_count":%s,"days_since":%s}%s\n' \
        "$name" "$type" "$last_date" "$count" "$days_json" "$comma"
    done < "$SORTED_FILE"
    echo "]"
    ;;

  csv)
    echo "name,type,last_used,use_count,days_since"
    while IFS='|' read -r _sort name type last_date count days; do
      if [[ "$days" == "999999" ]]; then days="∞"; fi
      echo "${name},${type},${last_date},${count},${days}"
    done < "$SORTED_FILE"
    ;;
esac
