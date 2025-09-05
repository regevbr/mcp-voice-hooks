import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock the execAsync for tests
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    // Simulate successful command execution
    callback(null, { stdout: '', stderr: '' });
  })
}));

// Voice preferences (controlled by browser)
let voicePreferences = {
  voiceResponsesEnabled: false
};

// Server-Sent Events clients
const ttsClients = new Set<Response>();

// Helper function to notify all connected TTS clients
function notifyTTSClients(text: string) {
  const message = JSON.stringify({ type: 'speak', text });
  ttsClients.forEach(client => {
    client.write(`data: ${message}\n\n`);
  });
}

export function setupApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API for voice preferences
  app.post('/api/voice-preferences', (req: Request, res: Response) => {
    const { voiceResponsesEnabled } = req.body;

    // Update preferences
    voicePreferences.voiceResponsesEnabled = !!voiceResponsesEnabled;

    res.json({
      success: true,
      preferences: voicePreferences
    });
  });

  // API for text-to-speech
  app.post('/api/speak', async (req: Request, res: Response) => {
    const { text } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    // Check if voice responses are enabled
    if (!voicePreferences.voiceResponsesEnabled) {
      res.status(400).json({
        error: 'Voice responses are disabled',
        message: 'Cannot speak when voice responses are disabled'
      });
      return;
    }

    try {
      // Always notify browser clients - they decide how to speak
      notifyTTSClients(text);

      res.json({
        success: true,
        message: 'Text spoken successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to speak text',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API for system text-to-speech (always uses Mac say command)
  app.post('/api/speak-system', async (req: Request, res: Response) => {
    const { text, rate = 150 } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    try {
      // Execute text-to-speech using macOS say command
      // Note: Mac say command doesn't support volume control
      await execAsync(`say -r ${rate} "${text.replace(/"/g, '\\"')}"`);

      res.json({
        success: true,
        message: 'Text spoken successfully via system voice'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to speak text via system voice',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Server-Sent Events for TTS notifications
  app.get('/api/tts-events', (_req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial connection message
    res.write('data: {"type":"connected"}\n\n');

    // Add client to set
    ttsClients.add(res);

    // Remove client on disconnect
    res.on('close', () => {
      ttsClients.delete(res);
    });
  });

  return app;
}