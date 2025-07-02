#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared utterance queue
class UtteranceQueue {
  constructor() {
    this.utterances = [];
  }
  
  add(text, timestamp) {
    const utterance = {
      id: randomUUID(),
      text: text.trim(),
      timestamp: timestamp || new Date(),
      status: 'pending'
    };
    
    this.utterances.push(utterance);
    console.log(`[Queue] Added utterance: "${utterance.text}" (${utterance.id})`);
    return utterance;
  }
  
  getRecent(limit = 10) {
    return this.utterances
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  markDelivered(id) {
    const utterance = this.utterances.find(u => u.id === id);
    if (utterance) {
      utterance.status = 'delivered';
      console.log(`[Queue] Marked utterance as delivered: ${id}`);
    }
  }
  
  clear() {
    const count = this.utterances.length;
    this.utterances = [];
    console.log(`[Queue] Cleared ${count} utterances`);
  }
}

// Global shared queue
const queue = new UtteranceQueue();

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.includes('--mcp-connect') ? 'connect' : 
             args.includes('--mcp-managed') ? 'managed' : 'development';

console.log(`Starting Voice Hooks server in ${mode} mode...`);

// HTTP Server Setup
function setupHttpServer() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // API Routes
  app.post('/api/potential-utterances', (req, res) => {
    const { text, timestamp } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const parsedTimestamp = timestamp ? new Date(timestamp) : undefined;
    const utterance = queue.add(text, parsedTimestamp);
    
    res.json({
      success: true,
      utterance: {
        id: utterance.id,
        text: utterance.text,
        timestamp: utterance.timestamp,
        status: utterance.status,
      },
    });
  });

  app.get('/api/utterances', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const utterances = queue.getRecent(limit);
    
    res.json({
      utterances: utterances.map(u => ({
        id: u.id,
        text: u.text,
        timestamp: u.timestamp,
        status: u.status,
      })),
    });
  });

  app.get('/api/utterances/status', (req, res) => {
    const total = queue.utterances.length;
    const pending = queue.utterances.filter(u => u.status === 'pending').length;
    const delivered = queue.utterances.filter(u => u.status === 'delivered').length;

    res.json({
      total,
      pending,
      delivered,
    });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`HTTP Server running on http://localhost:${PORT}`);
  });
}

// MCP Server Setup
function setupMcpServer() {
  const server = new Server(
    {
      name: 'voice-hooks',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_recent_utterances',
          description: 'Get recent utterances from the shared queue',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of utterances to return (default: 10)',
                default: 10,
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_recent_utterances': {
        const limit = args?.limit || 10;
        const utterances = queue.getRecent(limit);
        
        // Mark retrieved utterances as delivered
        utterances.forEach(u => {
          if (u.status === 'pending') {
            queue.markDelivered(u.id);
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: utterances.length > 0 
                ? `Found ${utterances.length} recent utterances:\n\n${utterances.map(u => 
                    `[${u.timestamp.toISOString()}] "${u.text}"`
                  ).join('\n')}`
                : 'No recent utterances found.',
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

// Main execution
async function main() {
  try {
    if (mode === 'connect') {
      // MCP connect mode - only start MCP server
      console.log('Starting MCP server only (connect mode)...');
      const mcpServer = setupMcpServer();
      const transport = new StdioServerTransport();
      await mcpServer.connect(transport);
      console.error('Voice Hooks MCP Server connected');
      
    } else {
      // Development or managed mode - start both servers
      console.log('Starting unified server (HTTP + MCP)...');
      
      // Start HTTP server
      setupHttpServer();
      
      // Start MCP server
      const mcpServer = setupMcpServer();
      const transport = new StdioServerTransport();
      await mcpServer.connect(transport);
      console.error('Voice Hooks Unified Server running');
      console.error('- HTTP server: http://localhost:3000');
      console.error('- MCP server: Ready for stdio connection');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();