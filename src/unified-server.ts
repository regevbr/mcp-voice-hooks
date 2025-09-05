#!/usr/bin/env node

import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { debugLog } from './debug.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const HTTP_PORT = process.env.MCP_VOICE_HOOKS_PORT ? parseInt(process.env.MCP_VOICE_HOOKS_PORT) : 5111;
const AUTO_OPEN_BROWSER = process.env.MCP_VOICE_HOOKS_AUTO_OPEN_BROWSER !== 'false'; // Default to true

// Promisified exec for async/await
const execAsync = promisify(exec);

// Determine if we're running in MCP-managed mode
const IS_MCP_MANAGED = process.argv.includes('--mcp-managed');


// Server-sent events clients
const sseClients: Response[] = [];

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));


// System TTS endpoint
app.post('/api/speak-system', async (req: Request, res: Response) => {
  const { text, rate } = req.body;

  if (!text) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  try {
    // Use macOS say command with specified rate
    const rateParam = rate ? `-r ${rate}` : '';
    await execAsync(`say ${rateParam} "${text.replace(/"/g, '\\"')}"`);

    debugLog(`[System TTS] Spoke: "${text}" (rate: ${rate || 'default'})`);
    res.json({ success: true });
  } catch (error) {
    debugLog(`[System TTS] Error: ${error}`);
    res.status(500).json({ error: 'Failed to speak text' });
  }
});

// Server-Sent Events endpoint for TTS notifications
app.get('/api/tts-events', (req: Request, res: Response) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Add client to list
  sseClients.push(res);
  debugLog(`[SSE] Client connected. Total clients: ${sseClients.length}`);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) {
      sseClients.splice(index, 1);
      debugLog(`[SSE] Client disconnected. Total clients: ${sseClients.length}`);
    }
  });
});

// Serve the main HTML page
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Function to broadcast TTS events to all connected clients
function broadcastTTSEvent(eventData: any) {
  const message = `data: ${JSON.stringify(eventData)}\n\n`;

  // Remove disconnected clients while broadcasting
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(message);
    } catch (error) {
      debugLog(`[SSE] Removing disconnected client: ${error}`);
      sseClients.splice(i, 1);
    }
  }
}

// Create MCP server
const server = new Server(
  { name: 'mcp-voice-hooks', version: '1.0.0' },
  { capabilities: { tools: {}, prompts: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    {
      name: 'speak',
      description: 'Make Claude speak text aloud using text-to-speech. This tool allows Claude to provide audio responses.',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to speak aloud'
          }
        },
        required: ['text']
      }
    }
  ];

  debugLog(`[MCP] Listed ${tools.length} tools`);
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'speak') {
    debugLog(`[MCP] Calling speak with text: "${args?.text || 'undefined'}"`);

    try {
      const text = args?.text;

      if (!text || typeof text !== 'string') {
        return {
          content: [
            { type: 'text', text: '❌ Text parameter is required and must be a string' }
          ]
        };
      }


      // Send TTS event to browser clients
      broadcastTTSEvent({
        type: 'speak',
        text: text,
        timestamp: new Date().toISOString()
      });

      debugLog(`[TTS] Sent speak event: "${text}"`);

      return {
        content: [
          { type: 'text', text: `🔊 Speaking: "${text}"` }
        ]
      };

    } catch (error) {
      debugLog(`[MCP] Error in speak tool: ${error}`);
      return {
        content: [
          { type: 'text', text: `❌ Error speaking text: ${error}` }
        ]
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts = [
    {
      name: 'speak',
      description: 'Instructions for Claude to use voice updates when communicating with users',
      arguments: []
    }
  ];

  debugLog(`[MCP] Listed ${prompts.length} prompts`);
  return { prompts };
});

// Handle prompt requests
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  if (name === 'speak') {
    debugLog('[MCP] Serving speak prompt');

    return {
      description: 'Instructions for Claude to use voice updates when communicating with users',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are an AI assistant with text-to-speech capabilities. Please use the 'speak' tool to provide voice updates to users in the following situations:

1. **Before running tools**: Briefly announce what you're about to do (e.g., "I'm going to run the build command now")

2. **After completing tasks**: Confirm completion and summarize key results (e.g., "The build completed successfully" or "I found 3 errors that need fixing")

3. **When asking questions**: When you need clarification or input from the user, speak your question to get their attention

4. **For important information**: When sharing critical findings, warnings, or results that the user should be aware of immediately

5. **When encountering errors**: Alert users to problems that require their attention

6. **When completed processing(*: Alert users that you finished all your tasks

Keep your spoken messages:
- Concise and clear (1-2 sentences maximum)
- Informative but not overwhelming
- Natural and conversational
- Focused on what matters most to the user

Do NOT use the speak tool for:
- Every single message (avoid being overly chatty)
- Detailed technical explanations (use text for those)
- Repetitive updates during long-running processes

Use your judgment to balance being helpful with being appropriately selective about when to speak but make sure the users always know that you are either done or waiting for his input

Pleaes continue the conversation from the previous message. 
`
          }
        }
      ]
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

// In TTS-only mode, we don't need complex hook validation
// The speak tool will handle its own validation

let httpServer: any = null;

async function startUnifiedServer() {
  // Start HTTP server
  const httpPromise = new Promise<void>((resolve, reject) => {
    httpServer = app.listen(HTTP_PORT, (err) => {
        if (err) {
            reject(err);
        }
      debugLog(`[HTTP] Server listening on http://localhost:${HTTP_PORT}`);
      resolve();
    });
  });

  await httpPromise;

    // Auto-open browser if enabled and in MCP mode
    if (IS_MCP_MANAGED && AUTO_OPEN_BROWSER) {
        try {
            await execAsync(`open http://localhost:${HTTP_PORT}`);
            debugLog('[Browser] Auto-opened browser');
        } catch (error) {
            debugLog(`[Browser] Failed to auto-open browser: ${error}`);
        }
    }

    if (IS_MCP_MANAGED) {
        // Start MCP server with stdio transport
        const transport = new StdioServerTransport();
        debugLog('[MCP] Starting stdio transport');
        await server.connect(transport);
        debugLog('[MCP] Connected to stdio transport');
    }

    if (!IS_MCP_MANAGED) {
    console.error(`[HTTP] Server listening on http://localhost:${HTTP_PORT}`);
    console.log('TTS-only server started successfully!');
    console.log(`Open http://localhost:${HTTP_PORT} to configure text-to-speech settings`);
  }
}

// Cleanup function
function cleanup() {
  debugLog('[Cleanup] Starting server cleanup...');

  // Close HTTP server
  if (httpServer) {
    debugLog('[Cleanup] Closing HTTP server...');
    httpServer.close((err: any) => {
      if (err) {
        debugLog(`[Cleanup] Error closing HTTP server: ${err}`);
      } else {
        debugLog('[Cleanup] HTTP server closed');
      }
    });
  }

  // Clear SSE clients
  debugLog(`[Cleanup] Closing ${sseClients.length} SSE connections...`);
  sseClients.forEach((client, index) => {
    try {
      client.end();
      debugLog(`[Cleanup] Closed SSE client ${index + 1}`);
    } catch (error) {
      debugLog(`[Cleanup] Error closing SSE client ${index + 1}: ${error}`);
    }
  });
  sseClients.length = 0;

  debugLog('[Cleanup] Server cleanup complete');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  debugLog('[Signal] Received SIGINT, shutting down gracefully...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  debugLog('[Signal] Received SIGTERM, shutting down gracefully...');
  cleanup();
  process.exit(0);
});

process.on('exit', (code) => {
  debugLog(`[Process] Exiting with code ${code}`);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  debugLog(`[Error] Uncaught exception: ${error}`);
  console.error('Uncaught exception:', error);
  cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog(`[Error] Unhandled rejection at ${promise}: ${reason}`);
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  cleanup();
  process.exit(1);
});

// Start the server
startUnifiedServer().catch((error) => {
  debugLog(`[Error] Failed to start unified server: ${error}`);
  console.error('Failed to start server:', error);
  process.exit(1);
});
