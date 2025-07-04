#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { debugLog } from './debug.js';

const HTTP_SERVER_URL = 'http://localhost:3000';

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
              description: 'Maximum seconds to wait for an utterance (default: 10)',
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
    case 'dequeue_utterances': {
      try {
        const limit = args?.limit || 10;
        
        // Use atomic dequeue endpoint
        const response = await fetch(`${HTTP_SERVER_URL}/api/dequeue-utterances`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ limit }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP server returned ${response.status}: ${response.statusText}`);
        }
        
        const data: any = await response.json();
        const utterances = data.utterances || [];
        
        debugLog(`[MCP Proxy] Dequeued ${utterances.length} utterances`);

        return {
          content: [
            {
              type: 'text',
              text: utterances.length > 0 
                ? `Found ${utterances.length} recent utterances:\n\n${utterances.map((u: any) => 
                    `[${new Date(u.timestamp).toISOString()}] "${u.text}"`
                  ).join('\n')}`
                : 'No recent utterances found.',
            },
          ],
        };
      } catch (error) {
        console.error('[MCP Proxy] Error fetching utterances:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching utterances: ${(error as Error).message}. Make sure the HTTP server is running on ${HTTP_SERVER_URL}`,
            },
          ],
        };
      }
    }

    case 'wait_for_utterance': {
      try {
        const secondsToWait = args?.seconds_to_wait || 10;
        
        // Call the wait-for-utterances endpoint which actually waits
        const response = await fetch(`${HTTP_SERVER_URL}/api/wait-for-utterances`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ seconds_to_wait: secondsToWait }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP server returned ${response.status}: ${response.statusText}`);
        }
        
        const data: any = await response.json();
        const utterances = data.utterances || [];
        
        if (utterances.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Found ${utterances.length} utterance(s):\n\n${utterances.map((u: any) => 
                  `[${new Date(u.timestamp).toISOString()}] "${u.text}"`
                ).join('\n')}`,
              },
            ],
          };
        } else {
          // Return the message from the server (includes wait time info)
          return {
            content: [
              {
                type: 'text',
                text: data.message || `No utterances found after waiting ${secondsToWait} seconds.`,
              },
            ],
          };
        }
      } catch (error) {
        console.error('[MCP Proxy] Error in wait_for_utterance:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error waiting for utterances: ${(error as Error).message}`,
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Voice Hooks MCP Proxy Server running on stdio');
  console.error(`Forwarding requests to HTTP server at ${HTTP_SERVER_URL}`);
}

main().catch(console.error);