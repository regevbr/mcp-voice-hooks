import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { globalQueue } from './shared-queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const queue = globalQueue;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.post('/api/potential-utterances', (req, res) => {
  const { text, timestamp } = req.body;
  
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }
  
  const parsedTimestamp = timestamp ? new Date(timestamp) : undefined;
  const utterance = queue.add(text, parsedTimestamp);
  
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

app.get('/api/utterances', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const utterances = queue.getRecent(limit);
  
  res.json({
    utterances: utterances.map(u => ({
      id: u.id,
      text: u.text,
      timestamp: u.timestamp,
      status: u.status,
    })),
  });
});

app.get('/api/utterances/status', (req, res) => {
  const total = queue.utterances.length;
  const pending = queue.utterances.filter(u => u.status === 'pending').length;
  const delivered = queue.utterances.filter(u => u.status === 'delivered').length;

  res.json({
    total,
    pending,
    delivered,
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`HTTP Server running on http://localhost:${PORT}`);
  console.log('Voice Hooks POC ready!');
  console.log('- Open http://localhost:3000 in your browser');
  console.log('- Use `npm run mcp` in another terminal for MCP server');
});