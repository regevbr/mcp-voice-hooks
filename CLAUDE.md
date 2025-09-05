# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP TTS Hooks is a text-to-speech system for Claude Code that enables Claude to speak responses aloud. It implements the Model Context Protocol (MCP) server pattern for text-to-speech processing.

## Development Commands

### Build and Development
```bash
# Build the project (compiles TypeScript to dist/)
npm run build

# Development with auto-reload
npm run dev                    # HTTP server only
npm run dev-unified           # Full unified server (HTTP + MCP)
npm run dev-debug             # Debug mode with logging
npm run dev-unified-debug     # Unified server with debug logging

# Production
npm start                     # Run compiled server
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch
```

### MCP Server Commands
```bash
# Run MCP server in managed mode (production)
npm run mcp-unified

# Run MCP server with debug logging
npm run mcp-unified-debug
```

## Architecture

### Core Components

**Dual Server Architecture:**
- **HTTP Server** (`src/http-server.ts`): Serves browser frontend for TTS configuration
- **MCP Server** (`src/unified-server.ts`): Implements Model Context Protocol for Claude Code integration

**Key Modules:**
- `src/unified-server.ts`: Main MCP server with integrated HTTP server for browser frontend
- `src/index.ts`: HTTP-only server entry point
- `src/http-server.ts`: Standalone HTTP server class
- `bin/cli.js`: CLI entry point for `npx mcp-voice-hooks` command

### TTS Processing Flow

1. **Claude Speaks**: Claude uses the `speak` tool to request text-to-speech
2. **TTS Output**: Text-to-speech via browser API or macOS `say` command
3. **Browser Integration**: Server-sent events notify browser clients of speech requests


### Configuration

Environment variables control behavior:
- `MCP_VOICE_HOOKS_PORT`: Server port (default: 5111)
- `MCP_VOICE_HOOKS_AUTO_OPEN_BROWSER`: Auto-open browser in MCP mode (default: true)

## Important Development Notes

### TypeScript + ESM Configuration
- Uses ES modules with `.js` extensions in imports for Node.js compatibility
- Build process uses `tsup` to transform TypeScript to ESM in `dist/` directory
- Builds both `index.js` and `unified-server.js` entry points with source maps
- When developing with `npm link`: Changes to TypeScript require `npm run build` + Claude restart

### Testing Strategy
- Jest with TypeScript support and ESM configuration
- Tests in `src/__tests__/` cover core functionality:
  - TTS endpoint functionality
  - Browser integration
  - MCP speak tool responses

### MCP Integration
- Server runs in stdio mode when called via `claude mcp add`
- HTTP server runs concurrently for browser frontend
- Uses `--mcp-managed` flag to distinguish runtime contexts

### Browser Frontend
- Served from `public/` directory
- Real-time communication via Server-Sent Events
- Text-to-Speech API integration
- Voice selection and rate control interface

## Usage

Add the MCP server to Claude Code using:
```bash
claude mcp add tts-hooks npx mcp-voice-hooks@latest
```

The server provides a `speak` tool that Claude can use to output text-to-speech.

## Key Files

- `bin/cli.js`: Entry point for `npx mcp-voice-hooks` command
- `src/unified-server.ts`: Main MCP + HTTP server implementation  
- `src/index.ts`: HTTP-only server entry point
- `src/http-server.ts`: Standalone HTTP server class
- `public/index.html` + `public/app.js`: Browser-based TTS interface

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Read the docs

Read the docs before responding to the user:

- roadmap.md
- README.md
- <https://modelcontextprotocol.io/tutorials/building-mcp-with-llms>
- <https://docs.anthropic.com/en/docs/claude-code/hooks>
