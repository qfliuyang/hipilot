#!/bin/bash
# MCP Wrapper - Calls MCP servers directly via JSON-RPC
# Usage: mcp_wrapper.sh <server> <tool_name> <json_args>
# Example: mcp_wrapper.sh eda send_to_terminal '{"tcl":"puts HELLO"}'

NODE_PATH="/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin"
HIPILOT_ROOT="/home/EDA/hipilot/current"

SERVER="$1"
TOOL_NAME="$2"
ARGS="$3"

if [ -z "$SERVER" ] || [ -z "$TOOL_NAME" ]; then
    echo '{"error": "Usage: mcp_wrapper.sh <server> <tool_name> <json_args>"}'
    exit 1
fi

SERVER_PATH="$HIPILOT_ROOT/servers/$SERVER/index.js"

if [ ! -f "$SERVER_PATH" ]; then
    echo "{\"error\": \"MCP server not found at $SERVER_PATH\"}"
    exit 1
fi

# Build JSON-RPC request
REQUEST='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"'$SERVER'.'$TOOL_NAME'","arguments":'$ARGS'}}'

# Call MCP server
export PATH="$NODE_PATH:$PATH"
export HIPILOT_SESSION="hipilot"

echo "$REQUEST" | "$NODE_PATH/node" "$SERVER_PATH" 2>&1
