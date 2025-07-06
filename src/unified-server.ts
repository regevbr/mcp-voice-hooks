#!/usr/bin/env node

import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
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

// Promisified exec for async/await
const execAsync = promisify(exec);

// Function to play a sound notification
async function playNotificationSound() {
  try {
    // Use macOS system sound
    await execAsync('afplay /System/Library/Sounds/Funk.aiff');
    debugLog('[Sound] Played notification sound');
  } catch (error) {
    debugLog(`[Sound] Failed to play sound: ${error}`);
    // Don't throw - sound is not critical
  }
}

// Shared utterance queue
interface Utterance {
  id: string;
  text: string;
  timestamp: Date;
  status: 'pending' | 'delivered' | 'responded';
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
let lastToolUseTimestamp: Date | null = null;
let lastSpeakTimestamp: Date | null = null;

// HTTP Server Setup (always created)
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.post('/api/potential-utterances', (req: Request, res: Response) => {
  const { text, timestamp } = req.body;

  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Text is required' });
    return;
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

  let firstTime = true;

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

    if (firstTime) {
      firstTime = false;
      // Play notification sound since we're about to start waiting
      await playNotificationSound();
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

// Unified action validation endpoint
app.post('/api/validate-action', (req: Request, res: Response) => {
  const { action } = req.body;
  const voiceResponsesEnabled = process.env.VOICE_RESPONSES_ENABLED === 'true';

  if (!action || !['tool-use', 'stop'].includes(action)) {
    res.status(400).json({ error: 'Invalid action. Must be "tool-use" or "stop"' });
    return;
  }

  // Check for pending utterances (both actions)
  const pendingUtterances = queue.utterances.filter(u => u.status === 'pending');
  if (pendingUtterances.length > 0) {
    res.json({
      allowed: false,
      requiredAction: 'dequeue_utterances',
      reason: `${pendingUtterances.length} pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.`
    });
    return;
  }

  // Check for delivered but unresponded utterances (when voice enabled)
  if (voiceResponsesEnabled) {
    const deliveredUtterances = queue.utterances.filter(u => u.status === 'delivered');
    if (deliveredUtterances.length > 0) {
      res.json({
        allowed: false,
        requiredAction: 'speak',
        reason: `${deliveredUtterances.length} delivered utterance(s) require voice response. Please use the speak tool to respond before proceeding.`
      });
      return;
    }
  }

  // For stop action, check if we should wait
  if (action === 'stop') {
    const shouldWait = !lastTimeoutTimestamp ||
      queue.utterances.some(u => u.timestamp > lastTimeoutTimestamp!);

    if (shouldWait) {
      res.json({
        allowed: false,
        requiredAction: 'wait_for_utterance',
        reason: 'Assistant tried to end its response. Stopping is not allowed without first checking for voice input. Assistant should now use wait_for_utterance to check for voice input'
      });
      return;
    }
  }

  // All checks passed - action is allowed
  res.json({
    allowed: true
  });
});

// Unified hook handler
function handleHookRequest(attemptedAction: 'tool' | 'speak' | 'wait' | 'stop'): { decision: 'approve' | 'block', reason?: string } {
  const voiceResponsesEnabled = process.env.VOICE_RESPONSES_ENABLED === 'true';
  
  // 1. Check for pending utterances
  const pendingUtterances = queue.utterances.filter(u => u.status === 'pending');
  if (pendingUtterances.length > 0) {
    // Allow dequeue to proceed (dequeue doesn't go through hooks)
    return {
      decision: 'block',
      reason: `${pendingUtterances.length} pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.`
    };
  }
  
  // 2. Check for delivered utterances (when voice enabled)
  if (voiceResponsesEnabled) {
    const deliveredUtterances = queue.utterances.filter(u => u.status === 'delivered');
    if (deliveredUtterances.length > 0) {
      // Only allow speak to proceed
      if (attemptedAction === 'speak') {
        return { decision: 'approve' };
      }
      return {
        decision: 'block',
        reason: `${deliveredUtterances.length} delivered utterance(s) require voice response. Please use the speak tool to respond before proceeding.`
      };
    }
  }
  
  // 3. Handle tool action
  if (attemptedAction === 'tool') {
    lastToolUseTimestamp = new Date();
    return { decision: 'approve' };
  }
  
  // 4. Handle wait for utterance
  if (attemptedAction === 'wait') {
    if (voiceResponsesEnabled && lastToolUseTimestamp && 
        (!lastSpeakTimestamp || lastSpeakTimestamp < lastToolUseTimestamp)) {
      return {
        decision: 'block',
        reason: 'Assistant must speak after using tools. Please use the speak tool to respond before waiting for utterances.'
      };
    }
    return { decision: 'approve' };
  }
  
  // 5. Handle speak
  if (attemptedAction === 'speak') {
    return { decision: 'approve' };
  }
  
  // 6. Handle stop
  if (attemptedAction === 'stop') {
    // Check if must speak after tool use
    if (voiceResponsesEnabled && lastToolUseTimestamp && 
        (!lastSpeakTimestamp || lastSpeakTimestamp < lastToolUseTimestamp)) {
      return {
        decision: 'block',
        reason: 'Assistant must speak after using tools. Please use the speak tool to respond before proceeding.'
      };
    }
    
    // Check if should wait for utterances
    const shouldWait = !lastTimeoutTimestamp ||
      queue.utterances.some(u => u.timestamp > lastTimeoutTimestamp!);
    
    if (shouldWait) {
      return {
        decision: 'block',
        reason: 'Assistant tried to end its response. Stopping is not allowed without first checking for voice input. Assistant should now use wait_for_utterance to check for voice input'
      };
    }
    
    return {
      decision: 'approve',
      reason: 'No utterances since last timeout'
    };
  }
  
  // Default to approve (shouldn't reach here)
  return { decision: 'approve' };
}

// Dedicated hook endpoints that return in Claude's expected format
app.post('/api/hooks/pre-tool', (_req: Request, res: Response) => {
  const result = handleHookRequest('tool');
  res.json(result);
});

app.post('/api/hooks/stop', (_req: Request, res: Response) => {
  const result = handleHookRequest('stop');
  res.json(result);
});

// Pre-speak hook endpoint
app.post('/api/hooks/pre-speak', (_req: Request, res: Response) => {
  const result = handleHookRequest('speak');
  res.json(result);
});

// Pre-wait hook endpoint
app.post('/api/hooks/pre-wait', (_req: Request, res: Response) => {
  const result = handleHookRequest('wait');
  res.json(result);
});

// API to clear all utterances
app.delete('/api/utterances', (req: Request, res: Response) => {
  const clearedCount = queue.utterances.length;
  queue.clear();
  
  // Reset timeout timestamp when clearing queue to avoid stop hook issues
  lastTimeoutTimestamp = null;

  res.json({
    success: true,
    message: `Cleared ${clearedCount} utterances`,
    clearedCount
  });
});

// API for text-to-speech
app.post('/api/speak', async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  try {
    // Execute text-to-speech using macOS say command
    await execAsync(`say -r 350 "${text.replace(/"/g, '\\"')}"`);
    debugLog(`[Speak] Spoke text: "${text}"`);

    // Mark all delivered utterances as responded
    const deliveredUtterances = queue.utterances.filter(u => u.status === 'delivered');
    deliveredUtterances.forEach(u => {
      u.status = 'responded';
      debugLog(`[Queue] marked as responded: "${u.text}"	[id: ${u.id}]`);
    });

    // Track that speak was called
    lastSpeakTimestamp = new Date();

    res.json({
      success: true,
      message: 'Text spoken successfully',
      respondedCount: deliveredUtterances.length
    });
  } catch (error) {
    debugLog(`[Speak] Failed to speak text: ${error}`);
    res.status(500).json({
      error: 'Failed to speak text',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start HTTP server
const HTTP_PORT = process.env.MCP_VOICE_HOOKS_PORT ? parseInt(process.env.MCP_VOICE_HOOKS_PORT) : 5111;
app.listen(HTTP_PORT, () => {
  console.log(`[HTTP] Server listening on http://localhost:${HTTP_PORT}`);
  console.log(`[Mode] Running in ${IS_MCP_MANAGED ? 'MCP-managed' : 'standalone'} mode`);
});

// Helper function to get voice response reminder
function getVoiceResponseReminder(): string {
  const voiceResponsesEnabled = process.env.VOICE_RESPONSES_ENABLED === 'true';
  return voiceResponsesEnabled
    ? '\n\nThe user has enabled voice responses, so use the \'speak\' tool to respond to the user\'s voice input before proceeding.'
    : '';
}

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
        {
          name: 'speak',
          description: 'Speak text using text-to-speech and mark delivered utterances as responded',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The text to speak',
              },
            },
            required: ['text'],
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
        const response = await fetch(`http://localhost:${HTTP_PORT}/api/dequeue-utterances`, {
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
              text: `Dequeued ${data.utterances.length} utterance(s):\n\n${data.utterances.reverse().map((u: any) => `"${u.text}"\t[time: ${new Date(u.timestamp).toISOString()}]`).join('\n')
                }${getVoiceResponseReminder()}`,
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

        const response = await fetch(`http://localhost:${HTTP_PORT}/api/wait-for-utterances`, {
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
                text: `Found ${data.count} utterance(s):\n\n${utteranceTexts}${getVoiceResponseReminder()}`,
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

      if (name === 'speak') {
        const text = args?.text as string;

        if (!text || !text.trim()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Text is required for speak tool',
              },
            ],
            isError: true,
          };
        }

        const response = await fetch(`http://localhost:${HTTP_PORT}/api/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        const data = await response.json() as any;

        if (response.ok) {
          return {
            content: [
              {
                type: 'text',
                text: `Spoke: "${text}"\n${data.respondedCount > 0 ? `Marked ${data.respondedCount} utterance(s) as responded.` : 'No delivered utterances to mark as responded.'}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Error speaking text: ${data.error || 'Unknown error'}`,
              },
            ],
            isError: true,
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