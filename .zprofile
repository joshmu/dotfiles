# ----------------------
# DOCKER
# ----------------------
# FIX: docker host not visible to sam cli
export DOCKER_HOST=unix:///Users/joshmu/.docker/run/docker.sock

# GPG SIGNING KEY
export GPG_TTY=$(tty)

# Disable telemetry across all tools which support it
# https://consoledonottrack.com/
export DO_NOT_TRACK=1

# AICHAT
# https://github.com/sigoden/aichat/wiki/Environment-Variables#client-related-envs
AICHAT_PLATFORM=openai
