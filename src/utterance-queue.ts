import { Utterance, UtteranceQueue } from './types.js';
import { randomUUID } from 'crypto';
import { debugLog } from './debug.js';

export class InMemoryUtteranceQueue implements UtteranceQueue {
  public utterances: Utterance[] = [];

  add(text: string, timestamp?: Date): Utterance {
    const utterance: Utterance = {
      id: randomUUID(),
      text: text.trim(),
      timestamp: timestamp || new Date(),
      status: 'pending'
    };
    
    this.utterances.push(utterance);
    debugLog(`[Queue] queued:	"${utterance.text}"	[id: ${utterance.id}]`);
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
      debugLog(`[Queue] delivered:	"${utterance.text}"	[id: ${id}]`);
    }
  }

  clear(): void {
    const count = this.utterances.length;
    this.utterances = [];
    debugLog(`[Queue] Cleared ${count} utterances`);
  }
}