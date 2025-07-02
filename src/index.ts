import { InMemoryUtteranceQueue } from './utterance-queue.js';
import { HttpServer } from './http-server.js';

async function main() {
  // Shared utterance queue between HTTP and MCP servers
  const utteranceQueue = new InMemoryUtteranceQueue();
  
  // Start HTTP server for browser client
  const httpServer = new HttpServer(utteranceQueue);
  await httpServer.start();
  
  // Note: MCP server runs separately via `npm run mcp` command
  
  console.log('Voice Hooks servers ready!');
  console.log('- HTTP server: http://localhost:3000');
  console.log('- MCP server: Ready for stdio connection');
}

main().catch(console.error);