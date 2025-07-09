import request from 'supertest';
import express from 'express';

describe('utterance state transitions', () => {
  let app: express.Application;
  let queue: any;

  beforeEach(() => {
    // Mock utterance queue
    queue = {
      utterances: [],
      add: function(text: string, timestamp?: Date) {
        const utterance = {
          id: Math.random().toString(36).substr(2, 9),
          text: text.trim(),
          timestamp: timestamp || new Date(),
          status: 'pending'
        };
        this.utterances.push(utterance);
        return utterance;
      },
      markDelivered: function(id: string) {
        const utterance = this.utterances.find((u: any) => u.id === id);
        if (utterance) {
          utterance.status = 'delivered';
        }
      }
    };

    // Create express app with essential endpoints
    app = express();
    app.use(express.json());

    // Add utterance endpoint
    app.post('/api/potential-utterances', (req, res) => {
      const { text } = req.body;
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }
      const utterance = queue.add(text);
      res.json({
        success: true,
        utterance: {
          id: utterance.id,
          text: utterance.text,
          timestamp: utterance.timestamp,
          status: utterance.status,
        },
      });
    });

    // Dequeue endpoint
    app.post('/api/dequeue-utterances', (req, res) => {
      const pendingUtterances = queue.utterances
        .filter((u: any) => u.status === 'pending');

      pendingUtterances.forEach((u: any) => {
        queue.markDelivered(u.id);
      });

      res.json({
        success: true,
        utterances: pendingUtterances,
      });
    });

    // Speak endpoint
    app.post('/api/speak', (req, res) => {
      const { text } = req.body;
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

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

    // Status endpoint
    app.get('/api/utterances/status', (req, res) => {
      const total = queue.utterances.length;
      const pending = queue.utterances.filter((u: any) => u.status === 'pending').length;
      const delivered = queue.utterances.filter((u: any) => u.status === 'delivered').length;
      const responded = queue.utterances.filter((u: any) => u.status === 'responded').length;

      res.json({
        total,
        pending,
        delivered,
        responded
      });
    });
  });

  describe('state transition: pending -> delivered', () => {
    it('should transition from pending to delivered when dequeued', async () => {
      // Add utterance (starts as pending)
      await request(app)
        .post('/api/potential-utterances')
        .send({ text: 'Hello world' });

      // Verify pending state
      let status = await request(app).get('/api/utterances/status');
      expect(status.body).toMatchObject({
        total: 1,
        pending: 1,
        delivered: 0,
        responded: 0
      });

      // Dequeue utterances
      await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 10 });

      // Verify delivered state
      status = await request(app).get('/api/utterances/status');
      expect(status.body).toMatchObject({
        total: 1,
        pending: 0,
        delivered: 1,
        responded: 0
      });
    });

    it('should handle multiple utterances', async () => {
      // Add multiple utterances
      await request(app).post('/api/potential-utterances').send({ text: 'First' });
      await request(app).post('/api/potential-utterances').send({ text: 'Second' });
      await request(app).post('/api/potential-utterances').send({ text: 'Third' });

      // Dequeue all pending utterances
      await request(app)
        .post('/api/dequeue-utterances')
        .send({});

      // Verify all are delivered
      const status = await request(app).get('/api/utterances/status');
      expect(status.body).toMatchObject({
        total: 3,
        pending: 0,
        delivered: 3,
        responded: 0
      });
    });
  });

  describe('state transition: delivered -> responded', () => {
    it('should transition from delivered to responded when speak is called', async () => {
      // Enable voice responses first
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: true });

      // Add and deliver utterance
      await request(app).post('/api/potential-utterances').send({ text: 'Hello' });
      await request(app).post('/api/dequeue-utterances').send({});

      // Verify delivered state
      let status = await request(app).get('/api/utterances/status');
      expect(status.body.delivered).toBe(1);

      // Speak response
      const speakResponse = await request(app)
        .post('/api/speak')
        .send({ text: 'Hello to you too!' });

      expect(speakResponse.body.respondedCount).toBe(1);

      // Verify responded state
      status = await request(app).get('/api/utterances/status');
      expect(status.body).toMatchObject({
        total: 1,
        pending: 0,
        delivered: 0,
        responded: 1
      });
    });

    it('should mark all delivered utterances as responded', async () => {
      // Add multiple utterances
      await request(app).post('/api/potential-utterances').send({ text: 'First' });
      await request(app).post('/api/potential-utterances').send({ text: 'Second' });
      await request(app).post('/api/potential-utterances').send({ text: 'Third' });

      // Dequeue all utterances
      await request(app).post('/api/dequeue-utterances').send({});

      // Speak response
      const speakResponse = await request(app)
        .post('/api/speak')
        .send({ text: 'Response' });

      expect(speakResponse.body.respondedCount).toBe(3);

      // Verify states
      const status = await request(app).get('/api/utterances/status');
      expect(status.body).toMatchObject({
        total: 3,
        pending: 0,
        delivered: 0,
        responded: 3
      });
    });

    it('should handle speak with no delivered utterances', async () => {
      const speakResponse = await request(app)
        .post('/api/speak')
        .send({ text: 'Speaking without utterances' });

      expect(speakResponse.body).toMatchObject({
        success: true,
        respondedCount: 0
      });
    });
  });

  describe('complete conversation flow', () => {
    it('should follow pending -> delivered -> responded cycle', async () => {
      // User speaks
      await request(app).post('/api/potential-utterances').send({ text: 'What is 2+2?' });

      // Assistant dequeues
      const dequeueResponse = await request(app)
        .post('/api/dequeue-utterances')
        .send({ limit: 10 });
      
      expect(dequeueResponse.body.utterances).toHaveLength(1);
      expect(dequeueResponse.body.utterances[0].text).toBe('What is 2+2?');

      // Assistant speaks response
      const speakResponse = await request(app)
        .post('/api/speak')
        .send({ text: '2+2 equals 4' });

      expect(speakResponse.body.respondedCount).toBe(1);

      // Verify final state
      const status = await request(app).get('/api/utterances/status');
      expect(status.body).toMatchObject({
        total: 1,
        pending: 0,
        delivered: 0,
        responded: 1
      });
    });

    it('should handle multiple conversation turns', async () => {
      // First turn
      await request(app).post('/api/potential-utterances').send({ text: 'Hello' });
      await request(app).post('/api/dequeue-utterances').send({});
      await request(app).post('/api/speak').send({ text: 'Hi there!' });

      // Second turn
      await request(app).post('/api/potential-utterances').send({ text: 'How are you?' });
      await request(app).post('/api/dequeue-utterances').send({});
      await request(app).post('/api/speak').send({ text: 'I am doing well!' });

      // Verify final state
      const status = await request(app).get('/api/utterances/status');
      expect(status.body).toMatchObject({
        total: 2,
        pending: 0,
        delivered: 0,
        responded: 2
      });
    });
  });
});