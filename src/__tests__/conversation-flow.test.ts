import request from 'supertest';
import express from 'express';

describe('conversation flow tracking', () => {
  let app: express.Application;
  let queue: any;
  let lastTimeoutTimestamp: Date | null;
  let lastToolUseTimestamp: Date | null;
  let lastSpeakTimestamp: Date | null;

  beforeEach(() => {
    // Reset state
    delete process.env.VOICE_RESPONSES_ENABLED;
    lastTimeoutTimestamp = null;
    lastToolUseTimestamp = null;
    lastSpeakTimestamp = null;
    
    // Mock queue
    queue = {
      utterances: []
    };

    // Create express app with endpoints
    app = express();
    app.use(express.json());

    // Pre-tool hook endpoint
    app.post('/api/hooks/pre-tool', (req, res) => {
      const voiceResponsesEnabled = process.env.VOICE_RESPONSES_ENABLED === 'true';

      // Check for pending utterances
      const pendingUtterances = queue.utterances.filter((u: any) => u.status === 'pending');
      if (pendingUtterances.length > 0) {
        res.json({
          decision: 'block',
          reason: `${pendingUtterances.length} pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.`
        });
        return;
      }

      // Check for delivered but unresponded utterances (when voice enabled)
      if (voiceResponsesEnabled) {
        const deliveredUtterances = queue.utterances.filter((u: any) => u.status === 'delivered');
        if (deliveredUtterances.length > 0) {
          res.json({
            decision: 'block',
            reason: `${deliveredUtterances.length} delivered utterance(s) require voice response. Please use the speak tool to respond before proceeding.`
          });
          return;
        }
      }

      // All checks passed - allow tool use
      lastToolUseTimestamp = new Date();
      res.json({
        decision: 'approve'
      });
    });

    // Pre-wait hook endpoint
    app.post('/api/hooks/pre-wait', (req, res) => {
      const voiceResponsesEnabled = process.env.VOICE_RESPONSES_ENABLED === 'true';

      // Check for pending utterances
      const pendingUtterances = queue.utterances.filter((u: any) => u.status === 'pending');
      if (pendingUtterances.length > 0) {
        res.json({
          decision: 'block',
          reason: `${pendingUtterances.length} pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.`
        });
        return;
      }

      // Check for delivered but unresponded utterances (when voice enabled)
      if (voiceResponsesEnabled) {
        const deliveredUtterances = queue.utterances.filter((u: any) => u.status === 'delivered');
        if (deliveredUtterances.length > 0) {
          res.json({
            decision: 'block',
            reason: `${deliveredUtterances.length} delivered utterance(s) require voice response. Please use the speak tool to respond before proceeding.`
          });
          return;
        }
      }

      // Check if spoken since last tool use (when voice enabled)
      if (voiceResponsesEnabled && lastToolUseTimestamp && 
          (!lastSpeakTimestamp || lastSpeakTimestamp < lastToolUseTimestamp)) {
        res.json({
          decision: 'block',
          reason: 'Assistant must speak after using tools. Please use the speak tool to respond before waiting for utterances.'
        });
        return;
      }

      // All checks passed - allow wait_for_utterance
      res.json({
        decision: 'approve'
      });
    });

    // Stop hook endpoint
    app.post('/api/hooks/stop', (req, res) => {
      const voiceResponsesEnabled = process.env.VOICE_RESPONSES_ENABLED === 'true';

      // Check for pending utterances
      const pendingUtterances = queue.utterances.filter((u: any) => u.status === 'pending');
      if (pendingUtterances.length > 0) {
        res.json({
          decision: 'block',
          reason: `${pendingUtterances.length} pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.`
        });
        return;
      }

      // Check for delivered but unresponded utterances (when voice enabled)
      if (voiceResponsesEnabled) {
        const deliveredUtterances = queue.utterances.filter((u: any) => u.status === 'delivered');
        if (deliveredUtterances.length > 0) {
          res.json({
            decision: 'block',
            reason: `${deliveredUtterances.length} delivered utterance(s) require voice response. Please use the speak tool to respond before proceeding.`
          });
          return;
        }
      }

      // Check if spoken since last tool use (when voice enabled)
      if (voiceResponsesEnabled && lastToolUseTimestamp && 
          (!lastSpeakTimestamp || lastSpeakTimestamp < lastToolUseTimestamp)) {
        res.json({
          decision: 'block',
          reason: 'Assistant must speak after using tools. Please use the speak tool to respond before proceeding.'
        });
        return;
      }

      // Check if we should wait for utterances
      const shouldWait = !lastTimeoutTimestamp ||
        queue.utterances.some((u: any) => u.timestamp > lastTimeoutTimestamp!);

      if (shouldWait) {
        res.json({
          decision: 'block',
          reason: 'Assistant tried to end its response. Stopping is not allowed without first checking for voice input. Assistant should now use wait_for_utterance to check for voice input'
        });
        return;
      }

      // All checks passed - allow stop
      res.json({
        decision: 'approve',
        reason: 'No utterances since last timeout'
      });
    });

    // Mock speak endpoint
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

      // Track that speak was called
      lastSpeakTimestamp = new Date();

      res.json({
        success: true,
        message: 'Text spoken successfully',
        respondedCount: deliveredUtterances.length
      });
    });

    // Mock clear utterances endpoint
    app.delete('/api/utterances', (req, res) => {
      const clearedCount = queue.utterances.length;
      queue.utterances = [];
      
      // Reset timeout timestamp when clearing queue
      lastTimeoutTimestamp = null;

      res.json({
        success: true,
        message: `Cleared ${clearedCount} utterances`,
        clearedCount
      });
    });
  });

  describe('tool usage tracking', () => {
    it('should track tool use timestamp when tools are approved', async () => {
      expect(lastToolUseTimestamp).toBeNull();

      const response = await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      expect(response.body).toEqual({ decision: 'approve' });
      expect(lastToolUseTimestamp).not.toBeNull();
      expect(lastToolUseTimestamp).toBeInstanceOf(Date);
    });

    it('should track speak timestamp when speak is called', async () => {
      expect(lastSpeakTimestamp).toBeNull();

      const response = await request(app)
        .post('/api/speak')
        .send({ text: 'Hello' });

      expect(response.status).toBe(200);
      expect(lastSpeakTimestamp).not.toBeNull();
      expect(lastSpeakTimestamp).toBeInstanceOf(Date);
    });
  });

  describe('pre-wait hook with voice responses enabled', () => {
    beforeEach(() => {
      process.env.VOICE_RESPONSES_ENABLED = 'true';
    });

    it('should block wait_for_utterance when not spoken after tool use', async () => {
      // Use a tool first
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Try to wait without speaking
      const response = await request(app)
        .post('/api/hooks/pre-wait')
        .send({});

      expect(response.body).toEqual({
        decision: 'block',
        reason: 'Assistant must speak after using tools. Please use the speak tool to respond before waiting for utterances.'
      });
    });

    it('should allow wait_for_utterance after speaking', async () => {
      // Use a tool
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Speak
      await request(app)
        .post('/api/speak')
        .send({ text: 'Response to tool action' });

      // Now wait should be allowed
      const response = await request(app)
        .post('/api/hooks/pre-wait')
        .send({});

      expect(response.body).toEqual({ decision: 'approve' });
    });

    it('should allow wait_for_utterance when no tool was used', async () => {
      const response = await request(app)
        .post('/api/hooks/pre-wait')
        .send({});

      expect(response.body).toEqual({ decision: 'approve' });
    });

    it('should block for pending utterances first', async () => {
      queue.utterances.push({
        id: '1',
        text: 'Pending',
        timestamp: new Date(),
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/hooks/pre-wait')
        .send({});

      expect(response.body).toEqual({
        decision: 'block',
        reason: '1 pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.'
      });
    });

    it('should block for delivered utterances before tool use check', async () => {
      // Use a tool
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Add delivered utterance
      queue.utterances.push({
        id: '1',
        text: 'Delivered',
        timestamp: new Date(),
        status: 'delivered'
      });

      const response = await request(app)
        .post('/api/hooks/pre-wait')
        .send({});

      expect(response.body).toEqual({
        decision: 'block',
        reason: '1 delivered utterance(s) require voice response. Please use the speak tool to respond before proceeding.'
      });
    });
  });

  describe('stop hook with voice responses enabled', () => {
    beforeEach(() => {
      process.env.VOICE_RESPONSES_ENABLED = 'true';
    });

    it('should block stop when not spoken after tool use', async () => {
      // Use a tool first
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Try to stop without speaking
      const response = await request(app)
        .post('/api/hooks/stop')
        .send({});

      expect(response.body).toEqual({
        decision: 'block',
        reason: 'Assistant must speak after using tools. Please use the speak tool to respond before proceeding.'
      });
    });

    it('should check for wait requirement after speak check', async () => {
      // Use a tool
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Speak
      await request(app)
        .post('/api/speak')
        .send({ text: 'Response' });

      // Now stop should check for wait requirement
      const response = await request(app)
        .post('/api/hooks/stop')
        .send({});

      expect(response.body).toEqual({
        decision: 'block',
        reason: 'Assistant tried to end its response. Stopping is not allowed without first checking for voice input. Assistant should now use wait_for_utterance to check for voice input'
      });
    });

    it('should allow stop when all conditions are met', async () => {
      // Use a tool
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Speak
      await request(app)
        .post('/api/speak')
        .send({ text: 'Response' });

      // Set timeout timestamp to simulate wait completion
      lastTimeoutTimestamp = new Date();

      const response = await request(app)
        .post('/api/hooks/stop')
        .send({});

      expect(response.body).toEqual({
        decision: 'approve',
        reason: 'No utterances since last timeout'
      });
    });
  });

  describe('pre-wait hook with voice responses disabled', () => {
    it('should not enforce speak-after-tool-use when voice disabled', async () => {
      // Use a tool
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Should allow wait without speaking
      const response = await request(app)
        .post('/api/hooks/pre-wait')
        .send({});

      expect(response.body).toEqual({ decision: 'approve' });
    });

    it('should not check for delivered utterances when voice disabled', async () => {
      queue.utterances.push({
        id: '1',
        text: 'Delivered',
        timestamp: new Date(),
        status: 'delivered'
      });

      const response = await request(app)
        .post('/api/hooks/pre-wait')
        .send({});

      expect(response.body).toEqual({ decision: 'approve' });
    });
  });

  describe('queue clearing and stop hook interaction', () => {
    it('should reset lastTimeoutTimestamp when clearing queue', async () => {
      // Simulate a timeout
      lastTimeoutTimestamp = new Date();
      
      // Clear the queue
      const clearResponse = await request(app)
        .delete('/api/utterances')
        .send({});

      expect(clearResponse.status).toBe(200);
      expect(lastTimeoutTimestamp).toBeNull();
    });

    it('should block stop after clearing queue and adding new utterances', async () => {
      // Use a tool
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Speak
      await request(app)
        .post('/api/speak')
        .send({ text: 'Response' });

      // Simulate a timeout
      lastTimeoutTimestamp = new Date();

      // Stop should be allowed initially
      let response = await request(app)
        .post('/api/hooks/stop')
        .send({});

      expect(response.body.decision).toBe('approve');

      // Clear the queue
      await request(app)
        .delete('/api/utterances')
        .send({});

      // Add new utterance after clearing
      queue.utterances.push({
        id: '1',
        text: 'New utterance after clear',
        timestamp: new Date(),
        status: 'pending'
      });

      // Stop should now be blocked due to pending utterance
      response = await request(app)
        .post('/api/hooks/stop')
        .send({});

      expect(response.body).toEqual({
        decision: 'block',
        reason: '1 pending utterance(s) must be dequeued first. Please use dequeue_utterances to process them.'
      });
    });

    it('should require wait_for_utterance after clearing queue even without pending utterances', async () => {
      // Use a tool
      await request(app)
        .post('/api/hooks/pre-tool')
        .send({});

      // Speak
      await request(app)
        .post('/api/speak')
        .send({ text: 'Response' });

      // Simulate a timeout
      lastTimeoutTimestamp = new Date();

      // Clear the queue (resets lastTimeoutTimestamp)
      await request(app)
        .delete('/api/utterances')
        .send({});

      // Stop should be blocked because lastTimeoutTimestamp is null
      const response = await request(app)
        .post('/api/hooks/stop')
        .send({});

      expect(response.body).toEqual({
        decision: 'block',
        reason: 'Assistant tried to end its response. Stopping is not allowed without first checking for voice input. Assistant should now use wait_for_utterance to check for voice input'
      });
    });
  });
});