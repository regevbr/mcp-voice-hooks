# MCP Voice Hooks - Roadmap

## Vision

Create an MCP server that enables real-time voice interaction with Claude Code and other MCP clients. The system will:

1. **Continuously listen** for voice input (or typed input during POC)
2. **Detect complete utterances** using LLM-based analysis
3. **Queue utterances** for consumption by MCP clients
4. **Use hooks** to force clients to check for new utterances before and after tool execution
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

### Next tasks

- [ ] bug: microsoft edge speech recognition is not working
- [ ] clean up completed tasks in roadmap.md
- [x] experiment with having the server remind the assistant to use voice responses instead of having a post tool hook
- [ ] Set up automated publishing workflow (GitHub Actions)
- [ ] Clean up speak endpoint response to reduce window clutter
  - [ ] Remove or simplify the "Spoke: [text]" output
  - [ ] Remove or simplify the "Marked X utterance(s) as responded" message
  - [ ] Make the response more concise while maintaining necessary functionality
- [x] ensure hooks and settings are updated on every server startup
- [x] bump version to 1.0.7
- [x] bump version to 1.0.8
- [x] refactor: replace post-tool hook with inline voice response reminders
- [x] refactor: implement unified hook handler for cleaner control flow
  - [x] Consolidate all hook logic into single handleHookRequest function
  - [x] Each hook endpoint now calls unified handler with action type
- [x] fix: reset lastTimeoutTimestamp when clearing utterance queue
  - [x] Prevents stop hook from incorrectly allowing stops after queue clear
  - [x] Added comprehensive tests for queue clearing behavior
- [x] Improve speaking flow ✅ **COMPLETED**
  - [x] Add new speak_and_then_wait_for_utterance tool
  - [x] Make both speak and speak_and_then_wait_for_utterance fail if there are pending utterances
    - [x] Create a separate pre-speak hook that runs before speak and speak_and_then_wait_for_utterance tools. It should only block for pending utterances, otherwise approve.
    - [x] Hook matches only speak and speak_and_then_wait_for_utterance tools
    - [x] Only validates that no pending utterances exist (first step of validation)
    - [x] Forces dequeue_utterances to be called before any speaking/waiting.
    - [x] This ensures clean conversation flow: dequeue → speak → wait
    - [x] if voice responses are enabled, require speak_and_then_wait_for_utterance in the stop hook, otherwise require wait_for_utterance
- [ ] add a CLI argument --speak to the server to enable voice responses
  - [ ] remove the MCP_VOICE_RESPONSES_ENABLED environment variable and switch all references to it to --speak
- [ ] Investigate hiding the speak mcp tools when voice responses are disabled
- [ ] Investigate consolidating the pre-tool hook, pre-speak hook, and pre-wait hook into a single hook that runs before all tools and checks which tool is being used and switches logic based on that
- [x] Improve conversation flow by tracking tool usage ✅ **COMPLETED**
  - [x] Remove speak_and_then_wait_for_utterance tool (use separate speak and wait_for_utterance instead)
  - [x] Track timestamp of last approved tool use
  - [x] Enforce speaking after tool use before wait_for_utterance or stop:
    - [x] Check for pending utterances (must dequeue first)
    - [x] Check for unresponded utterances when voice enabled (must speak first)
    - [x] Check if spoken since last tool use (must speak first)
    - [x] Check if timeout occurred (if no, must wait_for_utterance; if yes, can stop)
  - [x] Create pre-wait hook that enforces speaking after tool use
    - [x] Hook matches only wait_for_utterance tool
    - [x] Validates no pending utterances
    - [x] Validates no unresponded utterances (when voice enabled)
    - [x] Validates that speak was called after last tool use
  - [x] Update stop hook logic to check if spoken since last tool use
  - [x] Add comprehensive tests for conversation flow tracking
- [ ] Optimization:
  - [ ] auto dequeue when that is the only valid action
  - [ ] auto wait for utterance when that is the only valid action

### Voice Response Tracking & Conversation Flow Enforcement

#### Step 1: Create speak/say endpoint (can be tested independently) ✅ **COMPLETED**

- [x] Create new speak/say endpoint for text-to-speech
  - [x] `/api/speak` endpoint
  - [x] Takes `text` parameter to speak
  - [x] Executes text-to-speech using macOS `say` command
  - [x] Marks all "delivered" utterances as "responded"
  - [x] Returns success/error status
- [x] Add MCP tool 'speak' that calls the endpoint
- [x] Test endpoint independently - works correctly!

#### Step 2: Implement conversation flow enforcement ✅ **COMPLETED**

- [x] Add third utterance state: "responded" (in addition to "pending" and "delivered")
- [x] Create unified action validation endpoint: `/api/validate-action`
  - [x] Combines and extends functionality from `/api/should-wait` and `/api/has-pending-utterances`
  - [x] Takes an `action` parameter (e.g., "tool-use", "stop")
  - [x] Returns either:
    - `{ allowed: true }` - Action can proceed
    - `{ allowed: false, requiredAction: "dequeue_utterances" }` - Has pending utterances
    - `{ allowed: false, requiredAction: "speak" }` - Has delivered but unresponded utterances (when VOICE_RESPONSES_ENABLED=true)
    - `{ allowed: false, requiredAction: "wait_for_utterance" }` - For stop action only, when all responded but no timeout yet
  - [x] Logic by action type:
    - **tool-use**:
      - Block if pending utterances exist → require dequeue_utterances
      - Block if delivered but unresponded utterances exist (when voice enabled) → require speak
      - Allow if all utterances are responded
    - **stop**:
      - Block if pending utterances exist → require dequeue_utterances
      - Block if delivered but unresponded utterances exist (when voice enabled) → require speak
      - Block if all responded but no timeout since last utterance → require wait_for_utterance
      - Allow only after timeout with no new utterances
- [x] Update hooks to use unified endpoint:
  - [x] Pre-tool hook calls with action="tool-use"
  - [x] Stop hook calls with action="stop"
  - [x] Both hooks check response and provide appropriate feedback
- [x] This ensures proper conversational flow:
  1. User speaks (utterance created as "pending")
  2. Assistant receives utterances (marked as "delivered")
  3. Assistant must speak response via speak endpoint (marks utterances as "responded")
  4. Only then can assistant proceed with tool use or stopping
- [x] Created comprehensive unit tests for validate-action endpoint
- [x] Created unit tests for utterance state transitions
- [x] All tests passing (58 total)
- [ ] create dedicated endpoints for each hook
  - [ ] pre-tool hook
  - [ ] stop hook
- [ ] have the server respond in the exact format that can be passed directly to claude. e.g. echo "{\"decision\": \"block\", \"reason\": \"$reason\"}"

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

### Pre-Tool Use Hooks ✅ **COMPLETED**

- [x] Create API endpoint to check for pending utterances
  - [x] `/api/has-pending-utterances` returns `{ hasPending: boolean, pendingCount: number }`
- [x] Implement pre-tool use hook script
  - [x] Checks for pending utterances before allowing tool execution
  - [x] Blocks tool execution if utterances are pending
  - [x] Forces Claude to use `dequeue_utterances` tool first
- [x] Hook provides clear feedback about pending utterance count

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
- [x] Made HTTP server port configurable via MCP_VOICE_HOOKS_PORT environment variable (default: 5111)
- [x] Updated hook scripts to use configurable port
- [x] Auto-install/update hooks on MCP server startup
- [x] Remove confirmation dialog from clear all button
- [x] Clarify development docs: TypeScript needs building, browser files don't

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

### Tool Description Improvements

- [ ] Improve MCP tool descriptions for better standalone usage (without hooks)
  - [ ] Add clear, detailed descriptions for `dequeue_utterances`
  - [ ] Add comprehensive description for `wait_for_utterance`
  - [ ] Include usage examples in tool descriptions
  - [ ] Explain the voice interaction workflow in descriptions
- [ ] Test server usability without hooks installed
- [ ] Document standalone usage patterns

### Audio Feedback ✅ **COMPLETED**

- [x] Add sound notification when `wait_for_utterance` starts listening
  - [x] Implement simple sound playbook (ding/beep)
  - [x] Use system sounds or generate simple tone
  - [x] Make sound optional via configuration
  - [x] Play sound before starting to wait for utterances

### UI Enhancements

- [x] Add a "Clear All" button to the UI

### NPX Integration

- [x] Create CLI entry point (`bin/cli.js`) for npx support
- [x] Implement `npx mcp-voice-hooks` main command
  - [x] Default behavior: Start the MCP server
  - [x] Handle server startup and configuration
- [x] Implement `npx mcp-voice-hooks install-hooks` subcommand
  - [x] Auto-install/update hook files to user directory (`~/.mcp-voice-hooks/hooks/`)
  - [x] Automatically configure project-specific Claude Code settings (`./.claude/settings.json`)
  - [x] Handle first-time setup and updates seamlessly
- [x] Create comprehensive documentation for npx installation
- [ ] Test npx integration across different environments
- [x] use a custom localhost url instead of localhost:3000

### NPM Publishing

- [x] Version 1.0.2 - Port configuration feature

- [x] Prepare package for npm publication
  - [x] Update package.json with proper metadata (description, keywords, repository, author)
  - [x] Add `"bin"` field to package.json pointing to CLI entry point
  - [x] Ensure all necessary files are included in the published package
  - [x] Add `.npmignore` if needed to exclude development files
- [x] Create npm account and configure authentication
- [x] Test package locally with `npm pack` and run it with `npx file...`
  - [ ] set up pre commit hooks to make sure this can run locally
- [x] Publish to npm registry with `npm publish`
- [x] Test npx execution from npm: `npx mcp-voice-hooks`
- [x] test claude mcp add voice-hooks npx mcp-voice-hooks
- [x] document system voice settings
- [ ] Set up automated publishing workflow (GitHub Actions)

### Development Quality ✅ **COMPLETED**

- [x] Add pre-commit hooks to run tests automatically
  - [x] Install and configure husky pre-commit framework
  - [x] Set up hooks to run unit tests before commits
  - [x] Configure hooks to run knip and ts-prune for unused code detection
  - [x] Add hooks for TypeScript type checking
  - [x] Ensure tests pass before allowing commits
  - [x] Require roadmap.md updates in every commit

**Automatic Hook Configuration** (added to `~/.claude/settings.json`):

   ```json
   {
     "hooks": {
       "Stop": [{"matcher": "", "hooks": [{"type": "command", "command": "sh ~/.mcp-voice-hooks/hooks/stop-hook.sh"}]}],
       "PreToolUse": [{"matcher": "^(?!mcp__voice-hooks__).*", "hooks": [{"type": "command", "command": "sh ~/.mcp-voice-hooks/hooks/pre-tool-hook.sh"}]}]
     }
   }
   ```

- [x] make sure we don't clobber the user's claude settings
  - [x] Implement intelligent hook merging that preserves existing hooks
  - [x] Only updates voice-hooks related hooks
  - [x] Avoids unnecessary writes when hooks are only reordered
- [x] add a readme to `~/.mcp-voice-hooks` with instructions for how to uninstall (`rm -rf ~/.mcp-voice-hooks`, and remove the hooks from the claude settings)
- [x] clean up anything in `~/.mcp-voice-hooks` before installing
- [x] add a script to uninstall
  - [x] `rm -rf ~/.mcp-voice-hooks`
  - [x] and remove the hooks from the claude settings

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
│ • Voice Input   │    │ • Shared Queue  │◄──►│ • Tool Calls    │
│ • Status View   │    │ • Hook APIs     │    │ • Pre-Tool Hook │
│ • Auto Refresh  │    │ • Dequeue API   │    │ • Stop Hook     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Key Innovations:**

- MCP proxy architecture enabling shared state between browser and Claude Code
- Web Speech API integration for automatic utterance segmentation
- Hook system that ensures voice input is processed before actions
