#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

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
        description: 'Get recent utterances from the queue (hardcoded for POC)',
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
  const { name } = request.params;

  switch (name) {
    case 'get_recent_utterances': {
      // Hardcoded response for POC
      return {
        content: [
          {
            type: 'text',
            text: 'Found 2 recent utterances:\n\n[2024-01-15T10:30:00.000Z] "Stop what you\'re doing"\n[2024-01-15T10:29:45.000Z] "Wait, that\'s not right"',
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
  console.error('Voice Hooks MCP Server (Simple POC) running on stdio');
}

main().catch(console.error);