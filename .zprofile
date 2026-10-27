# ----------------------
# DOCKER
# ----------------------
# Colima (Docker Desktop replaced 2026-10-28); explicit for tools that ignore docker contexts (sam cli)
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock

# GPG SIGNING KEY
export GPG_TTY=$(tty)

# Disable telemetry across all tools which support it
# https://consoledonottrack.com/
# THIS PREVENT CLAUDE CODE REMOTE CONTROL FEATURTES FROM WORKING, SO COMMENTED OUT FOR NOW
# export DO_NOT_TRACK=1

# AICHAT
# https://github.com/sigoden/aichat/wiki/Environment-Variables#client-related-envs
AICHAT_PLATFORM=openai
