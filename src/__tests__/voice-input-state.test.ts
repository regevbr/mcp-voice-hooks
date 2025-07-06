import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

// Mock InMemoryUtteranceQueue
class MockUtteranceQueue {
  utterances: any[] = [];

  add(text: string, timestamp?: Date) {
    const utterance = {
      id: randomUUID(),
      text: text.trim(),
      timestamp: timestamp || new Date(),
      status: 'pending'
    };
    this.utterances.push(utterance);
    return utterance;
  }

  markDelivered(id: string) {
    const utterance = this.utterances.find(u => u.id === id);
    if (utterance) {
      utterance.status = 'delivered';
    }
  }
}

describe('Voice Input State Error Handling', () => {
  let app: express.Application;
  let server: any;
  let queue: MockUtteranceQueue;
  let voicePreferences: any;

  beforeEach(() => {
    // Reset state
    queue = new MockUtteranceQueue();
    voicePreferences = {
      voiceResponsesEnabled: false,
      voiceInputActive: false
    };

    // Create express app
    app = express();
    app.use(cors());
    app.use(express.json());

    // Voice input state endpoint
    app.post('/api/voice-input-state', (req, res) => {
      const { active } = req.body;
      voicePreferences.voiceInputActive = !!active;
      res.json({
        success: true,
        voiceInputActive: voicePreferences.voiceInputActive
      });
    });

    // Dequeue utterances endpoint
    app.post('/api/dequeue-utterances', (req, res) => {
      // Check if voice input is active
      if (!voicePreferences.voiceInputActive) {
        res.status(400).json({
          success: false,
          error: 'Voice input is not active. Cannot dequeue utterances when voice input is disabled.'
        });
        return;
      }

      const { limit = 10 } = req.body;
      const pendingUtterances = queue.utterances
        .filter(u => u.status === 'pending')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

      // Mark as delivered
      pendingUtterances.forEach(u => {
        queue.markDelivered(u.id);
      });

      res.json({
        success: true,
        utterances: pendingUtterances.map(u => ({
          text: u.text,
          timestamp: u.timestamp,
        })),
      });
    });

    // Wait for utterances endpoint
    app.post('/api/wait-for-utterances', async (req, res) => {
      // Check if voice input is active
      if (!voicePreferences.voiceInputActive) {
        res.status(400).json({
          success: false,
          error: 'Voice input is not active. Cannot wait for utterances when voice input is disabled.'
        });
        return;
      }

      // Simplified implementation for testing
      res.json({
        success: true,
        utterances: [],
        message: 'No utterances found after waiting.',
        waitTime: 0,
      });
    });

    // Start server on random port
    server = app.listen(0);
  });

  afterEach((done) => {
    server.close(done);
  });

  describe('POST /api/dequeue-utterances', () => {
    it('should return 400 error when voice input is not active', async () => {
      // Ensure voice input is not active
      voicePreferences.voiceInputActive = false;

      const response = await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 10 })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Voice input is not active. Cannot dequeue utterances when voice input is disabled.'
      });
    });

    it('should dequeue utterances successfully when voice input is active', async () => {
      // Enable voice input
      await request(app)
        .post('/api/voice-input-state')
        .send({ active: true })
        .expect(200);

      // Add some utterances with explicit timestamps to ensure order
      const now = Date.now();
      queue.utterances.push({
        id: randomUUID(),
        text: 'Test utterance 1',
        timestamp: new Date(now - 1000),
        status: 'pending'
      });
      queue.utterances.push({
        id: randomUUID(),
        text: 'Test utterance 2',
        timestamp: new Date(now),
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.utterances).toHaveLength(2);
      expect(response.body.utterances[0].text).toBe('Test utterance 2'); // Most recent first (descending by timestamp)
      expect(response.body.utterances[1].text).toBe('Test utterance 1');
    });

    it('should respect the limit parameter when voice input is active', async () => {
      // Enable voice input
      await request(app)
        .post('/api/voice-input-state')
        .send({ active: true })
        .expect(200);

      // Add multiple utterances
      for (let i = 1; i <= 5; i++) {
        queue.add(`Test utterance ${i}`);
      }

      const response = await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.utterances).toHaveLength(3);
    });
  });

  describe('POST /api/wait-for-utterances', () => {
    it('should return 400 error when voice input is not active', async () => {
      // Ensure voice input is not active
      voicePreferences.voiceInputActive = false;

      const response = await request(app)
        .post('/api/wait-for-utterances')
        .send({ seconds_to_wait: 30 })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Voice input is not active. Cannot wait for utterances when voice input is disabled.'
      });
    });

    it('should process wait request when voice input is active', async () => {
      // Enable voice input
      await request(app)
        .post('/api/voice-input-state')
        .send({ active: true })
        .expect(200);

      const response = await request(app)
        .post('/api/wait-for-utterances')
        .send({ seconds_to_wait: 30 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.utterances).toBeDefined();
    });
  });

  describe('Voice input state transitions', () => {
    it('should allow dequeue when voice input is activated', async () => {
      // Start with voice input disabled
      voicePreferences.voiceInputActive = false;

      // Try to dequeue - should fail
      let response = await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 10 })
        .expect(400);

      expect(response.body.success).toBe(false);

      // Enable voice input
      await request(app)
        .post('/api/voice-input-state')
        .send({ active: true })
        .expect(200);

      // Add an utterance
      queue.add('Test utterance');

      // Try to dequeue again - should succeed
      response = await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.utterances).toHaveLength(1);
    });

    it('should prevent dequeue when voice input is deactivated', async () => {
      // Start with voice input enabled
      await request(app)
        .post('/api/voice-input-state')
        .send({ active: true })
        .expect(200);

      // Add an utterance and verify dequeue works
      queue.add('Test utterance 1');
      let response = await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Disable voice input
      await request(app)
        .post('/api/voice-input-state')
        .send({ active: false })
        .expect(200);

      // Add another utterance
      queue.add('Test utterance 2');

      // Try to dequeue - should fail
      response = await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Voice input is not active');
    });
  });
});