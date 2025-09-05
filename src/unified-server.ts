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
  { capabilities: { tools: {} } }
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

// In TTS-only mode, we don't need complex hook validation
// The speak tool will handle its own validation

async function startUnifiedServer() {
  // Start HTTP server
  const httpPromise = new Promise<void>((resolve, reject) => {
    app.listen(HTTP_PORT, (err) => {
        if (err) {
            reject(err);
        }
      debugLog(`[HTTP] Server listening on http://localhost:${HTTP_PORT}`);
      resolve();
    });
  });

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

  await httpPromise;

  if (!IS_MCP_MANAGED) {
    console.error(`[HTTP] Server listening on http://localhost:${HTTP_PORT}`);
    console.log('TTS-only server started successfully!');
    console.log(`Open http://localhost:${HTTP_PORT} to configure text-to-speech settings`);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  debugLog(`[Error] Uncaught exception: ${error}`);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog(`[Error] Unhandled rejection at ${promise}: ${reason}`);
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startUnifiedServer().catch((error) => {
  debugLog(`[Error] Failed to start unified server: ${error}`);
  console.error('Failed to start server:', error);
  process.exit(1);
});
