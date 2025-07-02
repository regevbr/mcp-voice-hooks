# MCP Voice Hooks - Roadmap

## Vision

Create an MCP server that enables real-time voice interaction with Claude Code and other MCP clients. The system will:

1. **Continuously listen** for voice input (or typed input during POC)
2. **Detect complete utterances** using LLM-based analysis
3. **Queue utterances** for consumption by MCP clients
4. **Provide hooks** for clients to check for new utterances before and after tool execution
5. **Enable voice feedback** with text-to-speech responses

## Architecture

### Browser UI

- Text Input
- Speech API integration
- Audio monitoring
- Queue monitoring

### MCP Server

- Text utterance classification
- Utterance Queue
- WebSocket Server
- TTS via `say` command

### Claude Code

- Hook Integration
- Tool Execution

## Project Phases & Roadmap

### Text-Based POC (Current Focus)

#### Core MCP Server

- [x] Research Claude Code hooks integration
- [x] Set up TypeScript MCP server project structure
- [ ] Implement utterance queue with basic MCP tools for LLM:
  - `get_recent_utterances(limit?: number)`
  - [ ] immediately returns none if there are no recent utterances (doesn't block or wait for an utterance)
- [ ] API for browser client to send text input to MCP server
  - [ ] `send_text_input(text: string)`
  - [ ] `get_recent_utterances(limit?: number)`
- [ ] Always categorize text input as a complete utterance for Phase 1
- [ ] Add utterance to queue with timestamp
- [ ] Unit test send_text_input, get_recent_utterances, wait_for_utterance

#### Browser Client

- [ ] Create simple HTML/JS client with text input
- [ ] Implement WebSocket/HTTP communication with MCP server
- [ ] Add real-time utterance submission
- [ ] Show utterances from server in a reverse chronological list with the status (pending, delivered)

#### Preliminary Hook Integration

- [ ] Test MCP server with Claude Code client
- [ ] Configure PostToolUse hooks to check for utterances

### Wait for utterance

- [ ] Add a `wait_for_utterance` tool to the MCP server: `wait_for_utterance(seconds_to_wait?: number)`
  - [ ] wait_for_utterance should block until an utterance is able to be dequeued or the timeout is reached (default 10 seconds). It should return immediately if there has been no utterance since the last time it timed out (we'll need to keep track of the last time it timed out)
- [ ] Configure the Stop hook to check if the LLM called `wait_for_utterance` for this Stop hook already. If not, require it to call `wait_for_utterance`. Store a state variable to track if the LLM has called `wait_for_utterance` for this Stop hook.

### Utterance classification

- [ ] Add server-side LLM integration for utterance completion detection (POC should use claude cli or sdk <https://docs.anthropic.com/en/docs/claude-code/sdk> to categorize utterances as complete or not)
- [ ] unit test the utterance classification

### Speech Recognition

- [ ] Integrate Web Speech API in browser client
- [ ] Add microphone input selection and monitoring
- [ ] Implement continuous speech recognition (Probably the way this should work is we should send candidate utterances to the server over and over again. Basically we should just keep adding the words as the user speaks them to these utterances, and keep sending longer and longer potential utterances to the server. And then once we get a response that an utterance was accepted or completed, then we pop that out of the current potential utterance, and we just send new words only that haven't yet been accepted into an utterance.)
- [ ] Add a button to start/stop listening

### Text-to-Speech

- [ ] Implement TTS using Mac's `say` command on the server
- [ ] Expose a `speak_text` MCP tool to speak text
- [ ] Update the `wait_for_utterance` tool to include a `text_to_speak_before_listening` parameter

## Technical Decisions

### Language Choice: TypeScript

- **Pros**: Easy browser integration, Node.js ecosystem, MCP SDK support
- **Cons**: Less robust audio processing than Python
- **Decision**: Start with TypeScript for simplicity, can migrate later if needed

### Audio Processing: Browser-based

- **Pros**: Built-in Web Speech API, no OS-level audio handling
- **Cons**: Privacy concerns, internet dependency
- **Decision**: Use browser for POC, evaluate alternatives later

### Architecture: Local Server + Browser Client

- **Pros**: Leverages browser capabilities, clean separation of concerns
- **Cons**: Additional complexity vs. pure CLI approach
- **Decision**: Hybrid approach provides best user experience

## Next Steps

1. **Set up basic MCP server structure** with TypeScript and MCP SDK
2. **Implement core utterance queue functionality** with essential tools
3. **Create minimal browser client** with text input and server connection
4. **Test hook integration** with Claude Code to verify real-time interaction
5. **Iterate on user experience** before adding speech capabilities

## Success Metrics

- [ ] Claude Code can successfully interrupt operations via text input
- [ ] Utterances are queued and consumed reliably
- [ ] Utterances are classified as complete or not
