import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { InMemoryUtteranceQueue } from './utterance-queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HttpServer {
  private app: express.Application;
  private utteranceQueue: InMemoryUtteranceQueue;
  private port: number;

  constructor(utteranceQueue: InMemoryUtteranceQueue, port: number = 5111) {
    this.utteranceQueue = utteranceQueue;
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '..', 'public')));
  }

  private setupRoutes() {
    // API Routes
    this.app.post('/api/potential-utterances', (req: express.Request, res: express.Response) => {
      const { text, timestamp } = req.body;
      
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      const parsedTimestamp = timestamp ? new Date(timestamp) : undefined;
      const utterance = this.utteranceQueue.add(text, parsedTimestamp);
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

    this.app.get('/api/utterances', (req: express.Request, res: express.Response) => {
      const limit = parseInt(req.query.limit as string) || 10;
      const utterances = this.utteranceQueue.getRecent(limit);
      
      res.json({
        utterances: utterances.map(u => ({
          id: u.id,
          text: u.text,
          timestamp: u.timestamp,
          status: u.status,
        })),
      });
    });

    this.app.get('/api/utterances/status', (req: express.Request, res: express.Response) => {
      const total = this.utteranceQueue.utterances.length;
      const pending = this.utteranceQueue.utterances.filter(u => u.status === 'pending').length;
      const delivered = this.utteranceQueue.utterances.filter(u => u.status === 'delivered').length;

      res.json({
        total,
        pending,
        delivered,
      });
    });

    // Serve the browser client
    this.app.get('/', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`HTTP Server running on http://localhost:${this.port}`);
        resolve();
      });
    });
  }
}