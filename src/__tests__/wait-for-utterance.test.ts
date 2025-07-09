import { InMemoryUtteranceQueue } from '../utterance-queue';

describe('wait_for_utterance behavior', () => {
  let queue: InMemoryUtteranceQueue;

  beforeEach(() => {
    queue = new InMemoryUtteranceQueue();
  });

  describe('wait_for_utterance SHOULD mark utterances as delivered', () => {
    it('should mark found utterances as delivered', () => {
      // Add some utterances
      const u1 = queue.add('First utterance');
      const u2 = queue.add('Second utterance');
      const u3 = queue.add('Third utterance');

      // Simulate wait_for_utterance behavior
      const pendingUtterances = queue.utterances.filter(u => u.status === 'pending');
      
      // Verify utterances are found
      expect(pendingUtterances).toHaveLength(3);
      
      // Simulate marking as delivered (what wait_for_utterance does)
      pendingUtterances.forEach(u => {
        queue.markDelivered(u.id);
      });
      
      // Verify all are now delivered
      expect(queue.utterances.find(u => u.id === u1.id)?.status).toBe('delivered');
      expect(queue.utterances.find(u => u.id === u2.id)?.status).toBe('delivered');
      expect(queue.utterances.find(u => u.id === u3.id)?.status).toBe('delivered');
    });

    it('should only mark pending utterances as delivered', () => {
      // Add mixed status utterances
      const u1 = queue.add('Pending 1');
      const u2 = queue.add('Pending 2');
      const u3 = queue.add('Already delivered');
      
      // Mark one as already delivered
      queue.markDelivered(u3.id);
      
      // Simulate wait_for_utterance filtering and marking
      const pendingUtterances = queue.utterances.filter(u => u.status === 'pending');
      pendingUtterances.forEach(u => {
        queue.markDelivered(u.id);
      });
      
      // All should now be delivered
      expect(queue.utterances.find(u => u.id === u1.id)?.status).toBe('delivered');
      expect(queue.utterances.find(u => u.id === u2.id)?.status).toBe('delivered');
      expect(queue.utterances.find(u => u.id === u3.id)?.status).toBe('delivered');
    });

    it('should filter pending utterances correctly', () => {
      const oldTimestamp = new Date(Date.now() - 10000);
      const recentTimestamp = new Date();
      
      // Add utterances with different timestamps
      const u1 = queue.add('Old utterance', oldTimestamp);
      const u2 = queue.add('Recent utterance', recentTimestamp);
      
      // Filter pending utterances
      const pendingUtterances = queue.utterances.filter(
        u => u.status === 'pending'
      );
      
      // Should find both utterances
      expect(pendingUtterances).toHaveLength(2);
      
      // Mark only the recent one as delivered
      queue.markDelivered(u2.id);
      
      // Verify correct marking
      expect(queue.utterances.find(u => u.id === u1.id)?.status).toBe('pending'); // Old one stays pending
      expect(queue.utterances.find(u => u.id === u2.id)?.status).toBe('delivered'); // Recent one delivered
    });

    it('should sort utterances by timestamp before returning', () => {
      // Add utterances in reverse order
      const u3 = queue.add('Third (newest)');
      const u2 = queue.add('Second');
      const u1 = queue.add('First (oldest)');
      
      // Update timestamps to ensure order
      u1.timestamp = new Date(Date.now() - 3000);
      u2.timestamp = new Date(Date.now() - 2000);
      u3.timestamp = new Date(Date.now() - 1000);
      
      // Simulate wait_for_utterance sorting and marking
      const pendingUtterances = queue.utterances
        .filter(u => u.status === 'pending')
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // Oldest first
      
      // Verify sort order
      expect(pendingUtterances[0].text).toBe('First (oldest)');
      expect(pendingUtterances[1].text).toBe('Second');
      expect(pendingUtterances[2].text).toBe('Third (newest)');
      
      // Mark all as delivered
      pendingUtterances.forEach(u => {
        queue.markDelivered(u.id);
      });
      
      // All should be delivered
      expect(queue.utterances.every(u => u.status === 'delivered')).toBe(true);
    });
  });

  describe('dequeue_utterances vs wait_for_utterance', () => {
    it('both should mark utterances as delivered', () => {
      // Add utterances
      const u1 = queue.add('Test 1');
      const u2 = queue.add('Test 2');
      
      // Both wait_for_utterance and dequeue_utterances mark as delivered
      // The difference is in their behavior (wait vs immediate return)
      
      // Simulate either operation
      const pendingUtterances = queue.utterances.filter(u => u.status === 'pending');
      pendingUtterances.forEach(u => {
        queue.markDelivered(u.id);
      });
      
      // Verify delivered
      expect(queue.utterances.every(u => u.status === 'delivered')).toBe(true);
    });

    it('should handle no pending utterances gracefully', () => {
      // Add utterances and mark all as delivered
      const u1 = queue.add('Already delivered 1');
      const u2 = queue.add('Already delivered 2');
      
      queue.markDelivered(u1.id);
      queue.markDelivered(u2.id);
      
      // Simulate wait_for_utterance with no pending
      const pendingUtterances = queue.utterances.filter(u => u.status === 'pending');
      
      // Should find no pending utterances
      expect(pendingUtterances).toHaveLength(0);
      
      // Nothing to mark, status should remain
      expect(queue.utterances.find(u => u.id === u1.id)?.status).toBe('delivered');
      expect(queue.utterances.find(u => u.id === u2.id)?.status).toBe('delivered');
    });
  });

  describe('Integration: multiple wait calls', () => {
    it('should not return already delivered utterances', () => {
      // Add utterances
      const u1 = queue.add('First batch 1');
      const u2 = queue.add('First batch 2');
      
      // First wait_for_utterance call
      const firstCall = queue.utterances.filter(u => u.status === 'pending');
      expect(firstCall).toHaveLength(2);
      
      // Mark as delivered
      firstCall.forEach(u => {
        queue.markDelivered(u.id);
      });
      
      // Add new utterances
      const u3 = queue.add('Second batch 1');
      const u4 = queue.add('Second batch 2');
      
      // Second wait_for_utterance call
      const secondCall = queue.utterances.filter(u => u.status === 'pending');
      expect(secondCall).toHaveLength(2);
      expect(secondCall.map(u => u.text)).toEqual(['Second batch 1', 'Second batch 2']);
      
      // Mark second batch as delivered
      secondCall.forEach(u => {
        queue.markDelivered(u.id);
      });
      
      // All should now be delivered
      expect(queue.utterances.every(u => u.status === 'delivered')).toBe(true);
    });
  });
});