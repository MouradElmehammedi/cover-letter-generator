# Product Requirements Document — AI Cover Letter Generator

## Overview

A single-page application that generates professional cover letters, short application emails, and visual job-fit analyses from uploaded JSON resumes and a pasted job description. Profiles are persisted in localStorage; AI calls are routed server-side to protect API keys.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES modules), Vite, TailwindCSS v4 |
| Backend (dev) | Express + Vite dev middleware (`server.js`) |
| Backend (prod) | Vercel Serverless Functions (`api/generate.js`) |
| AI | Multi-provider HTTP fallback chain |
| Export | `docx` + `file-saver` (client-side DOCX generation) |
| Storage | `localStorage` (profile persistence) |

---

## Features

### 1. Profile Management

- Upload one or more JSON resume files (Reactive Resume format).
- Each file is stored as a profile in `localStorage` under key `clg_profiles`.
- Display name is derived at render time from `basics.label` → `basics.headline` — never from a stale stored value.
- Profiles are shown as a radio-button list; one must be selected before generating.
- Profiles persist across sessions; no re-upload needed.

### 2. Cover Letter Generation

- Structured 7-section letter: header block, subject line, opening paragraph, main paragraph (skills + impact), company alignment paragraph, call to action, signature.
- Length: 150–250 words.
- Respects selected language and tone (formal / professional / dynamic).
- Output displayed in a card on the right column with a copy button and DOCX export.

### 3. Application Email Generation

- Short email strictly 90–110 words.
- Fixed template: subject line, greeting, experience sentence, JD-specific interest sentence, attachment mention, sign-off.
- Banned phrase list enforced in prompt to eliminate AI clichés.
- Every claim must be backed by resume data or the JD.
- Subject line format: `Application – [Job Title] – [Candidate Name]` or `[Job Title] | [Tech1] / [Tech2] | [N]+ Years – [Candidate Name]`.

### 4. Job-Fit Analysis

- Compact resume is sent (relevant fields only, sliced to 4 000 chars) to stay within provider TPM limits.
- AI returns strict JSON with schema:

```json
{
  "overallScore": 0-100,
  "skillMatch": 0-100,
  "experienceFit": 0-100,
  "summary": "recruiter-style brief",
  "matchedSkills": ["...", "..."],
  "missingSkills": ["...", "..."],
  "bonusSkills": ["...", "..."],
  "requiredSkills": [{ "name": "...", "matched": true }]
}
```

- Rendered as a visual dashboard: three SVG score rings (color-coded green ≥ 70 / amber ≥ 45 / red < 45), skill chips grouped by matched / missing / bonus, and a required-skills pill grid with pass/fail indicators.

### 5. DOCX Export

- Parses position and company from the generated text (subject line patterns in English and French).
- Filename format: `position_company_dd-mm-yyyy-HH-MM.docx`.
- Margin: 1 inch on all sides, Arial 12 pt.

---

## UI Layout

```
┌────────────────────────────────────────────────────────────┐
│  Header: logo + app title                                  │
├──────────────────────┬─────────────────────────────────────┤
│  LEFT COLUMN         │  RIGHT COLUMN                       │
│                      │                                     │
│  Profiles            │  Cover Letter card                  │
│  (radio list +       │  (output + copy + export)           │
│   upload drop zone)  │                                     │
│                      │  Email card                         │
│  Job Description     │  (output + copy)                    │
│  (textarea)          │                                     │
│                      │  Analysis card                      │
│  Actions             │  (score rings + skill chips)        │
│  Row 1: Language,    │                                     │
│          Tone        │                                     │
│  Row 2: [Cover       │                                     │
│  Letter] [Email]     │                                     │
│  [Analyze] [Clear]   │                                     │
└──────────────────────┴─────────────────────────────────────┘
```

---

## AI Provider Configuration

Providers are loaded from environment variables. Up to 4 providers are supported via numbered suffixes (`AI_PROVIDER`, `AI_PROVIDER_2`, …).

| Variable | Description |
|---|---|
| `AI_PROVIDER` | Provider name: `openrouter`, `google`, `groq`, `cerebras`, `openai`, `anthropic` |
| `AI_API_KEY` | API key for the provider |
| `AI_MODEL` | Optional model override |
| `AI_BASE_URL` | Optional base URL override (openrouter / openai) |
| `MAX_TOKENS` | Global max tokens override (default: 2048) |

Providers are tried in order; the first successful response is returned.

### Default Models

| Provider | Default Model |
|---|---|
| openrouter | `meta-llama/llama-4-scout:free` |
| google | `gemini-2.0-flash` |
| groq | `llama-3.1-8b-instant` |
| cerebras | `llama3.1-8b` |
| openai | `gpt-4o-mini` |
| anthropic | `claude-sonnet-4-20250514` |

### Per-Type Token Limits

| Generation type | Max tokens |
|---|---|
| cover-letter | 1 200 |
| email | 600 |
| analyze | 800 |

---

## API

### `POST /api/generate`

**Request body:**

```json
{
  "type": "cover-letter" | "email" | "analyze",
  "resumes": [ /* array of JSON resume objects */ ],
  "jobDescription": "string",
  "language": "English" | "French" | "...",
  "tone": "formal" | "professional" | "dynamic"
}
```

**Response (success):**

```json
{
  "text": "generated output string",
  "provider": "provider-name"
}
```

**Response (error):**

```json
{ "error": "message" }
```

---

## JSON Resume Schema (Reactive Resume format)

```
basics:
  name, headline (label), email, phone, summary, location
sections:
  skills.items[]:        name, keywords[], summary
  experience.items[]:    company, position, summary, date
  education.items[]:     institution, degree, date
  languages.items[]:     name, fluency
  certifications.items[]: name, issuer, date
```

---

## Deployment

### Local Development

```bash
npm run dev   # starts Express + Vite middleware on :3000
```

API keys are read from `.env` (never sent to the browser).

### Vercel Production

- `vite build` outputs to `dist/`.
- `api/generate.js` is deployed as a Serverless Function.
- Shared AI logic lives in `api/_ai.js` (underscore prefix — Vercel ignores it as a function endpoint).
- `vercel.json` rewrites all non-API routes to `index.html` for SPA routing.

```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

Environment variables must be set in the Vercel project dashboard.

---

## File Structure

```
cover-letter-generator/
├── api/
│   ├── _ai.js           # Shared AI logic (providers, prompts, fallback)
│   └── generate.js      # Vercel serverless function
├── public/
│   └── logo.jpg
├── src/
│   ├── api.js           # Fetch client (callGenerate per type)
│   ├── docx-export.js   # DOCX builder + smart filename
│   ├── main.js          # Entire frontend (profiles, UI, generation, analysis)
│   └── style.css        # Tailwind v4 + component classes
├── index.html
├── server.js            # Local dev Express server
├── vite.config.js
├── vercel.json
└── package.json
```

---

## Prompt Engineering Notes

- **Cover letter**: 7-section structure enforced; forbidden phrases ("passionate", "motivated") banned; claims must match resume data.
- **Email**: Hard word-count limit (90–110); banned phrase and pattern lists; the "interest" sentence must reference a specific JD product/challenge, never company culture.
- **Analyze**: Returns only strict JSON (no markdown fences); `compactResumeForAnalysis()` strips bios and photos to keep the request under provider TPM limits; scoring is honest — a score below 60 is expected when the gap is real.

---

## Known Constraints

- Free-tier providers have rate limits (TPM/RPM). The fallback chain mitigates this but does not eliminate it.
- Groq free tier: ~6 000 TPM. Analyze requests are kept compact to stay within limits.
- Google Gemini free quota can be exhausted during heavy use; handled by provider fallback.
- AI JSON output is parsed tolerantly (`extractJson` scans for first `{` to last `}`) to handle models that wrap JSON in prose.
