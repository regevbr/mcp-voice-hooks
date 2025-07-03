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

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-voice-hooks.git
cd mcp-voice-hooks

# Install dependencies
npm install

# Build the project
npm run build
```

## Quick Start to experiment with the voice interface

```bash
# Start the development server
npm run dev-unified

# In another terminal, start claude code from the root of the project
cd mcp-voice-hooks
claude
```

## To use in your own project

1. **Copy the hooks to your project**:
   ```bash
   # Copy the hooks directory to your project
   cp -r /path/to/mcp-voice-hooks/.claude/hooks /path/to/your-project/.claude/
   
   # Make the hook files executable
   chmod +x /path/to/your-project/.claude/hooks/*.sh
   ```

2. **Configure Claude Code**:

   copy the mcp settings from `.mcp.json` to your own project

3. **Configure hooks** in your claude settings:

```json
{
   {
     "hooks": {
       "PreToolUse": [{
         "matcher": "^(?!mcp__voice-hooks__).*",
         "hooks": [{
           "type": "command",
           "command": "./.claude/hooks/pre-tool-hook.sh"
         }]
       }],
       "Stop": [{
         "matcher": "",
         "hooks": [{
           "type": "command",
           "command": "./.claude/hooks/stop-hook.sh"
         }]
       }]
     }
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
