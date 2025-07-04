# mcp-voice-hooks

Real-time voice interaction for Claude Code. Speak naturally while Claude works - interrupt, redirect, or provide continuous feedback without stopping.

## Demo

[![Voice Hooks Demo](https://img.youtube.com/vi/KpkxvJ65gbM/0.jpg)](https://youtu.be/KpkxvJ65gbM)

## Overview

mcp-voice-hooks enables continuous voice conversations with AI assistants by:

- Capturing voice input in real-time through a web interface
- Queuing utterances for processing by Claude Code
- Using hooks to ensure Claude checks for voice input before tool use and before stopping
- Allowing natural interruptions like "No, stop that" or "Wait, try something else"

## Features

- 🎤 **Real-time Voice Capture**: Browser-based speech recognition with automatic segmentation
- 🔄 **Continuous Interaction**: Keep talking while Claude works - no need to stop between commands
- 🪝 **Smart Hook System**: Pre-tool and stop hooks ensure Claude always checks for your input

## Installation

### For Users (NPX - Recommended)

The easiest way to use mcp-voice-hooks is via npx:

```bash
# Add to your project's .mcp.json
{
  "mcpServers": {
    "voice-hooks": {
      "type": "stdio", 
      "command": "npx",
      "args": ["mcp-voice-hooks"],
      "env": {}
    }
  }
}

# Start Claude Code in your project
claude
```

The first run will automatically:
- Install hooks to `~/.mcp-voice-hooks/hooks/`
- Configure your project's `.claude/settings.json`
- Start the voice hooks server
- Open http://localhost:3000 for the voice interface

### For Development

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-voice-hooks.git
cd mcp-voice-hooks

# Install dependencies
npm install

# Link for local testing
npm link

# Test the NPX command
npx mcp-voice-hooks
```

## Quick Start

Once installed, simply start Claude Code in any project with mcp-voice-hooks configured:

```bash
claude
```

Then open http://localhost:3000 in your browser to use the voice interface.

### Development Mode

For development/debugging, you can run the server separately:

**Terminal 1 - Start the development server:**

```bash
npm run dev-unified
```

**Terminal 2 - Configure and start Claude Code:**

First, update `.mcp.json` to use proxy mode:

```json
{
  "mcpServers": {
    "voice-hooks": {
      "type": "stdio",
      "command": "npm",
      "args": ["run", "mcp-proxy"],
      "env": {}
    }
  }
}
```

Then start Claude Code:

```bash
cd mcp-voice-hooks
claude
```

## Manual Setup (Alternative)

If you prefer manual setup instead of NPX:

1. **Add MCP server to your project's `.mcp.json`**:

   ```json
   {
     "mcpServers": {
       "voice-hooks": {
         "type": "stdio",
         "command": "npx",
         "args": ["mcp-voice-hooks"],
         "env": {}
       }
     }
   }
   ```

2. **The NPX command will automatically**:
   - Install hooks to `~/.mcp-voice-hooks/hooks/`
   - Configure your project's `.claude/settings.json` with:

   ```json
   {
     "hooks": {
       "PreToolUse": [{
         "matcher": "^(?!mcp__voice-hooks__).*",
         "hooks": [{
           "type": "command",
           "command": "sh ~/.mcp-voice-hooks/hooks/pre-tool-hook.sh"
         }]
       }],
       "Stop": [{
         "matcher": "",
         "hooks": [{
           "type": "command",
           "command": "sh ~/.mcp-voice-hooks/hooks/stop-hook.sh"
         }]
       }],
       "PostToolUse": [{
         "matcher": "^mcp__voice-hooks__",
         "hooks": [{
           "type": "command", 
           "command": "sh ~/.mcp-voice-hooks/hooks/post-tool-voice-hook.sh"
         }]
       }]
     }
   }
   ```

## WIP voice responses

Add the post tool hook to your claude settings:

```json
{
   {
     "hooks": {
        "PostToolUse": [
            {
                "matcher": "^mcp__voice-hooks__",
                "hooks": [
                    {
                        "type": "command",
                        "command": "./.claude/hooks/post-tool-voice-hook.sh"
                    }
                ]
            }
        ]
     },
     "env": {
       "VOICE_RESPONSES_ENABLED": "true"
     }
   }
}
```

### Configuration

Voice responses are disabled by default. To enable them:

Add to your Claude Code settings JSON:

```json
{
  "env": {
    "VOICE_RESPONSES_ENABLED": "true"
  }
}
```

To disable voice responses, set the value to `false` or remove the setting entirely.
