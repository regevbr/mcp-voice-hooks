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

## Installation in Your Own Project

1. **Install the hooks** (first time only):

   ```bash
   npx mcp-voice-hooks install-hooks
   ```

   This will:
   - Install hook scripts to `~/.mcp-voice-hooks/hooks/`
   - Configure your project's `.claude/settings.json`

2. **Add the MCP server**:

   Run the following command to automatically add the MCP server to your current project in `~/.claude.json`:

    ```bash
    claude mcp add voice-hooks npx mcp-voice-hooks
    ```

   or manually add the following to your project's `.mcp.json`:

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

3. **Start Claude Code**:

   ```bash
   claude
   ```

4. **Open the voice interface** at <http://localhost:5111> and start speaking! Note: you need to send one text message to Claude to trigger the voice hooks.

   The default port is 5111. To use a different port, add to your project's `.claude/settings.json`:

   ```json
   {
     "env": {
       "MCP_VOICE_HOOKS_PORT": "8080"
     }
   }
   ```

## Development Mode

If you're developing mcp-voice-hooks itself:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/mcp-voice-hooks.git
cd mcp-voice-hooks

# 2. Install dependencies
npm install

# 3. Link the package locally
npm link

# 4. Install hooks (one time)
npx mcp-voice-hooks install-hooks

# 5. Start Claude Code
claude
```

**Important**: When developing with `npm link`:

- Claude runs the compiled JavaScript from the `dist` folder, not your TypeScript source
- After making changes to the TypeScript code, you must run `npm run build`
- Then restart Claude Code to use the updated compiled code

### Hot Reload

For hot reload during development, you can run the development server with

```bash
npm run dev-unified
```

and then configure claude to use the mcp proxy like so:

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

## Voice responses (Mac only)

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

### High quality voice responses

These voice responses are spoken by your Mac's system voice.

Configure in `System Settings > Accessibility > Spoken Content > System Voice`

I recommend using a Siri voice, as they are much higher quality.

Click the info icon next to the system voice dropdown. Search for "Siri" to find the highest quality voices. You'll have to trigger a download of the voice.

It may take a while to download.

Once it's downloaded, you can select it in the system voice dropdown.

Test it with the bash command:

```bash
say "Hi, this is your mac system voice"
```

## Uninstallation

To completely remove mcp-voice-hooks from your system:

1. **Remove the hook files**:

   ```bash
   rm -rf ~/.mcp-voice-hooks
   ```

2. **Remove the hooks from your Claude settings**:

   Edit your project's `.claude/settings.json` file and remove the entire `"hooks"` section that contains references to mcp-voice-hooks:

   ```json
   {
     "hooks": {
       "Stop": [...],
       "PreToolUse": [...],
       "PostToolUse": [...]
     }
   }
   ```

3. **Remove the MCP server configuration**:

   Using Claude CLI:

   ```bash
   claude mcp remove voice-hooks
   ```

   Or manually edit your project's `.mcp.json` file and remove the `"voice-hooks"` server configuration.

4. **Restart Claude Code** to apply the changes.
