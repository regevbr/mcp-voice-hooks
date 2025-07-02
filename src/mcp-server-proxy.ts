#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

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
        name: 'get_recent_utterances',
        description: 'Get recent utterances from the HTTP server queue',
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
      try {
        const limit = args?.limit || 10;
        
        // Fetch utterances from HTTP server
        const response = await fetch(`${HTTP_SERVER_URL}/api/utterances?limit=${limit}`);
        
        if (!response.ok) {
          throw new Error(`HTTP server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const utterances = data.utterances || [];
        
        // Mark utterances as delivered by calling HTTP server
        // (We could add a PATCH endpoint for this, but for now we'll just mark them locally)
        for (const utterance of utterances) {
          if (utterance.status === 'pending') {
            // In a full implementation, we'd call PATCH /api/utterances/:id/delivered
            // For now, we'll just note that they've been delivered
            console.error(`[MCP Proxy] Delivered utterance: ${utterance.id}`);
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: utterances.length > 0 
                ? `Found ${utterances.length} recent utterances:\n\n${utterances.map(u => 
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
              text: `Error fetching utterances: ${error.message}. Make sure the HTTP server is running on ${HTTP_SERVER_URL}`,
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