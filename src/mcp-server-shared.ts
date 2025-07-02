#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import the shared queue - we'll need to use dynamic import for ES modules
let globalQueue: any;

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
      // Make sure we have the shared queue
      if (!globalQueue) {
        const { globalQueue: importedQueue } = await import('../shared-queue.js');
        globalQueue = importedQueue;
      }

      const limit = args?.limit as number || 10;
      const utterances = globalQueue.getRecent(limit);
      
      // Mark retrieved utterances as delivered
      utterances.forEach((u: any) => {
        if (u.status === 'pending') {
          globalQueue.markDelivered(u.id);
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: utterances.length > 0 
              ? `Found ${utterances.length} recent utterances:\n\n${utterances.map((u: any) => 
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Voice Hooks MCP Server (Shared Queue) running on stdio');
}

main().catch(console.error);