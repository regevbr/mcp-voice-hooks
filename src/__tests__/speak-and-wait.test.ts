import request from 'supertest';
import express from 'express';

describe('speak_and_then_wait_for_utterance integration', () => {
  let app: express.Application;
  let queue: any;
  let lastTimeoutTimestamp: Date | null;
  let speakCalled = false;
  let speakText = '';

  beforeEach(() => {
    // Reset state
    speakCalled = false;
    speakText = '';
    lastTimeoutTimestamp = null;
    
    // Mock queue
    queue = {
      utterances: [],
      markDelivered: function(id: string) {
        const utterance = this.utterances.find((u: any) => u.id === id);
        if (utterance) {
          utterance.status = 'delivered';
        }
      }
    };

    // Create express app with endpoints
    app = express();
    app.use(express.json());

    // Mock speak endpoint
    app.post('/api/speak', async (req, res) => {
      const { text } = req.body;
      
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      speakCalled = true;
      speakText = text;

      // Mark all delivered utterances as responded
      const deliveredUtterances = queue.utterances.filter((u: any) => u.status === 'delivered');
      deliveredUtterances.forEach((u: any) => {
        u.status = 'responded';
      });

      res.json({
        success: true,
        message: 'Text spoken successfully',
        respondedCount: deliveredUtterances.length
      });
    });

    // Mock wait-for-utterances endpoint
    app.post('/api/wait-for-utterances', async (req, res) => {
      const { seconds_to_wait = 30 } = req.body;

      // Check if we should return immediately
      if (lastTimeoutTimestamp) {
        const hasNewUtterances = queue.utterances.some(
          (u: any) => u.timestamp > lastTimeoutTimestamp!
        );
        if (!hasNewUtterances) {
          res.json({
            success: true,
            utterances: [],
            message: `No utterances found after waiting ${seconds_to_wait} seconds.`,
            waitTime: 0,
          });
          return;
        }
      }

      // Check for pending utterances
      const pendingUtterances = queue.utterances.filter(
        (u: any) => u.status === 'pending' &&
          (!lastTimeoutTimestamp || u.timestamp > lastTimeoutTimestamp)
      );

      if (pendingUtterances.length > 0) {
        // Mark utterances as delivered
        pendingUtterances.forEach((u: any) => {
          queue.markDelivered(u.id);
        });

        res.json({
          success: true,
          utterances: pendingUtterances.map((u: any) => ({
            id: u.id,
            text: u.text,
            timestamp: u.timestamp,
            status: 'delivered',
          })),
          count: pendingUtterances.length,
          waitTime: 100,
        });
      } else {
        // No utterances found
        lastTimeoutTimestamp = new Date();
        res.json({
          success: true,
          utterances: [],
          message: `No utterances found after waiting ${seconds_to_wait} seconds.`,
          waitTime: 100,
        });
      }
    });
  });

  describe('normal flow', () => {
    it('should speak text and then wait for utterances', async () => {
      // Simulate speak_and_then_wait_for_utterance behavior
      const textToSpeak = 'Hello, how can I help you?';
      
      // First, speak
      const speakResponse = await request(app)
        .post('/api/speak')
        .send({ text: textToSpeak });

      expect(speakResponse.status).toBe(200);
      expect(speakCalled).toBe(true);
      expect(speakText).toBe(textToSpeak);

      // Then wait for utterances
      const waitResponse = await request(app)
        .post('/api/wait-for-utterances')
        .send({ seconds_to_wait: 30 });

      expect(waitResponse.status).toBe(200);
      expect(waitResponse.body.utterances).toEqual([]);
    });

    it('should receive utterances after speaking', async () => {
      // Add a pending utterance
      queue.utterances.push({
        id: '1',
        text: 'User response',
        timestamp: new Date(),
        status: 'pending'
      });

      // Speak first
      await request(app)
        .post('/api/speak')
        .send({ text: 'Question for you' });

      // Wait and receive utterance
      const waitResponse = await request(app)
        .post('/api/wait-for-utterances')
        .send({ seconds_to_wait: 30 });

      expect(waitResponse.body.utterances).toHaveLength(1);
      expect(waitResponse.body.utterances[0].text).toBe('User response');
      expect(queue.utterances[0].status).toBe('delivered');
    });
  });

  describe('pre-speak hook endpoint', () => {
    // Add pre-speak hook endpoint to the test app
    beforeEach(() => {
      app.post('/api/hooks/pre-speak', (req, res) => {
        // Check for pending utterances
        const pendingUtterances = queue.utterances.filter((u: any) => u.status === 'pending');
        if (pendingUtterances.length > 0) {
          res.json({
            decision: 'block',
            reason: `${pendingUtterances.length} pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.`
          });
          return;
        }

        res.json({
          decision: 'approve'
        });
      });
    });

    it('should approve when no pending utterances', async () => {
      const response = await request(app)
        .post('/api/hooks/pre-speak')
        .send({});

      expect(response.body).toEqual({
        decision: 'approve'
      });
    });

    it('should block when pending utterances exist', async () => {
      queue.utterances.push({
        id: '1',
        text: 'Pending utterance',
        timestamp: new Date(),
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/hooks/pre-speak')
        .send({});

      expect(response.body).toEqual({
        decision: 'block',
        reason: '1 pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.'
      });
    });

    it('should not block for delivered or responded utterances', async () => {
      queue.utterances.push(
        {
          id: '1',
          text: 'Delivered utterance',
          timestamp: new Date(),
          status: 'delivered'
        },
        {
          id: '2',
          text: 'Responded utterance',
          timestamp: new Date(),
          status: 'responded'
        }
      );

      const response = await request(app)
        .post('/api/hooks/pre-speak')
        .send({});

      expect(response.body).toEqual({
        decision: 'approve'
      });
    });
  });
});