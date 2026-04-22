import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { generateWithFallback } from './api/_ai.js';
import jobsHandler from './api/jobs.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.post('/api/generate', async (req, res) => {
  try {
    const { resumes, jobDescription, language, tone, type } = req.body;
    if (!resumes?.length || !jobDescription) {
      return res.status(400).json({ error: 'Resumes and job description are required.' });
    }
    const result = await generateWithFallback({ resumes, jobDescription, language, tone, type });
    res.json(result);
  } catch (err) {
    console.error('Generate error:', err);
    res.status(502).json({ error: 'All AI providers failed.', details: err.message });
  }
});

app.get('/api/jobs', (req, res) => jobsHandler(req, res));

const vite = await createViteServer({ server: { middlewareMode: true } });
app.use(vite.middlewares);

const port = process.env.PORT || 5173;
app.listen(port, () => {
  console.log(`\n  Server running at http://localhost:${port}\n`);
});
