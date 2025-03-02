#!/bin/bash

# get-my-context.sh
# Queries an n8n webhook endpoint to retrieve personalized context based on natural language input
#
# This script sends a request to an n8n workflow that can:
# - Search through email messages
# - Look up calendar events
# - Find relevant files and documents
# - Return contextual information based on the query
#
# Usage:
#   ./get-my-context.sh "what meetings do I have today"
#   ./get-my-context.sh "find emails about project X"
#   ./get-my-context.sh "documents related to topic Y"
#
# The n8n webhook will process the natural language query and return relevant
# context from configured data sources like Gmail, Google Calendar, etc.

query="$1"

if [ -z "$query" ]; then
  echo "Usage: $0 <query>"
  echo "Provide a natural language query to search your personal context"
  exit 1
fi

# Call the n8n webhook endpoint to process the query and retrieve context
curl --location "https://n8n.drk.gdn/webhook/get-my-context" \
  --header "Content-Type: application/json" \
  --data "{\"text\": \"$query\"}"
