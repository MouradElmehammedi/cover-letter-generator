// Shared AI provider logic for both local Express server and Vercel serverless functions.

export function loadProviders() {
  const providers = [];
  for (let i = 1; i <= 10; i++) {
    const suffix = i === 1 ? '' : `_${i}`;
    const provider = process.env[`AI_PROVIDER${suffix}`];
    if (!provider) continue;
    const apiKey = process.env[`AI_API_KEY${suffix}`];
    // Ollama is self-hosted — no API key required
    if (provider !== 'ollama' && !apiKey) continue;
    providers.push({
      name: provider,
      apiKey: apiKey || null,
      model: process.env[`AI_MODEL${suffix}`] || null,
    });
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
    case 'ollama': {
      // Self-hosted Ollama exposes an OpenAI-compatible endpoint at /v1/chat/completions
      const base = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
      return {
        url: `${base}/v1/chat/completions`,
        model: provider.model || process.env.OLLAMA_MODEL || 'llama3.2',
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }
    default:
      return null;
  }
}

async function callProvider(provider, prompt, maxTokens) {
  const config = getProviderConfig(provider);
  if (!config) throw new Error(`Unknown provider: ${provider.name}`);

  const tokens = maxTokens || parseInt(process.env.MAX_TOKENS) || 2048;

  let body;
  if (config.isGoogle) {
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: tokens },
    });
  } else if (config.isAnthropic) {
    body = JSON.stringify({
      model: config.model,
      max_tokens: tokens,
      messages: [{ role: 'user', content: prompt }],
    });
  } else {
    body = JSON.stringify({
      model: config.model,
      max_tokens: tokens,
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

function compactResumeForAnalysis(r) {
  // Pull only the fields we need to score fit — drops bios, photos, full descriptions, etc.
  const basics = r.basics || {};
  const sections = r.sections || {};
  const pickItems = (key) => (sections[key]?.items || []).map((it) => ({
    name: it.name || it.title || it.position || it.company || it.institution,
    keywords: it.keywords,
    summary: (it.summary || '').slice(0, 200),
    date: it.date,
  }));
  return {
    name: basics.name,
    headline: basics.headline || basics.label,
    summary: (basics.summary || '').slice(0, 400),
    location: basics.location,
    skills: pickItems('skills'),
    experience: pickItems('experience'),
    education: pickItems('education'),
    languages: pickItems('languages'),
    certifications: pickItems('certifications'),
  };
}

export function buildAnalyzePrompt({ resumes, jobDescription, language }) {
  const lang = language || 'English';

  const resumeJson = resumes
    .map((r, i) => `--- Resume ${i + 1} ---\n${JSON.stringify(compactResumeForAnalysis(r))}`)
    .join('\n\n')
    .slice(0, 4000);

  return `You are a senior tech recruiter. Score the fit between a candidate's profile and a job description, and return STRICT JSON.

Return ONLY a JSON object — no markdown fences, no code blocks, no preamble, no explanation. The first character of your response MUST be "{" and the last MUST be "}".

JSON SCHEMA (use exactly these keys):

{
  "overallScore": <integer 0-100>,
  "skillMatch": <integer 0-100>,
  "experienceFit": <integer 0-100>,
  "summary": "<2-3 sentence summary in ${lang} — name the candidate, the role, the biggest match and the biggest gap. No filler clichés.>",
  "matchedSkills": ["<skill from JD that the resume clearly has>", ...],
  "missingSkills": ["<skill clearly required by JD but absent from resume>", ...],
  "bonusSkills": ["<skill in resume that adds value but is not in the JD>", ...],
  "requiredSkills": [
    { "name": "<skill name from JD>", "matched": true|false },
    ...
  ]
}

SCORING RULES:
- "skillMatch": % of JD-required skills that the resume covers.
- "experienceFit": match between required years/seniority and candidate's actual years.
- "overallScore": weighted blend (skillMatch 0.5 + experienceFit 0.3 + softFactors 0.2).
- Be HONEST — do not inflate. A score below 60 is fine if the gap is real.

CONTENT RULES:
- Every skill name must appear in either the resume or the job description. NEVER invent skills.
- Skill names: short, scannable phrases (max 5-6 words). Use the exact wording from the JD when possible.
- "matchedSkills" max 6, "missingSkills" max 6, "bonusSkills" max 6.
- "requiredSkills" lists every required skill explicitly mentioned in the JD with a true/false flag.
- "summary" must be in ${lang}, written like a recruiter brief — concrete, no clichés ("passionate", "dedicated", "synergy", etc.).

DATA:

RESUME JSON:
${resumeJson}

JOB DESCRIPTION:
${jobDescription}

Output the JSON object now.`;
}

export function buildEmailPrompt({ resumes, jobDescription, language, tone }) {
  const lang = language || 'English';
  const toneValue = tone || 'professional';

  const resumeJson = resumes
    .map((r, i) => `--- Resume ${i + 1} ---\n${JSON.stringify(r)}`)
    .join('\n\n')
    .slice(0, 8000);

  return `You are a senior IT career coach who writes short, credible application emails that HR actually reads.
Write entirely in ${lang}. Tone: ${toneValue} (formal = very formal, professional = standard professional, dynamic = energetic and modern).

HARD RULES (violations disqualify the email):
- Total body length: STRICTLY 90–110 WORDS. Count them. Shorter = better.
- Sound like a human engineer wrote it in 3 minutes — not like AI.
- BANNED phrases (do not use, in any language): "passionate", "dedicated", "drawn to", "vision", "culture", "values", "innovation", "teamwork", "growth", "robust and scalable", "cutting-edge", "state-of-the-art", "synergy", "leverage", "dynamic environment", "thrive", "well-rounded", "seamless", "world-class".
- BANNED patterns: stacking 3+ adjectives ("robust, scalable, user-friendly"), listing 3+ technologies in one sentence ("React, Next.js, TypeScript, Node.js, GraphQL"), generic task categories ("API development", "database optimization", "CI/CD pipelines").
- Each technology should be mentioned ONCE total, not repeated.
- Every specific claim MUST be backed by the resume or JD. No invention.
- Prefer concrete numbers and outcomes from the resume (e.g. "cut API latency by 40%", "shipped a billing service handling 2M requests/day"). If the resume has metrics, USE THEM. If not, use a specific deliverable name from the resume.
- The "particularly interested" sentence MUST reference a specific product, technical challenge, or domain pulled from the JD (e.g. "your video streaming platform", "the migration from monolith to microservices you mentioned"). NEVER mention company values or culture.
- No footer, no contact info block, no signature titles.

OUTPUT FORMAT (exactly this order, blank lines between blocks):

Line 1 — Subject line. Pick one of these formats (adapt to ${lang}):
   "Application – [Job Title] – [Candidate Name]"
   "[Job Title] | [Key Tech 1] / [Key Tech 2] | [N]+ Years – [Candidate Name]"

(blank line)

BODY TEMPLATE (match exactly, translated into ${lang}, every sentence short and direct):

Dear Hiring Manager,

I'm applying for the [Job Title] role at [Company Name].

I have [N] years of experience as a [field], working mainly with [Tech 1] and [Tech 2]. Recently I [ONE specific achievement or shipped project from the resume, with a metric if available].

I'm interested in this role because [ONE specific thing from the JD — a product, a technical challenge, or a domain — referenced concretely].

My CV and cover letter are attached.

Happy to discuss how I can help your team.

Best regards,
[Candidate Full Name]

DATA:

RESUME JSON:
${resumeJson}

JOB DESCRIPTION:
${jobDescription}

Respond ONLY with the email (subject on line 1, blank line, then the body above with placeholders filled in). No markdown fences, no JSON, no extra explanation. Verify the body is 90–110 words before answering.`;
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
  let prompt;
  let maxTokens;
  if (payload.type === 'email') {
    prompt = buildEmailPrompt(payload);
    maxTokens = 600;
  } else if (payload.type === 'analyze') {
    prompt = buildAnalyzePrompt(payload);
    maxTokens = 800;
  } else {
    prompt = buildPrompt(payload);
    maxTokens = 1200;
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`Trying provider: ${provider.name}`);
      const text = await callProvider(provider, prompt, maxTokens);
      if (text) return { text, provider: provider.name };
    } catch (err) {
      console.error(`Provider ${provider.name} failed:`, err.message);
      lastError = err;
    }
  }
  throw new Error(lastError?.message || 'All AI providers failed.');
}
