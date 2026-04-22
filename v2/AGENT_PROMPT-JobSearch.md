# Agent Prompt — Job Search Module Implementation
## AI Cover Letter Generator v2.0

---

## Context

You are implementing a **Job Search Module** on top of an existing, deployed Vite + Vanilla JS + TailwindCSS v4 application. The app is deployed on Vercel. The existing codebase works as follows:

- `api/generate.js` — Vercel Serverless Function that accepts `POST /api/generate` and delegates to `api/_ai.js`
- `api/_ai.js` — Multi-provider AI fallback chain (openrouter, google, groq, cerebras, openai, anthropic)
- `src/main.js` — Entire frontend: profile management, JD textarea, generation triggers, output rendering
- `src/api.js` — Thin fetch client: `callGenerate(type, payload)`
- `src/style.css` — TailwindCSS v4 + component utility classes
- `src/docx-export.js` — Client-side DOCX builder

**Do not modify `api/_ai.js` or `api/generate.js` in any way.** Do not change the existing generator UI behavior. You are adding new files and making minimal additions to existing files.

---

## Your Task

Implement the following files in order:

1. `api/jobs.js` — New Vercel serverless function (JSearch proxy)
2. `src/jobs.js` — New frontend module (job search UI + state)
3. `src/api.js` — Add `callJobSearch(params)` to existing file (append only)
4. `src/main.js` — Add tab switching logic (append only, do not touch existing code)
5. `src/style.css` — Add job card and analysis panel classes (append only)

---

## File 1: `api/jobs.js`

This is a Vercel Serverless Function that proxies requests to the JSearch API on RapidAPI.

**Requirements:**

- Export a default async handler `(req, res)`
- Read `JSEARCH_API_KEY` from `process.env`
- Accept GET requests only; return 405 for other methods
- Extract these query params from `req.query`: `query`, `location`, `remote`, `datePosted`, `employmentType`, `page` (default 1), `numPages` (default 1)
- Build the JSearch request URL: `https://jsearch.p.rapidapi.com/search`
- JSearch query params mapping:
  - `query` → append ` in [location]` if location is provided, e.g. `"React Developer in Paris, France"`
  - `remote` → if `"remote"`: set `work_from_home=true`; if `"onsite"`: set `work_from_home=false`; if `"any"` or absent: omit param
  - `datePosted` → map: `"today"→"today"`, `"3days"→"3days"`, `"week"→"week"`, `"month"→"month"`, `"all"→"all"` (default `"all"`)
  - `employmentType` → pass through as-is to `employment_types`
  - `page` → pass through as `page`
  - `num_pages` → pass through as `num_pages`
- Set request headers: `x-rapidapi-key: [JSEARCH_API_KEY]`, `x-rapidapi-host: jsearch.p.rapidapi.com`
- On success, normalize the JSearch response array into the following shape and return as JSON:

```json
{
  "jobs": [
    {
      "id": "job_id",
      "title": "job_title",
      "company": "employer_name",
      "location": "job_city + job_state + job_country joined",
      "country": "job_country",
      "isRemote": "job_is_remote boolean",
      "employmentType": "job_employment_type",
      "postedAt": "job_posted_at_datetime_utc",
      "description": "job_description",
      "snippet": "first 220 chars of job_description + ellipsis if truncated",
      "applyLink": "job_apply_link or null",
      "googleLink": "job_google_link",
      "publisher": "job_publisher",
      "salary": {
        "min": "job_min_salary or null",
        "max": "job_max_salary or null",
        "currency": "job_salary_currency or null",
        "period": "job_salary_period or null"
      }
    }
  ],
  "totalResults": "number from data.length * estimated pages or data length",
  "page": "current page number"
}
```

- On upstream 429, return HTTP 429 with `{ "error": "Rate limit reached. Please wait a moment.", "code": "RATE_LIMIT" }`
- On missing API key, return HTTP 500 with `{ "error": "Job search API key not configured.", "code": "MISSING_KEY" }`
- On any other error, return HTTP 502 with `{ "error": "Job search unavailable.", "code": "UPSTREAM_ERROR" }`
- Set CORS headers identically to how the existing `api/generate.js` sets them

---

## File 2: `src/jobs.js`

This is the entire job search frontend module. It exports one function: `initJobSearch()`.

**State (module-level variables):**

```js
let currentPage = 1
let currentFilters = {}
let allJobs = []
let openAnalysisId = null  // job id whose analysis panel is open
let analysisCache = {}     // { [jobId]: analysisResult } — never re-fetch if cached
let isLoading = false
let isRateLimited = false
let rateLimitTimer = null
```

**`initJobSearch()` must:**

1. Inject the Find Jobs tab HTML into the DOM (see HTML spec below)
2. Restore last filter values from `localStorage` key `clg_job_search_state`
3. Pre-fill the Role input from `window.getActiveProfile()?.basics?.headline ?? ""`
4. Attach all event listeners

**HTML structure to inject** (use `innerHTML` on a container div, id `jobs-tab`):

```html
<div id="jobs-view" class="jobs-view hidden">

  <!-- Filter Bar -->
  <div class="jobs-filter-bar">
    <div class="jobs-filter-row">
      <input type="text" id="jf-role" placeholder="Role / Keywords" class="jobs-input" />
      <input type="text" id="jf-location" placeholder="City or Country" class="jobs-input" />
      <select id="jf-remote" class="jobs-select">
        <option value="any">Any location</option>
        <option value="remote">Remote only</option>
        <option value="onsite">On-site only</option>
      </select>
    </div>
    <div class="jobs-filter-row">
      <select id="jf-posted" class="jobs-select">
        <option value="all">Any time</option>
        <option value="today">Past 24 hours</option>
        <option value="3days">Past 3 days</option>
        <option value="week">Past week</option>
        <option value="month">Past month</option>
      </select>
      <div id="jf-type-chips" class="jobs-type-chips">
        <label><input type="checkbox" value="FULLTIME" checked /> Full-time</label>
        <label><input type="checkbox" value="PARTTIME" /> Part-time</label>
        <label><input type="checkbox" value="CONTRACTOR" /> Contract</label>
        <label><input type="checkbox" value="INTERN" /> Internship</label>
      </div>
      <button id="jf-search-btn" class="btn-primary">Search</button>
      <button id="jf-reset-btn" class="btn-ghost">Reset</button>
    </div>
  </div>

  <!-- Rate Limit Banner -->
  <div id="jf-ratelimit-banner" class="hidden jobs-ratelimit-banner">
    Rate limit reached. Search will re-enable in <span id="jf-ratelimit-countdown">30</span>s.
  </div>

  <!-- Results -->
  <div id="jf-results-meta" class="jobs-results-meta hidden"></div>
  <div id="jf-results-list" class="jobs-results-list"></div>
  <div id="jf-load-more-wrap" class="hidden jobs-load-more-wrap">
    <button id="jf-load-more" class="btn-secondary">Load More</button>
  </div>

</div>
```

**Job card HTML template** (function `renderJobCard(job)` → returns HTML string):

```html
<div class="job-card" data-job-id="[job.id]">
  <div class="job-card-header">
    <div class="job-card-title-block">
      <h3 class="job-card-title">[job.title]</h3>
      <span class="job-card-company">[job.company]</span>
    </div>
    <div class="job-card-meta">
      <span class="job-card-location">[countryFlag(job.country)] [job.location]</span>
      <span class="job-card-type chip">[job.employmentType formatted]</span>
      [if job.isRemote: <span class="chip chip-remote">Remote</span>]
      <span class="job-card-date">[relativeDate(job.postedAt)]</span>
      <span class="job-card-publisher">via [job.publisher]</span>
    </div>
  </div>
  <p class="job-card-snippet">[job.snippet]</p>
  <div class="job-card-actions">
    <button class="btn-ghost btn-sm jf-toggle-jd" data-job-id="[job.id]">View Full JD ▾</button>
    <button class="btn-primary btn-sm jf-analyze-btn" data-job-id="[job.id]">Analyze Fit</button>
    [if job.applyLink: <a class="btn-secondary btn-sm" href="[applyLink]" target="_blank" rel="noopener">Apply ↗</a>]
    [else if job.googleLink: <a class="btn-ghost btn-sm" href="[googleLink]" target="_blank" rel="noopener">View on Google Jobs ↗</a>]
  </div>
  <div class="job-card-full-jd hidden" data-job-id="[job.id]">
    <pre class="job-card-jd-text">[job.description]</pre>
  </div>
  <div class="job-card-analysis-panel hidden" data-job-id="[job.id]">
    <!-- populated by renderAnalysisPanel() -->
  </div>
</div>
```

**Analysis panel HTML template** (function `renderAnalysisPanel(analysis, jobId)` → returns HTML string):

```html
<div class="analysis-panel">
  <div class="analysis-scores">
    [SVG ring: analysis.overallScore, label "Overall"]
    [SVG ring: analysis.skillMatch, label "Skills"]
    [SVG ring: analysis.experienceFit, label "Experience"]
  </div>
  <p class="analysis-summary">[analysis.summary]</p>
  <div class="analysis-skills">
    <div class="skill-group">
      <span class="skill-group-label matched">✓ Matched</span>
      [analysis.matchedSkills.map(s => `<span class="chip chip-matched">${s}</span>`)]
    </div>
    <div class="skill-group">
      <span class="skill-group-label missing">✗ Missing</span>
      [analysis.missingSkills.map(s => `<span class="chip chip-missing">${s}</span>`)]
    </div>
    [if analysis.bonusSkills.length:
    <div class="skill-group">
      <span class="skill-group-label bonus">+ Bonus</span>
      [analysis.bonusSkills.map(s => `<span class="chip chip-bonus">${s}</span>`)]
    </div>]
  </div>
  <div class="analysis-actions">
    <button class="btn-primary jf-gen-coverletter" data-job-id="[jobId]">Generate Cover Letter</button>
    <button class="btn-secondary jf-gen-email" data-job-id="[jobId]">Generate Email</button>
  </div>
</div>
```

**SVG score ring** — reuse the same SVG ring logic used in the existing `main.js` analysis dashboard. Extract it into a shared utility function `scoreRing(score, label)` that both `main.js` and `jobs.js` can import. The ring has: circle r=30, cx=40, cy=40, viewBox="0 0 80 80"; stroke-width=6; background circle stroke `#e5e7eb`; foreground stroke color green(`#22c55e`) if score≥70, amber(`#f59e0b`) if score≥45, red(`#ef4444`) otherwise; stroke-dasharray=`${(score/100)*188.4} 188.4`; centered text showing the score number.

**Event handlers to implement:**

- `#jf-search-btn` click → `handleSearch(page=1, append=false)`
- `#jf-reset-btn` click → clear filters, clear results, clear localStorage state
- `#jf-load-more` click → `handleSearch(currentPage+1, append=true)`
- `.jf-toggle-jd` click → toggle `.hidden` on the matching `.job-card-full-jd`; update button text to "Hide JD ▴" / "View Full JD ▾"
- `.jf-analyze-btn` click → `handleAnalyze(jobId)`
- `.jf-gen-coverletter` click → `handleGenerateFromJob(jobId, "cover-letter")`
- `.jf-gen-email` click → `handleGenerateFromJob(jobId, "email")`

**`handleSearch(page, append)` logic:**

```
1. Read filter values from form
2. Validate: if no active profile selected, show alert "Please select a profile first"
3. Save filters to localStorage clg_job_search_state
4. Show skeleton loaders (3 skeleton cards)
5. Call callJobSearch(filters) from src/api.js
6. On success:
   - if append=false: allJobs = jobs; replace list
   - if append=true: allJobs = [...allJobs, ...jobs]; append cards
   - currentPage = page
   - Update results meta text: "N jobs found"
   - Show/hide Load More based on whether results.length === 10
7. On 429 error: startRateLimitCountdown(30)
8. On other error: show error state in results area
```

**`handleAnalyze(jobId)` logic:**

```
1. If openAnalysisId === jobId: close panel, set openAnalysisId=null, return
2. If openAnalysisId !== null: close previous panel
3. Set openAnalysisId = jobId
4. If analysisCache[jobId] exists: renderAnalysisPanel(analysisCache[jobId], jobId) and show panel, return
5. Show loading spinner inside panel
6. Get job from allJobs by id
7. Get active profile from window.getActiveProfile()
8. Call callGenerate("analyze", { resumes: [profile], jobDescription: job.description })
9. On success: cache result in analysisCache[jobId], render panel, scroll panel into view
10. On error: show error message inside panel with Retry button
```

**`handleGenerateFromJob(jobId, type)` logic:**

```
1. Get job from allJobs by id
2. Call window.switchToGeneratorTab()
3. Set value of #job-description textarea to job.description
4. Trigger generation: call window.triggerGeneration(type)
```

**Helper functions:**

- `countryFlag(countryCode)` — returns flag emoji for 2-letter ISO country code using Unicode regional indicator symbols: `String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E0 + c.charCodeAt(0) - 65))`
- `relativeDate(isoString)` — returns "Today", "Yesterday", "N days ago", "N weeks ago"
- `formatEmploymentType(type)` — maps `FULLTIME→"Full-time"`, `PARTTIME→"Part-time"`, `CONTRACTOR→"Contract"`, `INTERN→"Internship"`, else return raw
- `startRateLimitCountdown(seconds)` — shows banner, disables search button, counts down, re-enables on 0

---

## File 3: `src/api.js` — Additions Only

Append the following function to the existing file. Do not modify anything above it:

```js
// --- Job Search ---

export async function callJobSearch(params) {
  const qs = new URLSearchParams()
  if (params.query)          qs.set('query', params.query)
  if (params.location)       qs.set('location', params.location)
  if (params.remote)         qs.set('remote', params.remote)
  if (params.datePosted)     qs.set('datePosted', params.datePosted)
  if (params.employmentType) qs.set('employmentType', params.employmentType)
  if (params.page)           qs.set('page', params.page)

  const res = await fetch(`/api/jobs?${qs.toString()}`)
  const data = await res.json()

  if (!res.ok) throw Object.assign(new Error(data.error || 'Search failed'), { code: data.code })
  return data
}
```

---

## File 4: `src/main.js` — Additions Only

At the **very bottom** of the existing `main.js`, append:

```js
// --- Tab switching (added for Job Search Module) ---

window.switchToGeneratorTab = function () {
  document.getElementById('generator-view')?.classList.remove('hidden')
  document.getElementById('jobs-view')?.classList.add('hidden')
  document.getElementById('tab-generator')?.classList.add('tab-active')
  document.getElementById('tab-jobs')?.classList.remove('tab-active')
}

window.switchToJobsTab = function () {
  document.getElementById('generator-view')?.classList.add('hidden')
  document.getElementById('jobs-view')?.classList.remove('hidden')
  document.getElementById('tab-generator')?.classList.remove('tab-active')
  document.getElementById('tab-jobs')?.classList.add('tab-active')
}

// Expose active profile getter for jobs module
window.getActiveProfile = function () {
  const profiles = JSON.parse(localStorage.getItem('clg_profiles') || '[]')
  const selectedId = document.querySelector('input[name="profile"]:checked')?.value
  return profiles.find(p => p.id === selectedId) ?? null
}

// Expose generation trigger for jobs module
window.triggerGeneration = function (type) {
  const btn = type === 'cover-letter'
    ? document.getElementById('generate-cover-letter-btn')
    : type === 'email'
    ? document.getElementById('generate-email-btn')
    : null
  btn?.click()
}
```

Also, wrap the existing main UI container in a `<div id="generator-view">` if it isn't already. Add tab buttons to the header (see index.html changes below).

---

## `index.html` Changes

Add tab navigation to the header. After the `<header>` content, insert:

```html
<nav class="tab-nav">
  <button id="tab-generator" class="tab-btn tab-active" onclick="switchToGeneratorTab()">
    Generator
  </button>
  <button id="tab-jobs" class="tab-btn" onclick="switchToJobsTab()">
    Find Jobs
  </button>
</nav>
```

Add the jobs module import to the `<script type="module">` entry or inline:

```html
<script type="module">
  import { initJobSearch } from './src/jobs.js'
  document.addEventListener('DOMContentLoaded', () => initJobSearch())
</script>
```

Add the `jobs-tab` container before the closing `</body>`:

```html
<div id="jobs-tab"></div>
```

---

## File 5: `src/style.css` — Additions Only

Append these utility classes using the existing TailwindCSS v4 `@layer components` pattern already in the file:

```css
/* --- Job Search Module --- */

.jobs-view { @apply max-w-3xl mx-auto py-6 px-4 flex flex-col gap-6; }

.jobs-filter-bar { @apply bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm; }
.jobs-filter-row { @apply flex flex-wrap gap-2 items-center; }
.jobs-input { @apply flex-1 min-w-[160px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400; }
.jobs-select { @apply rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400; }
.jobs-type-chips { @apply flex flex-wrap gap-2 text-sm; }
.jobs-type-chips label { @apply flex items-center gap-1 cursor-pointer select-none; }

.jobs-ratelimit-banner { @apply bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-lg px-4 py-2; }
.jobs-results-meta { @apply text-sm text-gray-500; }
.jobs-results-list { @apply flex flex-col gap-4; }
.jobs-load-more-wrap { @apply flex justify-center py-4; }

.job-card { @apply bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3 transition-shadow hover:shadow-md; }
.job-card-header { @apply flex flex-col gap-1; }
.job-card-title-block { @apply flex flex-col; }
.job-card-title { @apply text-base font-semibold text-gray-900; }
.job-card-company { @apply text-sm text-indigo-600 font-medium; }
.job-card-meta { @apply flex flex-wrap gap-2 items-center text-xs text-gray-500; }
.job-card-location { @apply font-medium; }
.job-card-type { }
.job-card-date { }
.job-card-publisher { @apply italic; }
.job-card-snippet { @apply text-sm text-gray-600 leading-relaxed; }
.job-card-actions { @apply flex flex-wrap gap-2 pt-1; }
.job-card-full-jd { @apply mt-2 border-t border-gray-100 pt-3; }
.job-card-jd-text { @apply text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto; }
.job-card-analysis-panel { @apply mt-2 border-t border-gray-100 pt-4; }

.analysis-panel { @apply flex flex-col gap-4; }
.analysis-scores { @apply flex gap-6 justify-center; }
.analysis-summary { @apply text-sm text-gray-700 leading-relaxed; }
.analysis-skills { @apply flex flex-col gap-2; }
.analysis-actions { @apply flex gap-2 flex-wrap pt-2; }
.skill-group { @apply flex flex-wrap gap-2 items-center; }
.skill-group-label { @apply text-xs font-semibold uppercase tracking-wide; }
.skill-group-label.matched { @apply text-green-600; }
.skill-group-label.missing { @apply text-red-500; }
.skill-group-label.bonus { @apply text-indigo-500; }

.chip { @apply text-xs px-2 py-0.5 rounded-full border font-medium; }
.chip-remote { @apply bg-indigo-50 text-indigo-700 border-indigo-200; }
.chip-matched { @apply bg-green-50 text-green-700 border-green-200; }
.chip-missing { @apply bg-red-50 text-red-600 border-red-200; }
.chip-bonus { @apply bg-indigo-50 text-indigo-600 border-indigo-200; }

.tab-nav { @apply flex gap-1 border-b border-gray-200 px-4; }
.tab-btn { @apply px-4 py-2 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-900 transition-colors -mb-px; }
.tab-btn.tab-active { @apply text-indigo-600 border-indigo-600; }

/* Skeleton loaders */
.skeleton { @apply animate-pulse bg-gray-100 rounded-2xl; }
.skeleton-card { @apply h-36 w-full; }
```

---

## Implementation Rules

1. **Do not break existing functionality.** The Generator tab must work exactly as before after your changes.
2. **No new npm packages.** Use only what is already in `package.json`. The SVG rings are rendered as inline HTML strings — no external SVG library.
3. **CORS on `api/jobs.js`:** Set `Access-Control-Allow-Origin: *` and handle OPTIONS preflight identically to the existing `api/generate.js`.
4. **Error boundaries:** Every async operation must have a try/catch. Never let an unhandled promise rejection reach the user.
5. **No hardcoded API keys.** `JSEARCH_API_KEY` is read from `process.env` in `api/jobs.js` only.
6. **Accessibility:** All interactive elements must have a clear focus style and keyboard-accessible behavior.
7. **Mobile-first:** The filter form must stack vertically on viewports < 640px. The job card actions wrap naturally via `flex-wrap`.
8. **Analysis caching:** Once a job's analysis is fetched and displayed, it must not be re-fetched within the same session. Use `analysisCache` for this.
9. **Profile guard:** Before any search or analysis, check `window.getActiveProfile()`. If null, show a clear inline message: "Select a profile in the Generator tab before searching."
10. **Loading states:** Show skeleton cards during search. Show a spinner inside the analysis panel while the AI call is in flight. Never show a blank/empty area while loading.

---

## Testing Checklist

Before considering implementation complete, verify:

- [ ] Switching tabs hides/shows correct views without flickering
- [ ] Filters are restored from localStorage on page reload
- [ ] Role field pre-fills from active profile headline
- [ ] Search returns job cards with correct fields rendered
- [ ] "View Full JD" toggle opens/closes cleanly
- [ ] "Analyze Fit" triggers AI call, renders score rings + skill chips
- [ ] Second click on "Analyze Fit" for the same job uses the cache (no new network request)
- [ ] Opening analysis for job B closes analysis for job A
- [ ] "Generate Cover Letter" switches to Generator tab, fills JD, triggers generation
- [ ] "Apply" link opens in new tab
- [ ] Rate limit banner shows countdown and re-enables search button after 30s
- [ ] On mobile (375px width), filter form stacks vertically and cards are readable
- [ ] Generator tab still works identically to before
