import { InMemoryUtteranceQueue } from '../utterance-queue';

describe('InMemoryUtteranceQueue', () => {
  let queue: InMemoryUtteranceQueue;

  beforeEach(() => {
    queue = new InMemoryUtteranceQueue();
  });

  describe('add', () => {
    it('should add an utterance to the queue', () => {
      const utterance = queue.add('Hello world');
      
      expect(utterance.text).toBe('Hello world');
      expect(utterance.status).toBe('pending');
      expect(utterance.id).toBeDefined();
      expect(utterance.timestamp).toBeInstanceOf(Date);
      expect(queue.utterances).toHaveLength(1);
    });

    it('should trim whitespace from utterance text', () => {
      const utterance = queue.add('  Hello world  ');
      
      expect(utterance.text).toBe('Hello world');
    });

    it('should generate unique IDs for each utterance', () => {
      const utterance1 = queue.add('First utterance');
      const utterance2 = queue.add('Second utterance');
      
      expect(utterance1.id).not.toBe(utterance2.id);
    });
  });

  describe('getRecent', () => {
    it('should return empty array when no utterances exist', () => {
      const recent = queue.getRecent();
      
      expect(recent).toEqual([]);
    });

    it('should return utterances in reverse chronological order', async () => {
      const utterance1 = queue.add('First');
      await new Promise(resolve => setTimeout(resolve, 10));
      const utterance2 = queue.add('Second');
      await new Promise(resolve => setTimeout(resolve, 10));
      const utterance3 = queue.add('Third');
      
      const recent = queue.getRecent();
      
      expect(recent).toHaveLength(3);
      expect(recent[0].text).toBe('Third');
      expect(recent[1].text).toBe('Second');
      expect(recent[2].text).toBe('First');
    });

    it('should respect the limit parameter', async () => {
      queue.add('First');
      await new Promise(resolve => setTimeout(resolve, 10));
      queue.add('Second');
      await new Promise(resolve => setTimeout(resolve, 10));
      queue.add('Third');
      
      const recent = queue.getRecent(2);
      
      expect(recent).toHaveLength(2);
      expect(recent[0].text).toBe('Third');
      expect(recent[1].text).toBe('Second');
    });

    it('should default to limit of 10', () => {
      // Add 15 utterances with explicit timestamps
      const baseTime = new Date('2024-01-01T10:00:00Z');
      for (let i = 1; i <= 15; i++) {
        const timestamp = new Date(baseTime.getTime() + (i * 1000));
        queue.add(`Utterance ${i}`, timestamp);
      }
      
      const recent = queue.getRecent();
      
      expect(recent).toHaveLength(10);
      expect(recent[0].text).toBe('Utterance 15');
      expect(recent[9].text).toBe('Utterance 6');
    });
  });

  describe('markDelivered', () => {
    it('should mark an utterance as delivered', () => {
      const utterance = queue.add('Test utterance');
      
      expect(utterance.status).toBe('pending');
      
      queue.markDelivered(utterance.id);
      
      expect(utterance.status).toBe('delivered');
    });

    it('should not throw if utterance ID does not exist', () => {
      expect(() => {
        queue.markDelivered('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all utterances from the queue', () => {
      queue.add('First');
      queue.add('Second');
      queue.add('Third');
      
      expect(queue.utterances).toHaveLength(3);
      
      queue.clear();
      
      expect(queue.utterances).toHaveLength(0);
    });

    it('should work when queue is already empty', () => {
      expect(() => {
        queue.clear();
      }).not.toThrow();
      
      expect(queue.utterances).toHaveLength(0);
    });
  });
});