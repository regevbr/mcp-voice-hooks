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

### Text-Based POC ✅ **COMPLETED**

#### Core MCP Server

- [x] Research Claude Code hooks integration
- [x] Set up TypeScript MCP server project structure
- [x] Implement utterance queue with basic MCP tools for LLM:
  - [x] `get_recent_utterances(limit?: number)`
  - [x] immediately returns none if there are no recent utterances (doesn't block or wait for an utterance)
- [x] API for browser client to send potential utterances to MCP server
  - [x] HTTP API: `POST /api/potential-utterances`, `GET /api/utterances`
  - [x] MCP tool: `get_recent_utterances(limit?: number)`
- [x] Always categorize text input as a complete utterance for Phase 1
- [x] Add utterance to queue with timestamp
- [x] Unit test send_text_input, get_recent_utterances

#### Browser Client

- [x] Create simple HTML/JS client with text input
- [x] Implement HTTP communication with MCP server
- [x] Add real-time utterance submission
- [x] Show utterances from server in a reverse chronological list with the status (pending, delivered)
- [x] Auto-refresh utterance list every 2 seconds
- [x] Status dashboard showing total/pending/delivered counts

#### Preliminary Hook Integration

- [x] Test MCP server with Claude Code client
- [x] Verify `get_recent_utterances` tool works in Claude Code
- [x] Basic MCP integration working - utterances visible to Claude Code
- [x] Configure PostToolUse hooks to check for utterances automatically

### Wait for utterance ✅ **COMPLETED**

- [x] Add a `wait_for_utterance` tool to the MCP server: `wait_for_utterance(seconds_to_wait?: number)`
  - [x] wait_for_utterance should block until an utterance is able to be dequeued or the timeout is reached (default 10 seconds). It should return immediately if there has been no utterance since the last time it timed out (we'll need to keep track of the last time it timed out)
- [x] Configure the Stop hook to require `wait_for_utterance` to be called
- [x] Add `should_wait` endpoint to intelligently decide when to block Stop hook
  - [x] `/api/should-wait` returns `{ shouldWait: boolean }` based on utterances since last timeout
  - [x] Stop hook calls this endpoint to decide whether to block or approve
- [x] Stop hook now provides clear feedback messages when blocking or approving

### Front-End Utterance Segmentation ✅ **COMPLETED**

- [x] Implement Web Speech API continuous listening in browser client
  - [x] Add "Start Listening" button to enable continuous speech recognition
  - [x] Configure `recognition.continuous = true` for uninterrupted listening
  - [x] Enable `recognition.interimResults = true` for real-time feedback
- [x] Implement automatic utterance segmentation based on speech pauses
  - [x] Monitor `onresult` event for `isFinal` results
  - [x] Send completed utterances to server when user pauses
  - [x] Continue listening for next utterance without interruption
- [x] Update UI to show listening status and interim transcription
  - [x] Visual indicator for active listening (e.g., microphone icon)
  - [x] Display interim text as user speaks
  - [x] Clear interim text after sending final utterance
- [x] Handle edge cases
  - [x] Microphone permissions
  - [x] Recognition errors
  - [x] Browser compatibility checks
- [x] Tested utterance segmentation behavior successfully

### Utterance classification

- [ ] Add server-side LLM integration for utterance completion detection (POC should use claude cli or sdk <https://docs.anthropic.com/en/docs/claude-code/sdk> to categorize utterances as complete or not)
- [ ] unit test the utterance classification
- [ ] Design: Consider segmenting potential utterances into a complete utterance, which would be the first and the first word up to the last word in the complete utterance, and then our remaining words that are incomplete. Then the client would just pop the complete utterance out of the end. Continue appending things on to the end of the incomplete.

### Speech Recognition

- [x] Integrate Web Speech API in browser client
- [x] Add microphone input selection and monitoring
- [x] Implement continuous speech recognition (using Web Speech API's built-in pause detection with `isFinal` results instead of the originally planned approach)
- [x] Add a button to start/stop listening

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

### Communication Protocol: HTTP (POC) → WebSockets (Later)

- **HTTP for POC**:
  - **Pros**: Simple REST API, easier debugging, faster initial implementation
  - **Cons**: Polling overhead, higher latency, no real-time push notifications
  - **API**: `POST /api/potential-utterances`, `GET /api/utterances`, `GET /api/utterances/status`
- **WebSockets for Production**:
  - **Pros**: Real-time bidirectional communication, low latency, efficient for voice interaction
  - **Cons**: Connection management complexity, harder to debug
  - **Events**: `utterance`, `utterance_queued`, `utterance_delivered`
- **Decision**: Start with HTTP for rapid POC development, migrate to WebSockets when real-time features become critical

## **Architecture Achieved**

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser UI    │    │ Unified Server  │    │  Claude Code    │
│                 │    │                 │    │                 │
│ • Text Input    │◄──►│ • HTTP Server   │    │ • MCP Proxy     │
│ • Status View   │    │ • Shared Queue  │◄──►│ • Tool Calls    │
│ • Auto Refresh  │    │ • Dequeue API   │    │ • Interruption  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Key Innovation:** MCP proxy architecture enabling shared state between browser and Claude Code while maintaining development flexibility.
