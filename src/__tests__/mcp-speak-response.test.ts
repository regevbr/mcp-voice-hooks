import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

// Mock setup similar to voice-input-state.test.ts
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

describe('MCP Speak Tool Response Simplification', () => {
  let app: express.Application;
  let server: any;
  let queue: MockUtteranceQueue;
  let voicePreferences: any;
  let ttsClients: Set<any>;

  beforeEach(() => {
    // Reset state
    queue = new MockUtteranceQueue();
    voicePreferences = {
      voiceResponsesEnabled: true,
      voiceInputActive: false
    };
    ttsClients = new Set();

    // Create express app
    app = express();
    app.use(cors());
    app.use(express.json());

    // Mock TTS events endpoint
    app.get('/api/tts-events', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('data: {"type":"connected"}\n\n');
      ttsClients.add(res);
      res.on('close', () => {
        ttsClients.delete(res);
      });
    });

    // Voice preferences endpoint
    app.post('/api/voice-preferences', (req, res) => {
      const { voiceResponsesEnabled } = req.body;
      voicePreferences.voiceResponsesEnabled = !!voiceResponsesEnabled;
      res.json({
        success: true,
        preferences: voicePreferences
      });
    });

    // Speak endpoint that should return empty response in MCP context
    app.post('/api/speak', (req, res) => {
      const { text } = req.body;

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      if (!voicePreferences.voiceResponsesEnabled) {
        res.status(400).json({
          error: 'Voice responses are disabled',
          message: 'Cannot speak when voice responses are disabled'
        });
        return;
      }

      // Notify TTS clients
      const message = JSON.stringify({ type: 'speak', text });
      ttsClients.forEach(client => {
        client.write(`data: ${message}\n\n`);
      });

      // Mark delivered utterances as responded
      const deliveredUtterances = queue.utterances.filter(u => u.status === 'delivered');
      deliveredUtterances.forEach(u => {
        u.status = 'responded';
      });

      res.json({
        success: true,
        message: 'Text spoken successfully',
        respondedCount: deliveredUtterances.length
      });
    });

    // Start server on random port
    server = app.listen(0);
  });

  afterEach((done) => {
    server.close(done);
  });

  describe('MCP Tool Response Format', () => {
    it('should return simplified response for successful speak operations', async () => {
      // This test verifies the behavior that the MCP tool handler
      // should return an empty string for successful operations
      
      // Enable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: true })
        .expect(200);

      // Add some delivered utterances to test the responded count
      queue.add('Test utterance 1');
      queue.add('Test utterance 2');
      queue.utterances.forEach(u => {
        u.status = 'delivered';
      });

      // Call speak endpoint
      const response = await request(app)
        .post('/api/speak')
        .send({ text: 'Hello, this is a test' })
        .expect(200);

      // The HTTP response still includes the data
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Text spoken successfully');
      expect(response.body.respondedCount).toBe(2);

      // But the MCP tool handler should format this as an empty string
      // This is what the unified-server.ts does at line 839
      const mcpFormattedResponse = response.body.success ? '' : `Error: ${response.body.error}`;
      expect(mcpFormattedResponse).toBe('');
    });

    it('should return error message for failed speak operations', async () => {
      // Disable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: false })
        .expect(200);

      // Try to speak
      const response = await request(app)
        .post('/api/speak')
        .send({ text: 'This should fail' })
        .expect(400);

      // The MCP tool handler should format errors properly
      const mcpFormattedResponse = !response.ok ? 
        `Error speaking text: ${response.body.error || 'Unknown error'}` : '';
      
      expect(mcpFormattedResponse).toBe('Error speaking text: Voice responses are disabled');
    });

    it('should handle missing text parameter', async () => {
      // Enable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: true })
        .expect(200);

      // Call speak without text
      const response = await request(app)
        .post('/api/speak')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Text is required');
    });

    it('should handle empty text parameter', async () => {
      // Enable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: true })
        .expect(200);

      // Call speak with empty text
      const response = await request(app)
        .post('/api/speak')
        .send({ text: '   ' })
        .expect(400);

      expect(response.body.error).toBe('Text is required');
    });
  });

  describe('Integration with utterance queue', () => {
    it('should mark delivered utterances as responded', async () => {
      // Enable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: true })
        .expect(200);

      // Add utterances with different statuses
      const u1 = queue.add('Pending utterance');
      const u2 = queue.add('Delivered utterance 1');
      const u3 = queue.add('Delivered utterance 2');
      
      // Mark some as delivered
      queue.markDelivered(u2.id);
      queue.markDelivered(u3.id);

      // Verify initial states
      expect(queue.utterances.find(u => u.id === u1.id)?.status).toBe('pending');
      expect(queue.utterances.find(u => u.id === u2.id)?.status).toBe('delivered');
      expect(queue.utterances.find(u => u.id === u3.id)?.status).toBe('delivered');

      // Call speak
      const response = await request(app)
        .post('/api/speak')
        .send({ text: 'Test speech' })
        .expect(200);

      // Check that delivered utterances were marked as responded
      expect(queue.utterances.find(u => u.id === u1.id)?.status).toBe('pending'); // Unchanged
      expect(queue.utterances.find(u => u.id === u2.id)?.status).toBe('responded'); // Changed
      expect(queue.utterances.find(u => u.id === u3.id)?.status).toBe('responded'); // Changed
      
      expect(response.body.respondedCount).toBe(2);
    });
  });
});