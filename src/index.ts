import { InMemoryUtteranceQueue } from './utterance-queue.js';
import { HttpServer } from './http-server.js';

async function main() {
  // Shared utterance queue between HTTP and MCP servers
  const utteranceQueue = new InMemoryUtteranceQueue();
  
  // Start HTTP server for browser client
  const port = process.env.MCP_VOICE_HOOKS_PORT ? parseInt(process.env.MCP_VOICE_HOOKS_PORT) : 5111;
  const httpServer = new HttpServer(utteranceQueue, port);
  await httpServer.start();
  
  // Note: MCP server runs separately via `npm run mcp` command
  
  console.log('Voice Hooks servers ready!');
  console.log(`- HTTP server: http://localhost:${port}`);
  console.log('- MCP server: Ready for stdio connection');
}

main().catch(console.error);