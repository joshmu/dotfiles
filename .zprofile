# ----------------------
# DOCKER
# ----------------------
# FIX: docker host not visible to sam cli
export DOCKER_HOST=unix:///Users/joshmu/.docker/run/docker.sock

# GPG SIGNING KEY
export GPG_TTY=$(tty)

# Disable telemetry across all tools which support it
# https://consoledonottrack.com/
# THIS PREVENT CLAUDE CODE REMOTE CONTROL FEATURTES FROM WORKING, SO COMMENTED OUT FOR NOW
# export DO_NOT_TRACK=1

# AICHAT
# https://github.com/sigoden/aichat/wiki/Environment-Variables#client-related-envs
AICHAT_PLATFORM=openai

# Added by Obsidian
export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"
