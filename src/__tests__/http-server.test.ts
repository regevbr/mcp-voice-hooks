import request from 'supertest';
import express from 'express';
import { HttpServer } from '../http-server';
import { InMemoryUtteranceQueue } from '../utterance-queue';

describe('HttpServer API', () => {
  let httpServer: HttpServer;
  let app: express.Application;
  let queue: InMemoryUtteranceQueue;

  beforeEach(() => {
    queue = new InMemoryUtteranceQueue();
    httpServer = new HttpServer(queue, 3001);
    // Access the express app through the private property for testing
    app = (httpServer as any).app;
  });

  describe('POST /api/potential-utterances', () => {
    it('should add a potential utterance to the queue', async () => {
      const response = await request(app)
        .post('/api/potential-utterances')
        .send({ text: 'Hello world' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.utterance.text).toBe('Hello world');
      expect(response.body.utterance.status).toBe('pending');
      expect(response.body.utterance.id).toBeDefined();
      expect(response.body.utterance.timestamp).toBeDefined();

      // Verify it was added to the queue
      expect(queue.utterances).toHaveLength(1);
      expect(queue.utterances[0].text).toBe('Hello world');
    });

    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/potential-utterances')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Text is required');
      expect(queue.utterances).toHaveLength(0);
    });

    it('should return 400 if text is empty string', async () => {
      const response = await request(app)
        .post('/api/potential-utterances')  
        .send({ text: '' })
        .expect(400);

      expect(response.body.error).toBe('Text is required');
      expect(queue.utterances).toHaveLength(0);
    });

    it('should return 400 if text is only whitespace', async () => {
      const response = await request(app)
        .post('/api/potential-utterances')
        .send({ text: '   ' })
        .expect(400);

      expect(response.body.error).toBe('Text is required');
      expect(queue.utterances).toHaveLength(0);
    });
  });

  describe('GET /api/utterances', () => {
    it('should return empty array when no utterances exist', async () => {
      const response = await request(app)
        .get('/api/utterances')
        .expect(200);

      expect(response.body.utterances).toEqual([]);
    });

    it('should return recent utterances', async () => {
      // Add some utterances directly to the queue
      const utterance1 = queue.add('First utterance');
      const utterance2 = queue.add('Second utterance');

      const response = await request(app)
        .get('/api/utterances')
        .expect(200);

      expect(response.body.utterances).toHaveLength(2);
      expect(response.body.utterances[0].text).toBe('Second utterance');
      expect(response.body.utterances[1].text).toBe('First utterance');
    });

    it('should respect the limit query parameter', async () => {
      // Add 5 utterances
      for (let i = 1; i <= 5; i++) {
        queue.add(`Utterance ${i}`);
      }

      const response = await request(app)
        .get('/api/utterances?limit=3')
        .expect(200);

      expect(response.body.utterances).toHaveLength(3);
      expect(response.body.utterances[0].text).toBe('Utterance 5');
      expect(response.body.utterances[2].text).toBe('Utterance 3');
    });
  });

  describe('GET /api/utterances/status', () => {
    it('should return status with all counts as zero when empty', async () => {
      const response = await request(app)
        .get('/api/utterances/status')
        .expect(200);

      expect(response.body).toEqual({
        total: 0,
        pending: 0,
        delivered: 0
      });
    });

    it('should return correct counts', async () => {
      // Add utterances with different statuses
      const utterance1 = queue.add('First');
      const utterance2 = queue.add('Second');
      const utterance3 = queue.add('Third');

      // Mark one as delivered
      queue.markDelivered(utterance2.id);

      const response = await request(app)
        .get('/api/utterances/status')
        .expect(200);

      expect(response.body).toEqual({
        total: 3,
        pending: 2,
        delivered: 1
      });
    });
  });

  describe('Integration: POST then GET', () => {
    it('should allow posting potential utterances and retrieving them', async () => {
      // Post a potential utterance
      await request(app)
        .post('/api/potential-utterances')
        .send({ text: 'Test integration' })
        .expect(200);

      // Retrieve it
      const response = await request(app)
        .get('/api/utterances')
        .expect(200);

      expect(response.body.utterances).toHaveLength(1);
      expect(response.body.utterances[0].text).toBe('Test integration');
      expect(response.body.utterances[0].status).toBe('pending');
    });
  });
});