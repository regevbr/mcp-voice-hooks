import { randomUUID } from 'crypto';

// Shared utterance queue that both HTTP and MCP servers can use
export class SharedUtteranceQueue {
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

// Global shared instance
export const globalQueue = new SharedUtteranceQueue();