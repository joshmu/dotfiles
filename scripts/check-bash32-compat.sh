#!/bin/bash
# check-bash32-compat.sh — flag Bash 4+ features that silently break on macOS
set -euo pipefail
errors=0
SELF="$(basename "$0")"
for file in "$@"; do
  [[ -f "$file" ]] || continue
  [[ "$(basename "$file")" == "$SELF" ]] && continue
  if grep -nE '^\s*declare\s+-A\b' "$file"; then echo "ERROR: $file uses associative arrays (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE '^\s*(mapfile|readarray)\b' "$file"; then echo "ERROR: $file uses mapfile/readarray (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE '\$\{[a-zA-Z_][a-zA-Z0-9_]*(,,|^^|,|\^)\}' "$file"; then echo "ERROR: $file uses case modification (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE '^\s*coproc\b' "$file"; then echo "ERROR: $file uses coproc (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE '\|\&' "$file"; then echo "ERROR: $file uses |& pipe (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE '&>>' "$file"; then echo "ERROR: $file uses &>> redirect (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE 'declare\s+.*-g\b' "$file"; then echo "ERROR: $file uses declare -g (Bash 4.2+)"; errors=$((errors + 1)); fi
  if grep -nE 'declare\s+.*-n\b' "$file"; then echo "ERROR: $file uses declare -n nameref (Bash 4.3+)"; errors=$((errors + 1)); fi
done
exit $((errors > 0 ? 1 : 0))
