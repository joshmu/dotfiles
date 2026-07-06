#!/usr/bin/env bash
# share-artifact.sh — get an org-scoped shareable OneDrive URL for a file in ~/work/brg/artifacts
#
# Usage:
#   share-artifact.sh <file> [view|edit]
#
# <file> can be a bare filename (resolved against ~/work/brg/artifacts) or a path.
# Prints the sharing link URL to stdout (and copies it to the clipboard).
#
# Notes:
# - Requires CLI for Microsoft 365 (`m365`) with an authenticated session (`m365 login`).
# - Link is org-scoped: any Breville staff member with the link can view.
# - The link is bound to the file's item id, so it keeps pointing at the LATEST
#   version as the file is updated (survives content edits and renames).
# - Idempotent: re-running returns the same existing organization link.
# - The file must have finished syncing to OneDrive before a link can be created;
#   the script waits briefly for the cloud item to appear.
set -euo pipefail

ARTIFACTS_DIR="$HOME/work/brg/artifacts"
SITE_URL="https://breville-my.sharepoint.com/personal/josh_mu_breville_com"
SERVER_ROOT="/personal/josh_mu_breville_com/Documents/artifacts"

file="${1:?usage: share-artifact.sh <file> [view|edit]}"
link_type="${2:-view}"

name="$(basename "$file")"
local_path="$ARTIFACTS_DIR/$name"
[ -f "$local_path" ] || { echo "error: $local_path not found" >&2; exit 1; }

if ! m365 status --output text 2>/dev/null | grep -qv "Logged out"; then
  echo "error: not logged in — run: m365 login" >&2
  exit 1
fi

file_url="$SERVER_ROOT/$name"

# wait for OneDrive to sync the file to the cloud (max ~60s)
for i in $(seq 1 12); do
  if m365 spo file get --webUrl "$SITE_URL" --url "$file_url" --output none 2>/dev/null; then
    break
  fi
  [ "$i" -eq 12 ] && { echo "error: file not yet synced to OneDrive (waited 60s): $file_url" >&2; exit 1; }
  sleep 5
done

link="$(m365 spo file sharinglink add \
  --webUrl "$SITE_URL" \
  --fileUrl "$file_url" \
  --type "$link_type" \
  --scope organization \
  --output json | jq -r '.link.webUrl // .webUrl')"

[ -n "$link" ] && [ "$link" != "null" ] || { echo "error: no link returned" >&2; exit 1; }

printf '%s\n' "$link"
command -v pbcopy >/dev/null && printf '%s' "$link" | pbcopy && echo "(copied to clipboard)" >&2
