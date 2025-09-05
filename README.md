# Voice Interface for Claude Code

A complete voice interface for Claude Code with both **Speech-to-Text** and **Text-to-Speech** capabilities.

- **🎤 Voice Input**: Speak to Claude using the Home key (powered by [Whisper](https://openai.com/research/whisper))
- **🔊 Voice Output**: Claude can speak responses back to you using natural-sounding voices

**Everything runs locally for complete privacy - no API keys needed, no data sent to external services.**

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

1. **Click anywhere on the page to enable voice** (required by browser security policy)
2. Choose your preferred voice and settings
3. Test with the "Test Voice" button

### 3. Chat with Claude

Claude can now read responses aloud using voice output.

## Using Voice Output (Text-to-Speech)
You have several options:

1**Ask Claude to speak**: "Please speak your response" or "Use the speak tool to say hello"
2**Natural conversation**: After using `/speak` once, Claude will often automatically speak subsequent responses

## Voice Input (Speech-to-Text)

Voice input is powered by OpenAI's Whisper running locally on your machine for complete privacy.

### Using Voice Input

1. **Press the Home key** (or Menu key on some keyboards) to start voice recording (after the beep)
2. **Speak your message** - transcription happens in real-time
3. **Transcribed text is automatically typed** at your cursor position in Claude Code and will stop after a few seconds of silence

### Requirements

Voice input requires the following to be installed on your system:

- **Python 3**: For running Whisper
- **FFmpeg**: For audio processing (`brew install ffmpeg` on macOS)
- **PortAudio**: For microphone access (`brew install portaudio` on macOS)

These dependencies are automatically installed when you first run the MCP server.

### How It Works

1. The MCP server automatically downloads and sets up [whisper-typer-tool](https://github.com/regevbr/whisper-typer-tool)
2. Whisper runs in the background as a local server
3. Voice transcription happens entirely on your device - no data is sent anywhere
4. Press Home key anywhere in your system to start voice input

### Troubleshooting Voice Input

If voice input isn't working:

1. **Check dependencies**: Ensure Python 3, FFmpeg, and PortAudio are installed
2. **Check permissions**: Grant microphone access when prompted
3. **Test manually**: Navigate to `~/.mcp-voice-hooks/whisper-typer-tool` and run `python server.py`
4. **Check logs**: Look for error messages when starting the MCP server

## Browser Compatibility

- ✅ **Chrome**: Full support for browser text-to-speech and system text-to-speech
- ⚠️ **Safari**: Full support for browser text-to-speech and system text-to-speech  
- ⚠️ **Edge**: Limited voice selection, but functional

## Voice Output (Text-to-Speech) Options

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

## Privacy & Local Processing

**Everything runs on your device - your voice data never leaves your computer.**

### Voice Input (STT)
- **100% Local**: All speech recognition happens locally using OpenAI's Whisper model
- **No Network Required**: Transcription works completely offline after initial setup
- **No Data Sharing**: Audio never leaves your device - nothing sent to external services
- **Complete Privacy**: Your conversations remain private on your machine

### Voice Output (TTS)
- **System Voice (Recommended)**: Uses your operating system's built-in speech synthesis (completely local)
- **Browser Voices**: 
  - Local voices work offline and keep everything on your device
  - Cloud voices require internet but can be avoided for complete privacy
- **Your Choice**: Select local-only options for 100% offline operation

## Troubleshooting

### Claude isn't speaking

1. Make sure you've clicked anywhere on the browser page to enable voice (shown on page load)
2. Check that you've selected a voice in the dropdown
3. Test the voice with the "Test Voice" button
4. Ask Claude to explicitly use the `speak` tool: "Please use the speak tool to say hello"
5. If you reload the page, you'll need to click anywhere again to re-enable voice

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

## Acknowledgments

This project is forked from [mcp-voice-hooks](https://github.com/johnmatthewtennant/mcp-voice-hooks) by John Matthew Tennant. The original project provided the excellent foundation for text-to-speech integration with Claude Code. This fork adds speech-to-text capabilities via Whisper integration.

## License

MIT License - see LICENSE file for details.
