// Shared AI provider logic for both local Express server and Vercel serverless functions.

export function loadProviders() {
  const providers = [];
  for (let i = 1; i <= 4; i++) {
    const suffix = i === 1 ? '' : `_${i}`;
    const provider = process.env[`AI_PROVIDER${suffix}`];
    const apiKey = process.env[`AI_API_KEY${suffix}`];
    if (provider && apiKey) {
      providers.push({
        name: provider,
        apiKey,
        model: process.env[`AI_MODEL${suffix}`] || null,
      });
    }
  }
  return providers;
}

function getProviderConfig(provider) {
  switch (provider.name) {
    case 'openrouter':
      return {
        url: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions',
        model: provider.model || 'meta-llama/llama-4-scout:free',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
      };
    case 'google':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${provider.model || 'gemini-2.0-flash'}:generateContent?key=${provider.apiKey}`,
        model: provider.model || 'gemini-2.0-flash',
        isGoogle: true,
        headers: { 'Content-Type': 'application/json' },
      };
    case 'groq':
      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: provider.model || 'llama-3.1-8b-instant',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
      };
    case 'cerebras':
      return {
        url: 'https://api.cerebras.ai/v1/chat/completions',
        model: provider.model || 'llama3.1-8b',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
      };
    case 'openai':
      return {
        url: process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
        model: provider.model || 'gpt-4o-mini',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
      };
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        model: provider.model || 'claude-sonnet-4-20250514',
        isAnthropic: true,
        headers: {
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      };
    default:
      return null;
  }
}

async function callProvider(provider, prompt) {
  const config = getProviderConfig(provider);
  if (!config) throw new Error(`Unknown provider: ${provider.name}`);

  let body;
  if (config.isGoogle) {
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: parseInt(process.env.MAX_TOKENS) || 2048,
      },
    });
  } else if (config.isAnthropic) {
    body = JSON.stringify({
      model: config.model,
      max_tokens: parseInt(process.env.MAX_TOKENS) || 2048,
      messages: [{ role: 'user', content: prompt }],
    });
  } else {
    body = JSON.stringify({
      model: config.model,
      max_tokens: parseInt(process.env.MAX_TOKENS) || 2048,
      messages: [
        { role: 'system', content: 'You are a professional career assistant specializing in writing cover letters.' },
        { role: 'user', content: prompt },
      ],
    });
  }

  const res = await fetch(config.url, {
    method: 'POST',
    headers: config.headers,
    body,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${provider.name} (${res.status}): ${errorText}`);
  }

  const data = await res.json();

  if (config.isGoogle) return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (config.isAnthropic) return data.content?.[0]?.text || '';
  return data.choices?.[0]?.message?.content || '';
}

export function buildPrompt({ resumes, jobDescription, language, tone }) {
  const lang = language || 'English';
  const toneValue = tone || 'professional';

  const resumeJson = resumes
    .map((r, i) => `--- Resume ${i + 1} ---\n${JSON.stringify(r)}`)
    .join('\n\n')
    .slice(0, 8000);

  return `You are a senior IT career coach who writes strong, concise cover letters that get interviews.
Write entirely in ${lang}. Tone: ${toneValue} (formal = very formal administrative style, professional = standard professional, dynamic = energetic and modern).

STRICT RULES:
- Total length: 150-250 words maximum. Be concise and impactful.
- Do NOT copy-paste from the resume. Rephrase and focus on IMPACT.
- Do NOT use generic filler like "I am passionate, motivated, hardworking". Every sentence must carry value.
- Do NOT invent experience that is not in the resume.
- Focus on: Skills + Results + Technologies used + Business value.
- Position the candidate as someone who SOLVES REAL PROBLEMS, not just codes.

STRUCTURE (follow this exactly):

1. HEADER BLOCK
   - Candidate name, email, phone (from resume basics)
   - Today's date (formatted for ${lang})
   - Company name (from JD if available)

2. SUBJECT LINE
   "Subject: Application for the position of [job title inferred from JD]"
   (Adapt format to ${lang}, e.g. "Objet :" in French)

3. OPENING PARAGRAPH (3-4 lines max)
   - Mention the exact position
   - Show genuine interest
   - Add 1 strong value proposition (years of experience + key tech stack)

4. MAIN PARAGRAPH (Skills + Experience + Impact)
   - Highlight 2-3 concrete achievements from the resume that match the JD
   - Mention specific technologies used
   - Focus on real results: what you built, improved, or solved

5. SECOND PARAGRAPH (Why THIS Company)
   - Show you understand what the company does (from the JD)
   - Align your skills with their specific needs
   - Keep it short: 2-3 sentences

6. CLOSING (Call to Action)
   - Simple and confident: express interest in discussing contribution to the team

7. SIGNATURE
   - Appropriate closing salutation in ${lang}
   - Candidate full name

RESUME JSON:
${resumeJson}

JOB DESCRIPTION:
${jobDescription}

Respond ONLY with the letter text. No JSON, no markdown fences, no explanations.`;
}

export async function generateWithFallback(payload) {
  const providers = loadProviders();
  const prompt = buildPrompt(payload);

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`Trying provider: ${provider.name}`);
      const text = await callProvider(provider, prompt);
      if (text) return { text, provider: provider.name };
    } catch (err) {
      console.error(`Provider ${provider.name} failed:`, err.message);
      lastError = err;
    }
  }
  throw new Error(lastError?.message || 'All AI providers failed.');
}
