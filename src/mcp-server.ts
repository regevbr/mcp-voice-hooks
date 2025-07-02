import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { InMemoryUtteranceQueue } from './utterance-queue.js';

class VoiceHooksMCPServer {
  private server: Server;
  private utteranceQueue: InMemoryUtteranceQueue;

  constructor() {
    this.utteranceQueue = new InMemoryUtteranceQueue();
    this.server = new Server(
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

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_recent_utterances',
            description: 'Get recent utterances from the queue. Returns immediately if no utterances are available.',
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

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_recent_utterances': {
          const limit = args?.limit as number || 10;
          const utterances = this.utteranceQueue.getRecent(limit);
          
          // Mark retrieved utterances as delivered
          utterances.forEach(u => {
            if (u.status === 'pending') {
              this.utteranceQueue.markDelivered(u.id);
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
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Voice Hooks MCP Server running on stdio');
  }
}

// Export for testing
export { VoiceHooksMCPServer };

// Run server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new VoiceHooksMCPServer();
  server.run().catch(console.error);
}