import { generateWithFallback } from './_ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { resumes, jobDescription, language, tone, type } = req.body;

    if (!resumes?.length || !jobDescription) {
      return res.status(400).json({ error: 'Resumes and job description are required.' });
    }

    const result = await generateWithFallback({ resumes, jobDescription, language, tone, type });
    res.status(200).json(result);
  } catch (err) {
    console.error('Generate API error:', err);
    res.status(502).json({ error: 'All AI providers failed.', details: err.message });
  }
}
