#!/usr/bin/env bash
#
# check-gh-token.sh
# Read-only inspector for GitHub tokens (PATs, fine-grained PATs, App tokens).
#
# READ-ONLY CONTRACT (do not change without review):
#   - Only HTTP GET requests against https://api.github.com.
#   - No POST/PUT/PATCH/DELETE, no -X, no -d, no --data.
#   - Token is passed via -H header only; never echoed, logged, or written to disk.
#   - --json output redacts the token. Errors mask token to prefix only.
#   - No filesystem writes, no tempfiles, no caching.
#   - No git operations. No `gh` mutations (only `gh auth token` to fetch).
#
# Usage:
#   check-gh-token.sh <token>
#   echo "$TOKEN" | check-gh-token.sh --stdin
#   check-gh-token.sh                       # falls back to $GH_TOKEN, $GITHUB_TOKEN, then `gh auth token`
#
# Flags:
#   --stdin       Read token from stdin (avoids shell history)
#   --no-probe    Skip capability probes
#   --json        Emit JSON (token redacted)
#   -h, --help    Show usage

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

API_HOST="https://api.github.com"

usage() {
    cat <<'EOF'
check-gh-token — read-only GitHub token inspector

Usage:
  check-gh-token <token>
  echo "$TOKEN" | check-gh-token --stdin
  check-gh-token                          # uses $GH_TOKEN, $GITHUB_TOKEN, or `gh auth token`

Flags:
  --stdin       Read token from stdin
  --no-probe    Skip capability probes
  --json        Emit JSON (token redacted)
  -h, --help    Show this help

Inspects: identity, token type, scopes, expiration, SSO orgs,
rate limit, and effective access via read probes.

This script is strictly read-only. It only issues GET requests.
EOF
}

# ---- Arg parsing ---------------------------------------------------------
USE_STDIN=false
NO_PROBE=false
JSON_OUT=false
TOKEN_ARG=""

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --stdin)   USE_STDIN=true; shift ;;
        --no-probe) NO_PROBE=true; shift ;;
        --json)    JSON_OUT=true; shift ;;
        --) shift; break ;;
        -*)
            echo -e "${RED}Unknown flag: $1${NC}" >&2
            usage >&2
            exit 1
            ;;
        *)
            if [ -z "$TOKEN_ARG" ]; then
                TOKEN_ARG="$1"
            else
                echo -e "${RED}Unexpected argument: $1${NC}" >&2
                exit 1
            fi
            shift
            ;;
    esac
done

# ---- Token resolution ----------------------------------------------------
TOKEN=""
TOKEN_SOURCE=""
if [ "$USE_STDIN" = true ]; then
    if [ -t 0 ]; then
        echo -e "${RED}--stdin specified but no input on stdin${NC}" >&2
        exit 1
    fi
    TOKEN="$(tr -d '[:space:]' < /dev/stdin || true)"
    TOKEN_SOURCE="stdin"
elif [ -n "$TOKEN_ARG" ]; then
    TOKEN="$TOKEN_ARG"
    TOKEN_SOURCE="arg"
elif [ -n "${GH_TOKEN:-}" ]; then
    TOKEN="$GH_TOKEN"
    TOKEN_SOURCE="\$GH_TOKEN"
elif [ -n "${GITHUB_TOKEN:-}" ]; then
    TOKEN="$GITHUB_TOKEN"
    TOKEN_SOURCE="\$GITHUB_TOKEN"
elif command -v gh >/dev/null 2>&1; then
    if TOKEN="$(gh auth token 2>/dev/null)" && [ -n "$TOKEN" ]; then
        TOKEN_SOURCE="gh auth token"
    fi
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ No token provided${NC}" >&2
    echo "" >&2
    usage >&2
    exit 1
fi

# ---- Token type detection ------------------------------------------------
TOKEN_PREFIX="${TOKEN:0:4}"
case "$TOKEN" in
    ghp_*)        TOKEN_TYPE="classic PAT";              TOKEN_TYPE_SHORT="ghp_" ;;
    github_pat_*) TOKEN_TYPE="fine-grained PAT";         TOKEN_TYPE_SHORT="github_pat_" ;;
    ghs_*)        TOKEN_TYPE="GitHub App installation";  TOKEN_TYPE_SHORT="ghs_" ;;
    gho_*)        TOKEN_TYPE="OAuth user-to-server";     TOKEN_TYPE_SHORT="gho_" ;;
    ghu_*)        TOKEN_TYPE="OAuth user";               TOKEN_TYPE_SHORT="ghu_" ;;
    ghr_*)        TOKEN_TYPE="OAuth refresh";            TOKEN_TYPE_SHORT="ghr_" ;;
    *)            TOKEN_TYPE="unknown";                  TOKEN_TYPE_SHORT="${TOKEN_PREFIX}" ;;
esac

# Masked form for any error output (never the raw token)
TOKEN_MASKED="${TOKEN_TYPE_SHORT}***"

# ---- Dependency checks ---------------------------------------------------
for bin in curl jq; do
    if ! command -v "$bin" >/dev/null 2>&1; then
        echo -e "${RED}❌ Required command not found: $bin${NC}" >&2
        exit 3
    fi
done

# ---- Helper: GET request, returns "<status>|<headers_lower>|<body>" ------
# Uses a single curl call; outputs status code on first line, then headers, then blank line, then body.
# We keep token only in -H argument vector (not env, not file, not URL).
gh_get() {
    local path="$1"
    local url="${API_HOST}${path}"
    local raw
    raw="$(curl -sS \
        -o /dev/stdout \
        -w '\n__HTTP_STATUS__:%{http_code}\n' \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        -H "User-Agent: check-gh-token" \
        -D - \
        "$url" 2>&1)" || {
            echo -e "${RED}❌ Network error contacting ${url}${NC}" >&2
            return 3
        }
    printf '%s' "$raw"
}

# Extract a header value (case-insensitive) from raw curl output.
# $1 = raw output, $2 = header name (lowercased)
extract_header() {
    local raw="$1"
    local name="$2"
    # Headers are lines until first blank line. Match case-insensitively.
    printf '%s\n' "$raw" \
        | awk -v hdr="$name" '
            BEGIN { IGNORECASE=1; in_headers=1 }
            /^HTTP\// { in_headers=1; next }
            in_headers && /^[[:space:]]*$/ { in_headers=0 }
            in_headers {
                line = $0
                sub(/\r$/, "", line)
                idx = index(line, ":")
                if (idx > 0) {
                    key = substr(line, 1, idx-1)
                    val = substr(line, idx+1)
                    sub(/^[[:space:]]+/, "", val)
                    sub(/[[:space:]]+$/, "", val)
                    if (tolower(key) == tolower(hdr)) print val
                }
            }
        ' | tail -n 1
}

extract_status() {
    local raw="$1"
    # Last HTTP/x.y line (handles redirects). Output integer code.
    printf '%s\n' "$raw" \
        | awk '/^HTTP\// { code=$2 } END { print code }'
}

extract_body() {
    local raw="$1"
    # Body = everything after the last blank line that follows a final headers block.
    # Strip our sentinel line if present.
    printf '%s\n' "$raw" \
        | awk '
            BEGIN { headers=1; body="" }
            /^HTTP\// { headers=1; body=""; next }
            headers && /^\r?$/ { headers=0; next }
            !headers { body = body $0 ORS }
            END { printf "%s", body }
        ' \
        | sed '/^__HTTP_STATUS__:/d'
}

# ---- Primary call: /user -------------------------------------------------
RAW_USER="$(gh_get "/user" || true)"
STATUS_USER="$(extract_status "$RAW_USER")"
BODY_USER="$(extract_body "$RAW_USER")"

if [ "$STATUS_USER" = "401" ]; then
    if [ "$JSON_OUT" = true ]; then
        printf '{"valid":false,"status":401,"token_type":"%s","error":"invalid or expired token"}\n' "$TOKEN_TYPE"
    else
        echo -e "${RED}❌ Token invalid or expired (401)${NC}"
        echo -e "   Token: ${TOKEN_MASKED}"
        echo -e "   Type:  ${TOKEN_TYPE}"
    fi
    exit 2
fi

if [ "$STATUS_USER" != "200" ]; then
    if [ "$JSON_OUT" = true ]; then
        printf '{"valid":false,"status":%s,"token_type":"%s","error":"unexpected status from /user"}\n' "$STATUS_USER" "$TOKEN_TYPE"
    else
        echo -e "${RED}❌ Unexpected status from /user: ${STATUS_USER}${NC}"
        echo -e "${DIM}${BODY_USER}${NC}"
    fi
    exit 3
fi

# Headers
SCOPES="$(extract_header "$RAW_USER" "x-oauth-scopes")"
ACCEPTED_SCOPES="$(extract_header "$RAW_USER" "x-accepted-oauth-scopes")"
EXPIRY="$(extract_header "$RAW_USER" "github-authentication-token-expiration")"
[ -z "$EXPIRY" ] && EXPIRY="$(extract_header "$RAW_USER" "x-github-authentication-token-expiration")"
SSO="$(extract_header "$RAW_USER" "x-github-sso")"
RL_LIMIT="$(extract_header "$RAW_USER" "x-ratelimit-limit")"
RL_REMAINING="$(extract_header "$RAW_USER" "x-ratelimit-remaining")"
RL_RESET="$(extract_header "$RAW_USER" "x-ratelimit-reset")"

# Body
LOGIN="$(printf '%s' "$BODY_USER" | jq -r '.login // ""' 2>/dev/null || echo "")"
USER_ID="$(printf '%s' "$BODY_USER" | jq -r '.id // ""' 2>/dev/null || echo "")"
USER_TYPE="$(printf '%s' "$BODY_USER" | jq -r '.type // ""' 2>/dev/null || echo "")"
NAME="$(printf '%s' "$BODY_USER" | jq -r '.name // ""' 2>/dev/null || echo "")"
EMAIL="$(printf '%s' "$BODY_USER" | jq -r '.email // ""' 2>/dev/null || echo "")"

# ---- Capability probes ---------------------------------------------------
# Each probe: capture status only. No body parsing required (we just want pass/fail).
probe() {
    local path="$1"
    local raw
    raw="$(curl -sS -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        -H "User-Agent: check-gh-token" \
        "${API_HOST}${path}" 2>/dev/null || echo "000")"
    printf '%s' "$raw"
}

PROBE_REPOS=""
PROBE_ORGS=""
PROBE_KEYS=""
PROBE_NOTIFS=""
PROBE_RATELIMIT=""
ORGS_COUNT=""

if [ "$NO_PROBE" = false ]; then
    PROBE_REPOS="$(probe "/user/repos?per_page=1")"
    PROBE_ORGS_RAW="$(curl -sS -w '\n__HTTP_STATUS__:%{http_code}' \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "User-Agent: check-gh-token" \
        "${API_HOST}/user/orgs" 2>/dev/null || echo "")"
    PROBE_ORGS="$(printf '%s' "$PROBE_ORGS_RAW" | awk -F: '/^__HTTP_STATUS__:/{print $2}' | tr -d '[:space:]')"
    if [ "$PROBE_ORGS" = "200" ]; then
        ORGS_BODY="$(printf '%s' "$PROBE_ORGS_RAW" | sed '/^__HTTP_STATUS__:/d')"
        ORGS_COUNT="$(printf '%s' "$ORGS_BODY" | jq 'length' 2>/dev/null || echo "?")"
    fi
    PROBE_KEYS="$(probe "/user/keys")"
    PROBE_NOTIFS="$(probe "/notifications?per_page=1")"
    PROBE_RATELIMIT="$(probe "/rate_limit")"
fi

# ---- Helpers for output --------------------------------------------------
fmt_status() {
    case "$1" in
        200|201|204) echo -e "${GREEN}✅${NC}" ;;
        401)         echo -e "${RED}❌ (401)${NC}" ;;
        403)         echo -e "${RED}❌ (403 forbidden)${NC}" ;;
        404)         echo -e "${RED}❌ (404)${NC}" ;;
        "")          echo -e "${DIM}—${NC}" ;;
        *)           echo -e "${YELLOW}⚠️  ($1)${NC}" ;;
    esac
}

human_time_until() {
    local ts="$1"
    local now diff
    now="$(date +%s)"
    diff=$(( ts - now ))
    if [ "$diff" -lt 0 ]; then echo "expired"; return; fi
    if [ "$diff" -lt 60 ]; then echo "${diff}s"; return; fi
    if [ "$diff" -lt 3600 ]; then echo "$((diff/60))m"; return; fi
    if [ "$diff" -lt 86400 ]; then echo "$((diff/3600))h $(((diff%3600)/60))m"; return; fi
    echo "$((diff/86400))d"
}

# ---- JSON output ---------------------------------------------------------
if [ "$JSON_OUT" = true ]; then
    # Build with jq to handle escaping. NEVER include the raw token.
    jq -n \
        --arg token_type "$TOKEN_TYPE" \
        --arg token_source "$TOKEN_SOURCE" \
        --arg login "$LOGIN" \
        --arg user_id "$USER_ID" \
        --arg user_type "$USER_TYPE" \
        --arg name "$NAME" \
        --arg email "$EMAIL" \
        --arg scopes "$SCOPES" \
        --arg accepted_scopes "$ACCEPTED_SCOPES" \
        --arg expiry "$EXPIRY" \
        --arg sso "$SSO" \
        --arg rl_limit "$RL_LIMIT" \
        --arg rl_remaining "$RL_REMAINING" \
        --arg rl_reset "$RL_RESET" \
        --arg probe_repos "$PROBE_REPOS" \
        --arg probe_orgs "$PROBE_ORGS" \
        --arg probe_keys "$PROBE_KEYS" \
        --arg probe_notifs "$PROBE_NOTIFS" \
        --arg probe_ratelimit "$PROBE_RATELIMIT" \
        --arg orgs_count "$ORGS_COUNT" \
        '{
            valid: true,
            token: { type: $token_type, source: $token_source },
            user: {
                login: $login,
                id: ($user_id | tonumber? // $user_id),
                type: $user_type,
                name: $name,
                email: $email
            },
            scopes: ($scopes | split(", ") | map(select(. != ""))),
            accepted_scopes: $accepted_scopes,
            expiration: $expiry,
            sso: $sso,
            rate_limit: {
                limit: ($rl_limit | tonumber? // null),
                remaining: ($rl_remaining | tonumber? // null),
                reset: ($rl_reset | tonumber? // null)
            },
            probes: {
                list_repos: $probe_repos,
                list_orgs: $probe_orgs,
                user_keys: $probe_keys,
                notifications: $probe_notifs,
                rate_limit_endpoint: $probe_ratelimit,
                orgs_count: ($orgs_count | tonumber? // null)
            }
        }'
    exit 0
fi

# ---- Pretty output -------------------------------------------------------
echo -e "${CYAN}🔍 GitHub Token Inspection${NC}"
echo -e "   Token type:   ${TOKEN_TYPE} (${TOKEN_TYPE_SHORT})"
echo -e "   Token source: ${TOKEN_SOURCE}"
echo ""

echo -e "${GREEN}✅ Authenticated${NC}"
[ -n "$LOGIN" ]     && echo -e "   Login:        ${LOGIN}"
[ -n "$USER_ID" ]   && echo -e "   ID:           ${USER_ID}"
[ -n "$USER_TYPE" ] && echo -e "   Type:         ${USER_TYPE}"
[ -n "$NAME" ]      && echo -e "   Name:         ${NAME}"
[ -n "$EMAIL" ]     && echo -e "   Email:        ${EMAIL}"
echo ""

# Scopes / permissions
if [ -n "$SCOPES" ]; then
    echo -e "📋 Scopes:        ${SCOPES}"
elif [ "$TOKEN_TYPE" = "fine-grained PAT" ]; then
    echo -e "📋 Scopes:        ${DIM}n/a — fine-grained tokens use per-resource permissions (not enumerable from a single API call)${NC}"
elif [ "$TOKEN_TYPE" = "GitHub App installation" ]; then
    echo -e "📋 Scopes:        ${DIM}n/a — App tokens use installation permissions${NC}"
else
    echo -e "📋 Scopes:        ${DIM}(none returned)${NC}"
fi

# Expiration
if [ -n "$EXPIRY" ]; then
    # Try to compute days remaining (best-effort; date format from GitHub: "2026-08-15 14:32:00 UTC")
    EXP_TS="$(date -j -f "%Y-%m-%d %H:%M:%S %Z" "$EXPIRY" "+%s" 2>/dev/null || echo "")"
    if [ -n "$EXP_TS" ]; then
        echo -e "🕒 Expires:       ${EXPIRY} (in $(human_time_until "$EXP_TS"))"
    else
        echo -e "🕒 Expires:       ${EXPIRY}"
    fi
else
    echo -e "🕒 Expires:       ${DIM}no expiration set${NC}"
fi

# SSO
if [ -n "$SSO" ]; then
    echo -e "🌐 SSO:           ${SSO}"
fi

# Rate limit
if [ -n "$RL_LIMIT" ]; then
    if [ -n "$RL_RESET" ]; then
        RESET_IN="$(human_time_until "$RL_RESET")"
        echo -e "⚡ Rate limit:    ${RL_REMAINING} / ${RL_LIMIT} (resets in ${RESET_IN})"
    else
        echo -e "⚡ Rate limit:    ${RL_REMAINING} / ${RL_LIMIT}"
    fi
fi

# Probes
if [ "$NO_PROBE" = false ]; then
    echo ""
    echo -e "🔓 Capability probes:"
    echo -e "   $(fmt_status "$PROBE_REPOS")  list user repos"
    if [ "$PROBE_ORGS" = "200" ] && [ -n "$ORGS_COUNT" ]; then
        echo -e "   $(fmt_status "$PROBE_ORGS")  list orgs (${ORGS_COUNT})"
    else
        echo -e "   $(fmt_status "$PROBE_ORGS")  list orgs"
    fi
    echo -e "   $(fmt_status "$PROBE_KEYS")  user SSH keys (admin:public_key)"
    echo -e "   $(fmt_status "$PROBE_NOTIFS")  notifications"
    echo -e "   $(fmt_status "$PROBE_RATELIMIT")  rate_limit endpoint"
fi

exit 0
