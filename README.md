# mcp-voice-hooks

Real-time voice interaction for Claude Code. Speak naturally while Claude works - interrupt, redirect, or provide continuous feedback without stopping.

Optionally enable text-to-speech to have Claude speak back to you.

Mac only for now.

## Demo

[![Voice Hooks Demo](https://img.youtube.com/vi/KpkxvJ65gbM/0.jpg)](https://youtu.be/KpkxvJ65gbM)

## Overview

mcp-voice-hooks enables continuous voice conversations with AI assistants by:

- Capturing voice input in real-time through a web interface
- Queuing utterances for processing by Claude Code
- Using hooks to ensure Claude checks for voice input before tool use and before stopping
- Allowing natural interruptions like "No, stop that" or "Wait, try something else"

## Browser Compatibility

- ✅ **Chrome**: Full support for speech recognition and text-to-speech
- ✅ **Safari**: Full support for speech recognition and text-to-speech
- ❌ **Edge**: Speech recognition not working on Apple Silicon (language-not-supported error)

## Installation in Your Own Project

1. **Add the MCP server**:

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

2. **Start Claude Code**:

   ```bash
   claude
   ```

   **Important**: After the first-time installation, you will need to restart Claude for the hooks to take effect. This is because the hooks are automatically installed when the MCP server starts for the first time.

3. **Open the voice interface** at <http://localhost:5111> and start speaking!

  You need to send one text message to Claude to trigger the voice hooks.

## Voice responses

There are two options for voice responses:

1. Browser Text-to-Speech (Cloud)
2. Browser Text-to-Speech (Local)
3. Mac System Voice

### Selecting and downloading high quality System Voices (Mac only)

When "Mac System Voice" is selected, the system uses macOS's built-in `say` command.

Configure the system voice in `System Settings > Accessibility > Spoken Content > System Voice`

I recommend using a Siri voice, as they are much higher quality.

Click the info icon next to the system voice dropdown. Search for "Siri" to find the highest quality voices. You'll have to trigger a download of the voice.

It may take a while to download.

Once it's downloaded, you can select it in the system voice dropdown.

Test it with the bash command:

```bash
say "Hi, this is your mac system voice"
```

You can also download other high quality voices in the same way. Other voices will show up in the browser voice dropdown, but for Siri voices you need to set the system voice and select Mac System Voice in the browser voice dropdown.

## Manual Hook Installation

The hooks are automatically installed/updated when the MCP server starts. However, if you need to manually install or reconfigure the hooks:

```bash
npx mcp-voice-hooks install-hooks
```

This will configure your project's `.claude/settings.json` with the necessary inline hook commands.

## Uninstallation

To completely remove MCP Voice Hooks:

```bash
# Remove from Claude MCP servers
claude mcp remove voice-hooks
```

```bash
# Also remove hooks and settings
npx mcp-voice-hooks uninstall
```

This will:

- Clean up voice hooks from your project's `.claude/settings.json`
- Preserve any custom hooks you've added

## Known Limitations

- **Intermittent Stop Hook Execution**: Claude Code's Stop hooks are not triggered consistently. Sometimes the assistant can end responses without the Stop hook being executed. I believe this is an issue with Claude Code's hook system, not with mcp-voice-hooks. When working correctly, the Stop hook should prevent the assistant from stopping without first checking for voice input.

## Development Mode

If you're developing mcp-voice-hooks itself:

```bash
# 1. Clone the repository
git clone https://github.com/johnmatthewtennant/mcp-voice-hooks.git
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
- After making changes to **TypeScript files** (`src/*.ts`), you must run `npm run build`
- For changes to **browser files** (`public/*`), just restart Claude Code
- Then restart Claude Code to use the updated code

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

### Port Configuration

The default port is 5111. To use a different port, add to your project's `.claude/settings.json`:

   ```json
   {
     "env": {
       "MCP_VOICE_HOOKS_PORT": "8080"
     }
   }
   ```
