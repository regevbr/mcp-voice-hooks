#!/usr/bin/env node

import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { debugLog } from './debug.ts';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const DEFAULT_WAIT_TIMEOUT_SECONDS = 30;
const MIN_WAIT_TIMEOUT_SECONDS = 30;
const MAX_WAIT_TIMEOUT_SECONDS = 60;

// Shared utterance queue
interface Utterance {
  id: string;
  text: string;
  timestamp: Date;
  status: 'pending' | 'delivered';
}

class UtteranceQueue {
  utterances: Utterance[] = [];

  add(text: string, timestamp?: Date): Utterance {
    const utterance: Utterance = {
      id: randomUUID(),
      text: text.trim(),
      timestamp: timestamp || new Date(),
      status: 'pending'
    };

    this.utterances.push(utterance);
    debugLog(`[Queue] queued: "${utterance.text}"	[id: ${utterance.id}]`);
    return utterance;
  }

  getRecent(limit: number = 10): Utterance[] {
    return this.utterances
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  markDelivered(id: string): void {
    const utterance = this.utterances.find(u => u.id === id);
    if (utterance) {
      utterance.status = 'delivered';
      debugLog(`[Queue] delivered: "${utterance.text}"	[id: ${id}]`);
    }
  }

  clear(): void {
    const count = this.utterances.length;
    this.utterances = [];
    debugLog(`[Queue] Cleared ${count} utterances`);
  }
}

// Determine if we're running in MCP-managed mode
const IS_MCP_MANAGED = process.argv.includes('--mcp-managed');

// Global state
const queue = new UtteranceQueue();
let lastTimeoutTimestamp: Date | null = null;

// HTTP Server Setup (always created)
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.post('/api/potential-utterances', (req: Request, res: Response) => {
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

app.get('/api/utterances', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
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

app.get('/api/utterances/status', (req: Request, res: Response) => {
  const total = queue.utterances.length;
  const pending = queue.utterances.filter(u => u.status === 'pending').length;
  const delivered = queue.utterances.filter(u => u.status === 'delivered').length;

  res.json({
    total,
    pending,
    delivered,
  });
});

// MCP server integration
app.post('/api/dequeue-utterances', (req: Request, res: Response) => {
  const { limit = 10 } = req.body;
  const pendingUtterances = queue.utterances
    .filter(u => u.status === 'pending')
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);

  // Mark as delivered
  pendingUtterances.forEach(u => {
    queue.markDelivered(u.id);
  });

  res.json({
    success: true,
    utterances: pendingUtterances.map(u => ({
      text: u.text,
      timestamp: u.timestamp,
    })),
  });
});

// Wait for utterance endpoint
app.post('/api/wait-for-utterances', async (req: Request, res: Response) => {
  const { seconds_to_wait = DEFAULT_WAIT_TIMEOUT_SECONDS } = req.body;
  const secondsToWait = Math.max(
    MIN_WAIT_TIMEOUT_SECONDS,
    Math.min(MAX_WAIT_TIMEOUT_SECONDS, seconds_to_wait)
  );
  const maxWaitMs = secondsToWait * 1000;
  const startTime = Date.now();
  
  debugLog(`[Server] Starting wait_for_utterance (${secondsToWait}s)`);
  
  // Check if we should return immediately
  if (lastTimeoutTimestamp) {
    const hasNewUtterances = queue.utterances.some(
      u => u.timestamp > lastTimeoutTimestamp!
    );
    if (!hasNewUtterances) {
      debugLog('[Server] No new utterances since last timeout, returning immediately');
      res.json({
        success: true,
        utterances: [],
        message: `No utterances found after waiting ${secondsToWait} seconds.`,
        waitTime: 0,
      });
      return;
    }
  }
  
  // Poll for utterances
  while (Date.now() - startTime < maxWaitMs) {
    const pendingUtterances = queue.utterances.filter(
      u => u.status === 'pending' &&
      (!lastTimeoutTimestamp || u.timestamp > lastTimeoutTimestamp)
    );
    
    if (pendingUtterances.length > 0) {
      // Found utterances - clear lastTimeoutTimestamp
      lastTimeoutTimestamp = null;
      
      // Sort by timestamp (oldest first)
      const sortedUtterances = pendingUtterances
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Mark utterances as delivered
      sortedUtterances.forEach(u => {
        queue.markDelivered(u.id);
      });
      
      res.json({
        success: true,
        utterances: sortedUtterances.map(u => ({
          id: u.id,
          text: u.text,
          timestamp: u.timestamp,
          status: 'delivered', // They are now delivered
        })),
        count: pendingUtterances.length,
        waitTime: Date.now() - startTime,
      });
      return;
    }
    
    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Timeout reached - no utterances found
  lastTimeoutTimestamp = new Date();
  
  res.json({
    success: true,
    utterances: [],
    message: `No utterances found after waiting ${secondsToWait} seconds.`,
    waitTime: maxWaitMs,
  });
});

// API for the stop hook to check if it should wait
app.get('/api/should-wait', (req: Request, res: Response) => {
  const shouldWait = !lastTimeoutTimestamp || 
    queue.utterances.some(u => u.timestamp > lastTimeoutTimestamp!);
  
  res.json({ shouldWait });
});

// API for pre-tool hook to check for pending utterances
app.get('/api/has-pending-utterances', (req: Request, res: Response) => {
  const pendingCount = queue.utterances.filter(u => u.status === 'pending').length;
  const hasPending = pendingCount > 0;
  
  res.json({ 
    hasPending,
    pendingCount
  });
});

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start HTTP server
const HTTP_PORT = 3000;
app.listen(HTTP_PORT, () => {
  console.log(`[HTTP] Server listening on http://localhost:${HTTP_PORT}`);
  console.log(`[Mode] Running in ${IS_MCP_MANAGED ? 'MCP-managed' : 'standalone'} mode`);
});

// MCP Server Setup (only if MCP-managed)
if (IS_MCP_MANAGED) {
  console.log('[MCP] Initializing MCP server...');
  
  const mcpServer = new Server(
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

  // Tool handlers
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'dequeue_utterances',
          description: 'Dequeue pending utterances and mark them as delivered',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of utterances to dequeue (default: 10)',
                default: 10,
              },
            },
          },
        },
        {
          name: 'wait_for_utterance',
          description: 'Wait for an utterance to be available or until timeout. Returns immediately if no utterances since last timeout.',
          inputSchema: {
            type: 'object',
            properties: {
              seconds_to_wait: {
                type: 'number',
                description: `Maximum seconds to wait for an utterance (default: ${DEFAULT_WAIT_TIMEOUT_SECONDS}, min: ${MIN_WAIT_TIMEOUT_SECONDS}, max: ${MAX_WAIT_TIMEOUT_SECONDS})`,
                default: DEFAULT_WAIT_TIMEOUT_SECONDS,
                minimum: MIN_WAIT_TIMEOUT_SECONDS,
                maximum: MAX_WAIT_TIMEOUT_SECONDS,
              },
            },
          },
        },
      ],
    };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      if (name === 'dequeue_utterances') {
        const limit = (args?.limit as number) ?? 10;
        const response = await fetch('http://localhost:3000/api/dequeue-utterances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit }),
        });
        
        const data = await response.json() as any;
        
        if (data.utterances.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No recent utterances found.',
              },
            ],
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Dequeued ${data.utterances.length} utterance(s):\n\n${
                data.utterances.reverse().map((u: any) => `"${u.text}"\t[time: ${new Date(u.timestamp).toISOString()}]`).join('\n')
              }`,
            },
          ],
        };
      }
      
      if (name === 'wait_for_utterance') {
        const requestedSeconds = (args?.seconds_to_wait as number) ?? DEFAULT_WAIT_TIMEOUT_SECONDS;
        const secondsToWait = Math.max(
          MIN_WAIT_TIMEOUT_SECONDS,
          Math.min(MAX_WAIT_TIMEOUT_SECONDS, requestedSeconds)
        );
        debugLog(`[MCP] Calling wait_for_utterance with ${secondsToWait}s timeout`);
        
        const response = await fetch('http://localhost:3000/api/wait-for-utterances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seconds_to_wait: secondsToWait }),
        });
        
        const data = await response.json() as any;
        
        if (data.utterances && data.utterances.length > 0) {
          const utteranceTexts = data.utterances
            .map((u: any) => `[${u.timestamp}] "${u.text}"`)
            .join('\n');
          
          return {
            content: [
              {
                type: 'text',
                text: `Found ${data.count} utterance(s):\n\n${utteranceTexts}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: data.message || `No utterances found after waiting ${secondsToWait} seconds.`,
              },
            ],
          };
        }
      }
      
      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  mcpServer.connect(transport);
  console.log('[MCP] Server connected via stdio');
} else {
  console.log('[MCP] Skipping MCP server initialization (not in MCP-managed mode)');
}