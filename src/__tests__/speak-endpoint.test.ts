import request from 'supertest';
import express from 'express';

describe('Speak Endpoint Integration Tests', () => {
  let app: express.Application;
  let server: any;
  
  beforeEach(async () => {
    // Clear all cached modules to ensure fresh state
    jest.resetModules();
    
    // Import the app setup code
    const { setupApp } = await import('../test-utils/app-setup');
    app = setupApp();
    
    // Start server on random port
    server = app.listen(0);
  });
  
  afterEach((done) => {
    server.close(done);
  });
  
  describe('POST /api/speak', () => {
    it('should return 400 error when voice responses are disabled', async () => {
      // First disable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: false })
        .expect(200);
      
      // Then try to speak
      const response = await request(app)
        .post('/api/speak')
        .send({ text: 'Test message' })
        .expect(400);
      
      expect(response.body).toEqual({
        error: 'Voice responses are disabled',
        message: 'Cannot speak when voice responses are disabled'
      });
    });
    
    it('should return 200 success when voice responses are enabled', async () => {
      // First enable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: true })
        .expect(200);
      
      // Then try to speak
      const response = await request(app)
        .post('/api/speak')
        .send({ text: 'Test message' })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Text spoken successfully');
    });
    
    it('should return 400 error when text is missing', async () => {
      const response = await request(app)
        .post('/api/speak')
        .send({})
        .expect(400);
      
      expect(response.body).toEqual({
        error: 'Text is required'
      });
    });
    
    it('should return 400 error when text is empty', async () => {
      const response = await request(app)
        .post('/api/speak')
        .send({ text: '  ' })
        .expect(400);
      
      expect(response.body).toEqual({
        error: 'Text is required'
      });
    });
    
    it('should handle voice preference state changes correctly', async () => {
      // Enable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: true })
        .expect(200);
      
      // Speak should work
      await request(app)
        .post('/api/speak')
        .send({ text: 'First test' })
        .expect(200);
      
      // Disable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: false })
        .expect(200);
      
      // Speak should now fail
      await request(app)
        .post('/api/speak')
        .send({ text: 'Second test' })
        .expect(400);
      
      // Re-enable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: true })
        .expect(200);
      
      // Speak should work again
      await request(app)
        .post('/api/speak')
        .send({ text: 'Third test' })
        .expect(200);
    });
  });
  
  describe('POST /api/speak-system', () => {
    it('should always work regardless of voice response setting', async () => {
      // Disable voice responses
      await request(app)
        .post('/api/voice-preferences')
        .send({ voiceResponsesEnabled: false })
        .expect(200);
      
      // System speak should still work
      const response = await request(app)
        .post('/api/speak-system')
        .send({ text: 'System test message' })
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        message: 'Text spoken successfully via system voice'
      });
    });
    
    it('should return 400 error when text is missing', async () => {
      const response = await request(app)
        .post('/api/speak-system')
        .send({})
        .expect(400);
      
      expect(response.body).toEqual({
        error: 'Text is required'
      });
    });
    
    it('should accept custom rate parameter', async () => {
      const response = await request(app)
        .post('/api/speak-system')
        .send({ 
          text: 'Test with custom rate',
          rate: 300
        })
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        message: 'Text spoken successfully via system voice'
      });
    });
  });
});