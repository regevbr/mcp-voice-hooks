# Claude Code Voice Mode

Real-time voice interaction for Claude Code. Speak naturally while Claude works - interrupt, redirect, or provide continuous feedback without stopping.

Optionally enable text-to-speech to have Claude speak back to you.

## Demo

[![Voice Hooks Demo](https://img.youtube.com/vi/zx2aXTmWYYQ/0.jpg)](https://youtu.be/zx2aXTmWYYQ)

## Quick Start

```bash
# Install hooks in the current project directory (one time)
npx mcp-voice-hooks install-hooks

# Add the MCP server to the current project (one time)
claude mcp add voice-hooks npx mcp-voice-hooks

# Start Claude Code
claude
```

Then open the voice interface at <http://localhost:5111> in chrome or safari and click "Start Listening".

## Overview

mcp-voice-hooks enables continuous voice conversations with AI assistants by:

- Capturing voice input in real-time through a web interface
- Queuing utterances for processing by Claude Code
- Using hooks to ensure Claude checks for voice input before tool use and before stopping
- Allowing natural interruptions like "No, stop that" or "Wait, try something else"

## Browser Compatibility

- ✅ **Chrome**: Full support for speech recognition, browser text-to-speech, and system text-to-speech
- ⚠️ **Safari**: Full support for speech recognition, but only system text-to-speech is supported
- ❌ **Edge**: Speech recognition not working on Apple Silicon (language-not-supported error)

## Voice responses

There are two options for voice responses:

1. Browser Text-to-Speech
2. System Text-to-Speech

### Selecting and downloading high quality System Voices (Mac only)

Mac has built-in text to speech, but high quality voices are not available by default.

You can download high quality voices from the system voice menu: `System Settings > Accessibility > Spoken Content > System Voice`

Click the info icon next to the system voice dropdown. Search for "Siri" to find the highest quality voices. You'll have to trigger a download of the voice.

Once it's downloaded, you can select it in the system voice menu.

Test it with the bash command:

```bash
say "Hi, this is your Mac system voice"
```

To use Siri voices with voice-hooks, you need to set your system voice and select "Mac System Voice" in the voice-hooks browser interface.

Other downloaded voices will show up in the voice dropdown in the voice-hooks browser interface so you can select them there directly, instead of using the "Mac System Voice" option.

### Selecting and downloading high quality Browser Voices

## Manual Hook Installation

The hooks are automatically installed/updated when the MCP server starts. However, if you need to manually install or reconfigure the hooks:

```bash
npx mcp-voice-hooks install-hooks
```

This will configure your project's `.claude/settings.json` with the necessary hook commands.

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

- **Intermittent Stop Hook Execution**: Claude Code's Stop hooks are not triggered if the agent stops immediately after a tool call. This results in the assistant occasionally stopping without checking for voice input. This will be fixed in Claude Code 1.0.45. [github issue](https://github.com/anthropics/claude-code/issues/3113#issuecomment-3047324928)

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

### Configuration

#### Port Configuration

The default port is 5111. To use a different port, add to your project's `.claude/settings.json`:

```json
{
  "env": {
    "MCP_VOICE_HOOKS_PORT": "8080"
  }
}
```

#### Browser Auto-Open

When running in MCP-managed mode, the browser will automatically open if no frontend connects within 3 seconds. To disable this behavior:

```json
{
  "env": {
    "MCP_VOICE_HOOKS_AUTO_OPEN_BROWSER": "false"
  }
}
```
