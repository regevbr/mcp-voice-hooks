import { Utterance, UtteranceQueue } from './types.js';
import { randomUUID } from 'crypto';

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
    console.log(`[Queue] Added utterance: "${utterance.text}" (${utterance.id})`);
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
      console.log(`[Queue] Marked utterance as delivered: ${id}`);
    }
  }

  clear(): void {
    const count = this.utterances.length;
    this.utterances = [];
    console.log(`[Queue] Cleared ${count} utterances`);
  }
}