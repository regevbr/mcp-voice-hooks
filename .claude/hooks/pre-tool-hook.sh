#!/bin/bash
PORT="${MCP_VOICE_HOOKS_PORT:-5111}"
curl -s -X POST http://localhost:${PORT}/api/hooks/pre-tool || echo '{"decision": "approve", "reason": "voice-hooks unavailable"}'