# Text-to-Speech for Claude Code

Text-to-Speech for Claude Code allows Claude to speak back to you using natural-sounding voices.

It uses the new [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) to enable Claude to speak responses aloud.

Choose from browser-based voices or high-quality Mac system voices. No API keys needed.

## Installation

Installation is easy.

### 1. Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### 2. Install Text-to-Speech Support

```bash
npx mcp-voice-hooks@latest install-hooks
claude mcp add tts-hooks npx mcp-voice-hooks@latest
```

## Usage

### 1. Start Claude Code

```bash
claude
```

### 2. Configure Text-to-Speech

The browser interface will automatically open (<http://localhost:5111>).

1. Enable "Allow Claude to speak back to you" toggle
2. Choose your preferred voice and settings
3. Test with the "Test Voice" button

### 3. Chat with Claude

Claude will now be able to use the `speak` tool to read responses aloud.

Type your questions to Claude as normal. Ask Claude to use the `speak` tool if you want audio responses.

## Browser Compatibility

- ✅ **Chrome**: Full support for browser text-to-speech and system text-to-speech
- ⚠️ **Safari**: Full support for browser text-to-speech and system text-to-speech  
- ⚠️ **Edge**: Limited voice selection, but functional

## Voice Options

### System Voice (Recommended)
- Uses Mac's built-in `say` command
- High-quality voices
- Download additional voices in System Preferences > Accessibility > Spoken Content > System Voice

### Browser Voices
- **Cloud voices**: High-quality voices that require internet connection
- **Local voices**: Lower-quality voices that work offline

## Configuration

### Environment Variables

- `MCP_VOICE_HOOKS_PORT`: Server port (default: 5111)
- `MCP_VOICE_HOOKS_AUTO_OPEN_BROWSER`: Auto-open browser (default: true)

### Voice Settings

Voice preferences are saved in your browser's localStorage and persist across sessions.

## Privacy

- All text-to-speech processing happens locally on your device
- No data is sent to external services
- System voice uses Mac's built-in speech synthesis
- Browser voices may use cloud services depending on your selection

## Troubleshooting

### Claude isn't speaking

1. Make sure the browser interface is open and the toggle is enabled
2. Check that you've selected a voice in the dropdown
3. Test the voice with the "Test Voice" button
4. Ask Claude to explicitly use the `speak` tool: "Please use the speak tool to say hello"

### System voice not working

1. Make sure you're on macOS (system voice only works on Mac)
2. Try downloading additional voices in System Preferences
3. Test the system voice directly: `say "hello"`

### Port conflicts

If port 5111 is in use, set a different port:

```bash
export MCP_VOICE_HOOKS_PORT=5112
claude mcp restart tts-hooks
```

## Development

### Running from source

```bash
git clone https://github.com/your-repo/mcp-voice-hooks
cd mcp-voice-hooks
npm install
npm run build
npm run dev-unified
```

### Testing

```bash
npm test
```

## Uninstall

```bash
npx mcp-voice-hooks@latest uninstall
claude mcp remove tts-hooks
```

## License

MIT License - see LICENSE file for details.