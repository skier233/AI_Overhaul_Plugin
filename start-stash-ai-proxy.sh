#!/bin/bash

# StashAI Proxy Server Startup Script
# This script starts the proxy server that bridges Stash and StashAI Server

set -e

# Configuration
PROXY_PORT="${STASH_AI_PROXY_PORT:-9999}"
STASH_AI_URL="${STASH_AI_SERVER_URL:-http://localhost:8080}"
STASH_URL="${STASH_SERVER_URL:-http://localhost:9999}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting StashAI Proxy Server..."
echo "   Proxy Port: $PROXY_PORT"
echo "   StashAI Server: $STASH_AI_URL"
echo "   Stash Server: $STASH_URL"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to run the proxy server."
    exit 1
fi

# Check if required dependencies are installed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd "$SCRIPT_DIR"
    npm install
fi

# Start the proxy server
cd "$SCRIPT_DIR"
exec node dev-proxy.js --port="$PROXY_PORT" --stash-ai-url="$STASH_AI_URL" --stash-url="$STASH_URL"