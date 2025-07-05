import request from 'supertest';
import express from 'express';
import type { Response } from 'express';

describe('validate-action endpoint', () => {
  let app: express.Application;
  let queue: any;
  let lastTimeoutTimestamp: Date | null;

  beforeEach(() => {
    // Reset environment
    delete process.env.VOICE_RESPONSES_ENABLED;
    
    // Mock queue
    queue = {
      utterances: []
    };
    
    lastTimeoutTimestamp = null;

    // Create express app with validate-action endpoint
    app = express();
    app.use(express.json());
    
    app.post('/api/validate-action', (req: express.Request, res: Response) => {
      const { action } = req.body;
      const voiceResponsesEnabled = process.env.VOICE_RESPONSES_ENABLED === 'true';

      if (!action || !['tool-use', 'stop'].includes(action)) {
        res.status(400).json({ error: 'Invalid action. Must be "tool-use" or "stop"' });
        return;
      }

      // Check for pending utterances (both actions)
      const pendingUtterances = queue.utterances.filter((u: any) => u.status === 'pending');
      if (pendingUtterances.length > 0) {
        res.json({
          allowed: false,
          requiredAction: 'dequeue_utterances',
          reason: `${pendingUtterances.length} pending utterance(s) must be dequeued first`
        });
        return;
      }

      // Check for delivered but unresponded utterances (when voice enabled)
      if (voiceResponsesEnabled) {
        const deliveredUtterances = queue.utterances.filter((u: any) => u.status === 'delivered');
        if (deliveredUtterances.length > 0) {
          res.json({
            allowed: false,
            requiredAction: 'speak',
            reason: `${deliveredUtterances.length} delivered utterance(s) require voice response`
          });
          return;
        }
      }

      // For stop action, check if we should wait
      if (action === 'stop') {
        const shouldWait = !lastTimeoutTimestamp ||
          queue.utterances.some((u: any) => u.timestamp > lastTimeoutTimestamp!);
        
        if (shouldWait) {
          res.json({
            allowed: false,
            requiredAction: 'wait_for_utterance',
            reason: 'Must wait for potential voice input before stopping'
          });
          return;
        }
      }

      // All checks passed - action is allowed
      res.json({
        allowed: true
      });
    });
  });

  describe('input validation', () => {
    it('should reject invalid action types', async () => {
      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid action. Must be "tool-use" or "stop"'
      });
    });

    it('should reject missing action', async () => {
      const response = await request(app)
        .post('/api/validate-action')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid action. Must be "tool-use" or "stop"'
      });
    });
  });

  describe('tool-use action', () => {
    it('should allow when no utterances exist', async () => {
      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'tool-use' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ allowed: true });
    });

    it('should block when pending utterances exist', async () => {
      queue.utterances = [
        { id: '1', status: 'pending', text: 'Hello', timestamp: new Date() }
      ];

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'tool-use' });

      expect(response.body).toEqual({
        allowed: false,
        requiredAction: 'dequeue_utterances',
        reason: '1 pending utterance(s) must be dequeued first'
      });
    });

    it('should allow when voice responses disabled and delivered utterances exist', async () => {
      queue.utterances = [
        { id: '1', status: 'delivered', text: 'Hello', timestamp: new Date() }
      ];

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'tool-use' });

      expect(response.body).toEqual({ allowed: true });
    });

    it('should block when voice responses enabled and delivered utterances exist', async () => {
      process.env.VOICE_RESPONSES_ENABLED = 'true';
      queue.utterances = [
        { id: '1', status: 'delivered', text: 'Hello', timestamp: new Date() },
        { id: '2', status: 'delivered', text: 'World', timestamp: new Date() }
      ];

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'tool-use' });

      expect(response.body).toEqual({
        allowed: false,
        requiredAction: 'speak',
        reason: '2 delivered utterance(s) require voice response'
      });
    });

    it('should allow when all utterances are responded', async () => {
      process.env.VOICE_RESPONSES_ENABLED = 'true';
      queue.utterances = [
        { id: '1', status: 'responded', text: 'Hello', timestamp: new Date() }
      ];

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'tool-use' });

      expect(response.body).toEqual({ allowed: true });
    });
  });

  describe('stop action', () => {
    it('should block when no timeout has occurred', async () => {
      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'stop' });

      expect(response.body).toEqual({
        allowed: false,
        requiredAction: 'wait_for_utterance',
        reason: 'Must wait for potential voice input before stopping'
      });
    });

    it('should allow after timeout with no new utterances', async () => {
      lastTimeoutTimestamp = new Date();

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'stop' });

      expect(response.body).toEqual({ allowed: true });
    });

    it('should block when utterances exist after timeout', async () => {
      lastTimeoutTimestamp = new Date(Date.now() - 60000); // 1 minute ago
      queue.utterances = [
        { id: '1', status: 'responded', text: 'Hello', timestamp: new Date() }
      ];

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'stop' });

      expect(response.body).toEqual({
        allowed: false,
        requiredAction: 'wait_for_utterance',
        reason: 'Must wait for potential voice input before stopping'
      });
    });

    it('should block with pending utterances even after timeout', async () => {
      lastTimeoutTimestamp = new Date();
      queue.utterances = [
        { id: '1', status: 'pending', text: 'Hello', timestamp: new Date() }
      ];

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'stop' });

      expect(response.body).toEqual({
        allowed: false,
        requiredAction: 'dequeue_utterances',
        reason: '1 pending utterance(s) must be dequeued first'
      });
    });

    it('should prioritize speak over wait when voice enabled', async () => {
      process.env.VOICE_RESPONSES_ENABLED = 'true';
      queue.utterances = [
        { id: '1', status: 'delivered', text: 'Hello', timestamp: new Date() }
      ];

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'stop' });

      expect(response.body).toEqual({
        allowed: false,
        requiredAction: 'speak',
        reason: '1 delivered utterance(s) require voice response'
      });
    });
  });

  describe('action priority', () => {
    it('should prioritize dequeue over speak', async () => {
      process.env.VOICE_RESPONSES_ENABLED = 'true';
      queue.utterances = [
        { id: '1', status: 'pending', text: 'Hello', timestamp: new Date() },
        { id: '2', status: 'delivered', text: 'World', timestamp: new Date() }
      ];

      const response = await request(app)
        .post('/api/validate-action')
        .send({ action: 'tool-use' });

      expect(response.body.requiredAction).toBe('dequeue_utterances');
    });
  });
});