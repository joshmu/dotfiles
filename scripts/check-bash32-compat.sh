#!/bin/bash
# check-bash32-compat.sh — flag Bash 4+ features that silently break on macOS
set -euo pipefail
errors=0
SELF="$(basename "$0")"
for file in "$@"; do
  [[ -f "$file" ]] || continue
  [[ "$(basename "$file")" == "$SELF" ]] && continue
  # Associative arrays: declare -A or combined flags like -Ag, -gA (Bash 4.0+)
  if grep -nE '^\s*declare\s+(-[a-zA-Z]*A[a-zA-Z]*)\b' "$file"; then echo "ERROR: $file uses associative arrays (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE '^\s*(mapfile|readarray)\b' "$file"; then echo "ERROR: $file uses mapfile/readarray (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE '\$\{[a-zA-Z_][a-zA-Z0-9_]*(\^\^|,,|,|\^)\}' "$file"; then echo "ERROR: $file uses case modification (Bash 4.0+)"; errors=$((errors + 1)); fi
  if grep -nE '^\s*coproc\b' "$file"; then echo "ERROR: $file uses coproc (Bash 4.0+)"; errors=$((errors + 1)); fi
  # Negative array indices (Bash 4.3+)
  if grep -nE '\$\{[a-zA-Z_][a-zA-Z0-9_]*\[-[0-9]+\]\}' "$file"; then echo "ERROR: $file uses negative array index (Bash 4.3+)"; errors=$((errors + 1)); fi
  # declare -g: global scope in functions (Bash 4.2+), including combined flags
  if grep -nE '^\s*declare\s+(-[a-zA-Z]*g[a-zA-Z]*)\b' "$file"; then echo "ERROR: $file uses declare -g (Bash 4.2+)"; errors=$((errors + 1)); fi
  # declare -n: nameref (Bash 4.3+), including combined flags
  if grep -nE '^\s*declare\s+(-[a-zA-Z]*n[a-zA-Z]*)\b' "$file"; then echo "ERROR: $file uses declare -n nameref (Bash 4.3+)"; errors=$((errors + 1)); fi
done
exit $((errors > 0 ? 1 : 0))
