# Product Requirements Document — Job Search Module
## AI Cover Letter Generator · Feature Extension v2.0

---

## Overview

This document extends the existing AI Cover Letter Generator with a **Job Search Module** — an in-app job discovery and application workflow. Users can search real job listings from LinkedIn, Indeed, Glassdoor, and 500+ other sources through a single aggregator API, view AI-powered fit scores for each listing, and trigger cover letter / email generation in one click — all without leaving the app.

The goal is to transform the tool from a *generation utility* into a **complete job application assistant**: find → score → generate → apply.

---

## Background & Motivation

The existing app solves half the problem: once a user has a job description, it generates great application documents. The missing half is *finding* that job description in the first place. Users currently copy-paste JDs from external sites, breaking their flow. Adding in-app search closes that loop.

**Target users:** Active job seekers who already use the cover letter generator and want to reduce friction between discovering a job and applying to it.

---

## Tech Stack Delta

The following additions are made on top of the existing stack. Nothing existing is removed.

| Layer | Addition | Notes |
|---|---|---|
| Job Data API | JSearch via RapidAPI | Aggregates LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google for Jobs; 30+ fields per listing; free tier 500 req/month |
| Backend | `api/jobs.js` (Vercel Serverless Function) | Proxies JSearch calls — API key never exposed to browser |
| Frontend | `src/jobs.js` module | Job search UI, result rendering, pagination state |
| Storage | `localStorage` key `clg_job_search_state` | Persists last search filters between sessions |
| Env Vars | `JSEARCH_API_KEY` | RapidAPI key for JSearch |

No changes to `api/_ai.js`, `api/generate.js`, `src/main.js` (beyond wiring the new tab), or any existing prompt logic.

---

## Features

### Feature 6 — Job Search Tab

A new **"Find Jobs"** tab is added to the app header alongside the existing generator view. It does not replace the current layout — it is a parallel view, accessible via tab navigation.

#### 6.1 Search Filter Form

Displayed at the top of the Find Jobs view. All filters are optional except the role field, which is pre-filled from the active profile.

| Filter | Type | Source / Options |
|---|---|---|
| Role / Keywords | Text input | Auto-filled from `basics.headline` of active profile |
| Country | Select dropdown | ISO country list; defaults to last-used value from localStorage |
| City / Region | Text input | Optional free text |
| Remote | Toggle (3-way) | Any / Remote only / On-site |
| Posted Within | Select | Any time / Past 24h / Past week / Past month |
| Employment Type | Multi-select chips | Full-time / Part-time / Contract / Internship |

A **Search** button triggers the query. A **Reset** link restores defaults. The form state is saved to `localStorage` on every search so the user's last context is restored on revisit.

#### 6.2 Job Results List

Displayed below the filter form as a vertical card list. Each card shows:

- Job title (bold)
- Company name + country flag emoji
- Location string (city, country) + remote badge if applicable
- Posted date (relative: "2 days ago")
- Employment type chip
- Short description snippet (first 200 chars of JD)
- Source attribution logo/label (LinkedIn, Indeed, etc. — derived from `job_publisher` field)
- **"Analyze Fit" button** (primary action)
- **"View Full JD"** toggle — expands to show complete job description inline
- **"Apply" button** — opens `job_apply_link` in new tab (shown only when link is available)

Pagination: 10 results per page, with a **Load More** button appending the next page. No full page reload.

Empty state: Friendly message with suggestions when no results are found ("Try broader keywords or remove the city filter").

Error state: Displays provider error with a Retry button.

#### 6.3 Analyze Fit — Triggered from Job Card

When the user clicks **"Analyze Fit"** on a job card:

1. The job's full description is extracted from the JSearch result (`job_description` field).
2. The active profile (must be selected — validated before search) is used as the resume.
3. A `POST /api/generate` call is made with `type: "analyze"`, the job description, and the active resume.
4. A compact analysis panel slides open **below the job card** (inline, not a modal) showing:
   - Overall Fit score ring (reuses existing SVG ring component)
   - Matched / Missing / Bonus skill chips (reuses existing chip components)
   - 2-sentence recruiter summary
   - **"Generate Cover Letter"** button
   - **"Generate Email"** button

The analysis panel for only one job is open at a time; opening another closes the previous one.

Scores are color-coded: green ≥ 70 / amber ≥ 45 / red < 45 (identical to existing analysis dashboard logic).

#### 6.4 Generate from Job Card

When the user clicks **"Generate Cover Letter"** or **"Generate Email"** from within an analysis panel:

1. The app switches to the **Generator tab** automatically.
2. The job description is injected into the JD textarea.
3. The cover letter or email generation is triggered immediately (no extra click needed).
4. The user lands on the output with the document ready to copy or export.

This is the core UX loop: **Find → Score → Generate → Copy/Export → Apply**.

#### 6.5 Apply Action

Each job card shows an **Apply** button when `job_apply_link` is present in the JSearch response. Clicking it opens the external application page in a new tab.

No email-apply feature in v2.0. That requires recruiter contact extraction, which is a v3 consideration.

---

## API

### New: `GET /api/jobs`

Proxies JSearch. All parameters are forwarded from the query string. The API key is injected server-side.

**Query parameters:**

| Param | Type | Maps to JSearch param | Description |
|---|---|---|---|
| `query` | string | `query` | Role keywords |
| `location` | string | `query` suffix ` in [location]` | City / country |
| `remote` | `any` / `remote` / `onsite` | `work_from_home` boolean | Remote filter |
| `datePosted` | `all` / `today` / `3days` / `week` / `month` | `date_posted` | Recency filter |
| `employmentType` | `FULLTIME,CONTRACTOR,...` | `employment_types` | Comma-separated |
| `page` | integer | `page` | Pagination, 1-indexed |
| `numPages` | integer (default: 1) | `num_pages` | Pages per request |

**Response (success):**

```json
{
  "jobs": [
    {
      "id": "string",
      "title": "string",
      "company": "string",
      "location": "string",
      "country": "string",
      "isRemote": true,
      "employmentType": "FULLTIME",
      "postedAt": "ISO date string",
      "description": "full job description text",
      "snippet": "first 200 chars",
      "applyLink": "URL or null",
      "publisher": "LinkedIn | Indeed | Glassdoor | ...",
      "salary": { "min": 0, "max": 0, "currency": "USD", "period": "YEARLY" } // nullable
    }
  ],
  "totalResults": 0,
  "page": 1
}
```

**Response (error):**

```json
{ "error": "message", "code": "RATE_LIMIT | INVALID_KEY | UPSTREAM_ERROR" }
```

**Rate limit handling:** If JSearch returns 429, `api/jobs.js` returns `{ error: "Rate limit reached. Try again in a moment.", code: "RATE_LIMIT" }` with HTTP 429. The frontend shows a non-dismissible banner and disables the Search button for 30 seconds.

---

## UI Layout — Updated

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: logo + app title    [ Generator ] [ Find Jobs ]  tabs   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GENERATOR TAB (existing — no change)                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FIND JOBS TAB (new)                                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Role: [Full Stack Developer ▾]  Country: [France ▾]   │     │
│  │  City: [________________]  Remote: [Any|Remote|On-site] │     │
│  │  Posted: [Past week ▾]  Type: [Full-time] [Contract]   │     │
│  │                                    [ Search ]  [Reset]  │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  10 results found · sorted by date                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Senior React Developer                    🇫🇷 France    │     │
│  │  Acme Corp · Paris, France · Full-time · 2 days ago     │     │
│  │  We are looking for a senior React developer to...      │     │
│  │  [View Full JD ▾]  [ Analyze Fit ]  [ Apply ↗ ]        │     │
│  ├─────────────────────────────────────────────────────────┤     │
│  │  ▼ FIT ANALYSIS (inline, when open)                     │     │
│  │    ●  82%     ●  Skills  ●  Experience                  │     │
│  │    ✓ React  ✓ TypeScript  ✗ GraphQL  + Docker(bonus)    │     │
│  │    Strong match. Missing GraphQL but bonus DevOps...    │     │
│  │    [ Generate Cover Letter ]  [ Generate Email ]        │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  ... (next job card) ...                                │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│                          [ Load More ]                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JSEARCH_API_KEY` | Yes | RapidAPI key with JSearch subscription |
| All existing vars | Unchanged | `AI_PROVIDER`, `AI_API_KEY`, etc. |

---

## File Structure Delta

```
cover-letter-generator/
├── api/
│   ├── _ai.js           # unchanged
│   ├── generate.js      # unchanged
│   └── jobs.js          # NEW — JSearch proxy serverless function
├── src/
│   ├── api.js           # add callJobSearch(params) function
│   ├── jobs.js          # NEW — job search UI module
│   ├── main.js          # add tab switching logic only
│   ├── docx-export.js   # unchanged
│   └── style.css        # add job card + analysis panel classes
```

---

## Data Flow Diagram

```
User fills filter form
        │
        ▼
src/jobs.js → callJobSearch(params)
        │
        ▼
GET /api/jobs?query=...&location=...
        │
        ▼
api/jobs.js (Vercel) → RapidAPI JSearch
        │
        ▼
Normalized job array → render job cards
        │
        ▼
User clicks "Analyze Fit"
        │
        ▼
Extract job.description → POST /api/generate (type: analyze)
        │
        ▼
api/generate.js → _ai.js fallback chain → AI provider
        │
        ▼
JSON analysis → inline panel rendered below card
        │
        ▼
User clicks "Generate Cover Letter" / "Generate Email"
        │
        ▼
Switch to Generator tab → inject JD → trigger generation
        │
        ▼
Output rendered → Copy / DOCX export / Apply ↗
```

---

## Token Budget for New Flow

No new token budget is required. The analysis triggered from a job card uses the same `analyze` type in `POST /api/generate` with the same 800-token limit and compactResumeForAnalysis() pre-processing as the existing flow.

---

## Known Constraints & Risks

| Constraint | Impact | Mitigation |
|---|---|---|
| JSearch free tier: 500 req/month | ~50 searches/month before cost | Show a usage counter in the UI; add `JSEARCH_QUOTA_WARNING` env var to set threshold |
| JSearch paid tier starts at $10/month | Cost if app is used heavily | Document in README; user provides their own RapidAPI key |
| `job_apply_link` not always present | Apply button hidden for some listings | Show "Apply on [publisher]" link using `job_google_link` as fallback |
| JSearch response time: 1–8s | Slow perceived search | Show skeleton loaders immediately; stream results as soon as first page returns |
| No Hiring.cafe API | Cannot integrate directly | Add a "Search on Hiring.cafe" deep-link button in the filter bar: `https://hiring.cafe/?q=[role]&l=[location]` — opens in new tab. Same for LinkedIn Jobs and Glassdoor as external shortcut links. |
| AI cost per "Analyze Fit" click | Each click = one AI call | Lazy evaluation only on explicit click; analysis result cached in memory for the session so re-opening the panel doesn't re-trigger the API |

---

## Out of Scope for v2.0

- Apply by email (requires recruiter contact extraction — v3)
- Saved jobs / application tracker (v3 — requires backend persistence)
- Salary negotiation assistant (future)
- Browser extension for one-click import from job boards (future)
- Hiring.cafe, Glassdoor, LinkedIn direct API integrations (blocked by ToS / no public API)

---

## Success Metrics

| Metric | Target |
|---|---|
| Search-to-generation rate | ≥ 40% of job searches result in at least one generation |
| Analyze Fit click rate | ≥ 60% of job cards viewed trigger an analysis |
| Apply button click rate | ≥ 25% of high-score (≥70) analyses result in Apply click |
| Time from search to generated cover letter | < 60 seconds |
