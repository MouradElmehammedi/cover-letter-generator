import { callJobSearch } from './api.js'
import { generateAnalysis } from './api.js'

// ── Module state ──
let currentFilters = {}
let allJobs = []
let openAnalysisId = null
let analysisCache = {}
let isLoading = false
let isRateLimited = false
let rateLimitTimer = null

const STORAGE_KEY = 'clg_job_search_state'
const APPLIED_KEY = 'clg_applied_jobs'

// ── Country + city data ──
// EU-27 + common non-EU countries, with major cities per country.
const COUNTRIES = [
  'Australia', 'Austria', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Cyprus',
  'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany',
  'Greece', 'Hungary', 'India', 'Ireland', 'Italy', 'Latvia', 'Lithuania',
  'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania',
  'Singapore', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland',
  'UK', 'USA',
]

const CITIES_BY_COUNTRY = {
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast', 'Hobart'],
  Austria: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt'],
  Belgium: ['Brussels', 'Antwerp', 'Ghent', 'Leuven', 'Liège', 'Bruges', 'Charleroi', 'Namur'],
  Bulgaria: ['Sofia', 'Plovdiv', 'Varna', 'Burgas', 'Ruse', 'Stara Zagora'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Quebec City', 'Winnipeg', 'Halifax'],
  Croatia: ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Pula'],
  Cyprus: ['Nicosia', 'Limassol', 'Larnaca', 'Paphos'],
  'Czech Republic': ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc'],
  Denmark: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg'],
  Estonia: ['Tallinn', 'Tartu', 'Narva', 'Pärnu'],
  Finland: ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu', 'Turku', 'Jyväskylä'],
  France: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Bordeaux', 'Lille', 'Strasbourg', 'Montpellier', 'Rennes', 'Sophia Antipolis', 'Grenoble'],
  Germany: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Dresden', 'Hannover', 'Nuremberg', 'Bremen'],
  Greece: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa'],
  Hungary: ['Budapest', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs', 'Győr'],
  India: ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai', 'Gurgaon', 'Noida', 'Kolkata'],
  Ireland: ['Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford'],
  Italy: ['Rome', 'Milan', 'Turin', 'Naples', 'Florence', 'Bologna', 'Genoa', 'Verona', 'Venice', 'Bari', 'Palermo'],
  Latvia: ['Riga', 'Daugavpils', 'Liepāja', 'Jelgava'],
  Lithuania: ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys'],
  Luxembourg: ['Luxembourg City', 'Esch-sur-Alzette', 'Differdange'],
  Malta: ['Valletta', 'Sliema', 'St. Julian\'s', 'Birkirkara'],
  Netherlands: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Breda', 'Nijmegen', 'Haarlem'],
  Poland: ['Warsaw', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Łódź', 'Katowice', 'Lublin', 'Szczecin'],
  Portugal: ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Aveiro'],
  Romania: ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Brașov'],
  Singapore: ['Singapore'],
  Slovakia: ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Nitra'],
  Slovenia: ['Ljubljana', 'Maribor', 'Celje', 'Kranj'],
  Spain: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Bilbao', 'Granada', 'Alicante', 'Palma'],
  Sweden: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Lund'],
  Switzerland: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Lugano', 'Zug'],
  UK: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Bristol', 'Leeds', 'Cambridge', 'Oxford', 'Liverpool', 'Belfast'],
  USA: ['New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Seattle', 'Austin', 'Boston', 'Washington DC', 'Atlanta', 'Denver', 'Miami', 'Dallas', 'Houston', 'San Diego', 'Philadelphia'],
}

function populateCities(country) {
  const select = document.getElementById('jf-city')
  if (!select) return
  const current = select.value
  const cities = CITIES_BY_COUNTRY[country] || []
  select.innerHTML = `<option value="">All cities</option>` +
    cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')
  // Try to preserve selection if the city exists in the new country
  if (cities.includes(current)) select.value = current
}

// ── Applied-jobs persistence ──
// Entry shape: { status: 'in_process' | 'applied', startedAt?, appliedAt?, title, company }
let appliedJobs = loadAppliedJobs()

function loadAppliedJobs() {
  try {
    return JSON.parse(localStorage.getItem(APPLIED_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function saveAppliedJobs() {
  try { localStorage.setItem(APPLIED_KEY, JSON.stringify(appliedJobs)) } catch {}
}

function getJobStatus(jobId) {
  const entry = appliedJobs[jobId]
  if (!entry) return null
  // Backward compat: old entries without `status` are treated as 'applied'
  return entry.status || 'applied'
}

function setJobStatus(jobId, status, job) {
  if (!status) {
    delete appliedJobs[jobId]
    saveAppliedJobs()
    return
  }
  const existing = appliedJobs[jobId] || {}
  appliedJobs[jobId] = {
    ...existing,
    status,
    title: existing.title || job?.title || '',
    company: existing.company || job?.company || '',
    ...(status === 'in_process' && !existing.startedAt ? { startedAt: new Date().toISOString() } : {}),
    ...(status === 'applied' ? { appliedAt: new Date().toISOString() } : {}),
  }
  saveAppliedJobs()
}

function isApplied(jobId) { return getJobStatus(jobId) === 'applied' }

// ── Helpers ──
function countryFlag(code) {
  if (!code || code.length < 2) return ''
  try {
    return String.fromCodePoint(...[...code.toUpperCase().slice(0, 2)].map(c => 0x1F1E0 + c.charCodeAt(0) - 65))
  } catch {
    return ''
  }
}

function relativeDate(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  const weeks = Math.floor(diff / 7)
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
}

function formatEmploymentType(type) {
  const map = { FULLTIME: 'Full-time', PARTTIME: 'Part-time', CONTRACTOR: 'Contract', INTERN: 'Internship' }
  return map[type] || type || ''
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function extractJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON in response')
  return JSON.parse(text.slice(start, end + 1))
}

function scoreColor(score) {
  if (score >= 70) return '#22c55e'
  if (score >= 45) return '#f59e0b'
  return '#ef4444'
}

function scoreRing(score, label) {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)))
  const dash = (s / 100) * 188.4
  const color = scoreColor(s)
  return `
    <div class="flex flex-col items-center gap-1">
      <div class="relative w-16 h-16">
        <svg viewBox="0 0 80 80" class="w-16 h-16 -rotate-90">
          <circle cx="40" cy="40" r="30" stroke="#e5e7eb" stroke-width="6" fill="none"/>
          <circle cx="40" cy="40" r="30" stroke="${color}" stroke-width="6" fill="none"
                  stroke-dasharray="${dash} 188.4" stroke-linecap="round"/>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-sm font-semibold" style="color:${color}">${s}</span>
        </div>
      </div>
      <span class="text-xs text-gray-500">${escapeHtml(label)}</span>
    </div>`
}

// ── Card renderers ──
function statusChipHtml(status) {
  if (status === 'applied') return `<span class="chip chip-applied">✓ Applied</span>`
  if (status === 'in_process') return `<span class="chip chip-in-process">⏳ In Process</span>`
  return ''
}

function renderJobCard(job) {
  const flag = countryFlag(job.country)
  const date = relativeDate(job.postedAt)
  const type = formatEmploymentType(job.employmentType)
  const remoteChip = job.isRemote ? `<span class="chip chip-remote">Remote</span>` : ''
  const status = getJobStatus(job.id)
  const applied = status === 'applied'
  const jobIdAttr = escapeHtml(job.id)

  const applyBtn = job.applyLink
    ? `<a class="btn-secondary btn-sm jf-apply-link" data-job-id="${jobIdAttr}" href="${escapeHtml(job.applyLink)}" target="_blank" rel="noopener">Apply ↗</a>`
    : job.googleLink
    ? `<a class="btn-ghost btn-sm jf-apply-link" data-job-id="${jobIdAttr}" href="${escapeHtml(job.googleLink)}" target="_blank" rel="noopener">View on Google Jobs ↗</a>`
    : ''

  const appliedBtnClass = applied ? 'btn-applied' : 'btn-ghost'
  const appliedBtnLabel = applied ? '✓ Applied' : 'Mark Applied'

  return `
    <div class="job-card ${applied ? 'job-card-applied' : ''}" data-job-id="${jobIdAttr}">
      <div class="job-card-header">
        <div class="job-card-title-block">
          <h3 class="job-card-title">${escapeHtml(job.title)}</h3>
          <span class="job-card-company">${escapeHtml(job.company)}</span>
        </div>
        <div class="job-card-meta">
          <span class="job-card-location">${flag} ${escapeHtml(job.location)}</span>
          <span class="chip job-card-type">${escapeHtml(type)}</span>
          ${remoteChip}
          ${statusChipHtml(status)}
          <span class="job-card-date">${escapeHtml(date)}</span>
          <span class="job-card-publisher">via ${escapeHtml(job.publisher || '')}</span>
        </div>
      </div>
      <p class="job-card-snippet">${escapeHtml(job.snippet)}</p>
      <div class="job-card-actions">
        <button class="btn-ghost btn-sm jf-toggle-jd" data-job-id="${jobIdAttr}">View Full JD ▾</button>
        <button class="btn-primary btn-sm jf-analyze-btn" data-job-id="${jobIdAttr}">Analyze Fit</button>
        ${applyBtn}
        <button class="${appliedBtnClass} btn-sm jf-toggle-applied" data-job-id="${jobIdAttr}" aria-pressed="${applied}">${appliedBtnLabel}</button>
      </div>
      <div class="job-card-full-jd hidden" data-job-id="${jobIdAttr}">
        <pre class="job-card-jd-text">${escapeHtml(job.description)}</pre>
      </div>
      <div class="job-card-analysis-panel hidden" data-job-id="${jobIdAttr}"></div>
    </div>`
}

// Refresh a single card's status-related UI (chip, card class, toggle button) in place
function updateCardStatus(jobId) {
  const status = getJobStatus(jobId)
  const applied = status === 'applied'

  const card = document.querySelector(`.job-card[data-job-id="${jobId}"]`)
  if (!card) return

  card.classList.toggle('job-card-applied', applied)

  // Refresh the status chip
  const meta = card.querySelector('.job-card-meta')
  if (meta) {
    meta.querySelectorAll('.chip-applied, .chip-in-process').forEach(c => c.remove())
    const chipHtml = statusChipHtml(status)
    if (chipHtml) {
      const anchor = meta.querySelector('.chip-remote') || meta.querySelector('.job-card-type')
      if (anchor) anchor.insertAdjacentHTML('afterend', chipHtml)
    }
  }

  // Refresh the toggle button
  const btn = card.querySelector('.jf-toggle-applied')
  if (btn) {
    btn.className = `${applied ? 'btn-applied' : 'btn-ghost'} btn-sm jf-toggle-applied`
    btn.textContent = applied ? '✓ Applied' : 'Mark Applied'
    btn.setAttribute('aria-pressed', String(applied))
  }
}

function renderAnalysisPanel(analysis, jobId) {
  const matched = (analysis.matchedSkills || []).slice(0, 8)
  const missing = (analysis.missingSkills || []).slice(0, 8)
  const bonus = (analysis.bonusSkills || []).slice(0, 6)

  const bonusSection = bonus.length ? `
    <div class="skill-group">
      <span class="skill-group-label bonus">+ Bonus</span>
      ${bonus.map(s => `<span class="chip chip-bonus">${escapeHtml(s)}</span>`).join('')}
    </div>` : ''

  return `
    <div class="analysis-panel">
      <div class="analysis-scores">
        ${scoreRing(analysis.overallScore, 'Overall')}
        ${scoreRing(analysis.skillMatch, 'Skills')}
        ${scoreRing(analysis.experienceFit, 'Experience')}
      </div>
      <p class="analysis-summary">${escapeHtml(analysis.summary || '')}</p>
      <div class="analysis-skills">
        <div class="skill-group">
          <span class="skill-group-label matched">✓ Matched</span>
          ${matched.length ? matched.map(s => `<span class="chip chip-matched">${escapeHtml(s)}</span>`).join('') : '<span class="text-xs text-gray-400">—</span>'}
        </div>
        <div class="skill-group">
          <span class="skill-group-label missing">✗ Missing</span>
          ${missing.length ? missing.map(s => `<span class="chip chip-missing">${escapeHtml(s)}</span>`).join('') : '<span class="text-xs text-gray-400">—</span>'}
        </div>
        ${bonusSection}
      </div>
      <div class="analysis-actions">
        <button class="btn-primary btn-sm jf-gen-coverletter" data-job-id="${escapeHtml(jobId)}">Generate Cover Letter</button>
        <button class="btn-secondary btn-sm jf-gen-email" data-job-id="${escapeHtml(jobId)}">Generate Email</button>
      </div>
    </div>`
}

function renderSkeletons() {
  const loading = `<div class="text-sm text-gray-500 text-center py-2">Scraping live job boards — this can take 10–60 seconds…</div>`
  const cards = Array.from({ length: 3 }, () => `<div class="skeleton skeleton-card"></div>`).join('')
  return loading + cards
}

// ── State helpers ──
// Expand "All cities" into a comma-joined list of every city we know for the selected country.
// Keeps localStorage clean: UI state has location="", the expansion happens only at API-call time.
function expandLocationForApi(filters) {
  const out = { ...filters }
  if (!out.location) {
    const cities = CITIES_BY_COUNTRY[out.countryIndeed] || []
    out.location = cities.length ? cities.join(', ') : (out.countryIndeed || '')
  }
  return out
}

function getFiltersFromForm() {
  const role = document.getElementById('jf-role')?.value.trim() || ''
  // location is the user's *UI* choice: a specific city, or "" meaning "All cities"
  const location = document.getElementById('jf-city')?.value || ''
  const remote = document.getElementById('jf-remote')?.value || 'any'
  const datePosted = document.getElementById('jf-posted')?.value || 'all'
  const countryIndeed = document.getElementById('jf-country')?.value || 'USA'
  const resultsWanted = document.getElementById('jf-results')?.value || '30'

  const types = [...document.querySelectorAll('#jf-type-chips input:checked')].map(el => el.value)
  const employmentType = types.join(',')

  const sitesArr = [...document.querySelectorAll('#jf-site-chips input:checked')].map(el => el.value)
  const sites = sitesArr.join(',')

  return { query: role, location, remote, datePosted, employmentType, sites, countryIndeed, resultsWanted }
}

function restoreFilters(filters) {
  if (!filters) return
  if (filters.query) {
    const el = document.getElementById('jf-role')
    if (el) el.value = filters.query
  }
  if (filters.remote) {
    const el = document.getElementById('jf-remote')
    if (el) el.value = filters.remote
  }
  if (filters.datePosted) {
    const el = document.getElementById('jf-posted')
    if (el) el.value = filters.datePosted
  }
  if (filters.resultsWanted) {
    const el = document.getElementById('jf-results')
    if (el) el.value = filters.resultsWanted
  }
  // Country must be set BEFORE populating cities, then city BEFORE saved value applies
  if (filters.countryIndeed) {
    const el = document.getElementById('jf-country')
    if (el) el.value = filters.countryIndeed
  }
  populateCities(document.getElementById('jf-country')?.value || 'USA')
  if (filters.location) {
    const el = document.getElementById('jf-city')
    if (el) el.value = filters.location
  }
  if (filters.employmentType) {
    const types = filters.employmentType.split(',')
    document.querySelectorAll('#jf-type-chips input').forEach(cb => {
      cb.checked = types.includes(cb.value)
    })
  }
  if (filters.sites) {
    const sites = filters.sites.split(',')
    document.querySelectorAll('#jf-site-chips input').forEach(cb => {
      cb.checked = sites.includes(cb.value)
    })
  }
}

function showResultsMeta(count, skippedSites = []) {
  const meta = document.getElementById('jf-results-meta')
  if (!meta) return
  const base = `${count} job${count !== 1 ? 's' : ''} found`
  if (skippedSites.length) {
    const pretty = skippedSites.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
    meta.innerHTML = `${escapeHtml(base)} <span class="jobs-skipped">· Skipped: ${escapeHtml(pretty)}</span>`
  } else {
    meta.textContent = base
  }
  meta.classList.remove('hidden')
}

function setSearchDisabled(disabled) {
  const btn = document.getElementById('jf-search-btn')
  if (btn) btn.disabled = disabled
}

// ── Rate limit ──
function startRateLimitCountdown(seconds) {
  isRateLimited = true
  setSearchDisabled(true)
  const banner = document.getElementById('jf-ratelimit-banner')
  const countdown = document.getElementById('jf-ratelimit-countdown')
  if (banner) banner.classList.remove('hidden')
  let remaining = seconds
  if (countdown) countdown.textContent = remaining

  clearInterval(rateLimitTimer)
  rateLimitTimer = setInterval(() => {
    remaining -= 1
    if (countdown) countdown.textContent = remaining
    if (remaining <= 0) {
      clearInterval(rateLimitTimer)
      isRateLimited = false
      setSearchDisabled(false)
      if (banner) banner.classList.add('hidden')
    }
  }, 1000)
}

// ── Event handlers ──
async function handleSearch() {
  if (isLoading || isRateLimited) return

  const profile = window.getActiveProfile?.()
  if (!profile) {
    const list = document.getElementById('jf-results-list')
    if (list) {
      list.innerHTML = `<div class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        Select a profile in the Generator tab before searching.
      </div>`
    }
    return
  }

  const filters = getFiltersFromForm()
  if (!filters.query) {
    const list = document.getElementById('jf-results-list')
    if (list) {
      list.innerHTML = `<div class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        Please enter a role or keywords before searching.
      </div>`
    }
    return
  }

  currentFilters = filters
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filters)) } catch {}

  isLoading = true
  const list = document.getElementById('jf-results-list')
  const meta = document.getElementById('jf-results-meta')

  if (list) list.innerHTML = renderSkeletons()
  if (meta) meta.classList.add('hidden')

  try {
    const data = await callJobSearch(expandLocationForApi(filters))
    const jobs = data.jobs || []

    allJobs = jobs
    openAnalysisId = null
    analysisCache = {}

    if (list) list.innerHTML = jobs.length
      ? jobs.map(renderJobCard).join('')
      : `<div class="text-sm text-gray-500 text-center py-8">No jobs found. Try different keywords, broader location, or more sources.</div>`

    showResultsMeta(allJobs.length, data.skippedSites || [])
  } catch (err) {
    if (err.code === 'RATE_LIMIT') {
      startRateLimitCountdown(30)
    } else {
      if (list) {
        list.innerHTML = `<div class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
          Job search unavailable. <button class="underline jf-retry-btn">Retry</button>
        </div>`
      }
    }
  } finally {
    isLoading = false
  }
}

async function handleAnalyze(jobId) {
  const panel = document.querySelector(`.job-card-analysis-panel[data-job-id="${jobId}"]`)
  if (!panel) return

  // Toggle off if same panel clicked again
  if (openAnalysisId === jobId) {
    panel.classList.add('hidden')
    panel.innerHTML = ''
    openAnalysisId = null
    return
  }

  // Close previously open panel
  if (openAnalysisId) {
    const prev = document.querySelector(`.job-card-analysis-panel[data-job-id="${openAnalysisId}"]`)
    if (prev) { prev.classList.add('hidden'); prev.innerHTML = '' }
    openAnalysisId = null
  }

  openAnalysisId = jobId
  panel.classList.remove('hidden')

  // Use cache if available
  if (analysisCache[jobId]) {
    panel.innerHTML = renderAnalysisPanel(analysisCache[jobId], jobId)
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }

  panel.innerHTML = `<div class="flex items-center gap-2 py-4 text-sm text-gray-500">
    <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
    Analyzing fit…
  </div>`

  const job = allJobs.find(j => j.id === jobId)
  const profile = window.getActiveProfile?.()

  if (!job || !profile) {
    panel.innerHTML = `<p class="text-sm text-red-600">Could not analyze: missing job or profile.</p>`
    return
  }

  try {
    const result = await generateAnalysis({
      resumes: [profile.data],
      jobDescription: job.description,
    })

    const data = extractJson(result.text)
    analysisCache[jobId] = data
    panel.innerHTML = renderAnalysisPanel(data, jobId)
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  } catch {
    panel.innerHTML = `<div class="text-sm text-red-600 flex items-center gap-3">
      Analysis failed.
      <button class="underline jf-analyze-retry" data-job-id="${escapeHtml(jobId)}">Retry</button>
    </div>`
  }
}

function handleGenerateFromJob(jobId, type) {
  const job = allJobs.find(j => j.id === jobId)
  if (!job) return

  window.switchToGeneratorTab?.()

  const jdTextarea = document.getElementById('job-description')
  if (jdTextarea) jdTextarea.value = job.description

  window.triggerGeneration?.(type)
}

// ── Init ──
export function initJobSearch() {
  // Inject jobs view into the page container
  const appEl = document.querySelector('.min-h-screen')
  if (!appEl) return

  const footer = appEl.querySelector('footer')
  const jobsDiv = document.createElement('div')
  jobsDiv.id = 'jobs-tab'
  jobsDiv.innerHTML = `
    <div id="jobs-view" class="jobs-view hidden">

      <div class="jobs-filter-bar">

        <!-- Primary search: role + country + city -->
        <div class="jobs-primary-row">
          <div class="jobs-input-wrap jobs-input-wrap-grow">
            <svg class="jobs-input-icon" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input type="text" id="jf-role" placeholder="Role or keywords" class="jobs-input-bare" />
          </div>
          <select id="jf-country" class="jobs-select jobs-select-country" title="Country">
            ${COUNTRIES.map(c => `<option value="${escapeHtml(c)}"${c === 'USA' ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
          <select id="jf-city" class="jobs-select jobs-select-city" title="City">
            <option value="">All cities</option>
          </select>
        </div>

        <!-- Quick filters row -->
        <div class="jobs-filter-row">
          <select id="jf-remote" class="jobs-select">
            <option value="any">Any location</option>
            <option value="remote">Remote only</option>
            <option value="onsite">On-site only</option>
          </select>
          <select id="jf-posted" class="jobs-select">
            <option value="all">Any time</option>
            <option value="today">Past 24 hours</option>
            <option value="3days">Past 3 days</option>
            <option value="week">Past week</option>
            <option value="month">Past month</option>
          </select>
          <select id="jf-results" class="jobs-select" title="How many jobs to fetch">
            <option value="20">20 results</option>
            <option value="30" selected>30 results</option>
            <option value="50">50 results</option>
            <option value="100">100 results</option>
          </select>
        </div>

        <!-- Sources -->
        <div class="jobs-chip-group">
          <span class="jobs-group-label">Sources</span>
          <div id="jf-site-chips" class="jobs-chips">
            <label class="jobs-chip"><input type="checkbox" value="linkedin" checked /><span>LinkedIn</span></label>
            <label class="jobs-chip"><input type="checkbox" value="indeed" checked /><span>Indeed</span></label>
            <label class="jobs-chip"><input type="checkbox" value="glassdoor" checked /><span>Glassdoor</span></label>
            <label class="jobs-chip"><input type="checkbox" value="google" checked /><span>Google</span></label>
          </div>
        </div>

        <!-- Employment type -->
        <div class="jobs-chip-group">
          <span class="jobs-group-label">Job type</span>
          <div id="jf-type-chips" class="jobs-chips">
            <label class="jobs-chip"><input type="checkbox" value="FULLTIME" checked /><span>Full-time</span></label>
            <label class="jobs-chip"><input type="checkbox" value="PARTTIME" /><span>Part-time</span></label>
            <label class="jobs-chip"><input type="checkbox" value="CONTRACTOR" /><span>Contract</span></label>
            <label class="jobs-chip"><input type="checkbox" value="INTERN" /><span>Internship</span></label>
          </div>
        </div>

        <!-- Actions -->
        <div class="jobs-actions">
          <p class="jobs-hint">
            <svg class="w-3.5 h-3.5 inline-block -mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            Scraping live — searches take 10–60 seconds
          </p>
          <div class="jobs-actions-btns">
            <button id="jf-reset-btn" class="btn-ghost btn-sm">Reset</button>
            <button id="jf-search-btn" class="btn-primary-jobs">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Search Jobs
            </button>
          </div>
        </div>

      </div>

      <div id="jf-ratelimit-banner" class="hidden jobs-ratelimit-banner">
        Rate limit reached. Search will re-enable in <span id="jf-ratelimit-countdown">30</span>s.
      </div>

      <div id="jf-results-meta" class="jobs-results-meta hidden"></div>
      <div id="jf-results-list" class="jobs-results-list"></div>

    </div>`

  if (footer) {
    appEl.insertBefore(jobsDiv, footer)
  } else {
    appEl.appendChild(jobsDiv)
  }

  // Populate cities for the default country first, then restore saved filters
  populateCities(document.getElementById('jf-country')?.value || 'USA')

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    restoreFilters(saved)
  } catch {}

  // Repopulate cities whenever the country changes
  document.getElementById('jf-country')?.addEventListener('change', (e) => {
    populateCities(e.target.value)
  })

  // Pre-fill role from active profile
  const profile = window.getActiveProfile?.()
  const roleInput = document.getElementById('jf-role')
  if (roleInput && !roleInput.value) {
    const headline = profile?.data?.basics?.headline ?? profile?.data?.basics?.label ?? ''
    if (headline) roleInput.value = headline
  }

  // ── Event listeners ──
  document.getElementById('jf-search-btn')?.addEventListener('click', () => handleSearch())

  document.getElementById('jf-reset-btn')?.addEventListener('click', () => {
    const roleEl = document.getElementById('jf-role')
    const remoteEl = document.getElementById('jf-remote')
    const postedEl = document.getElementById('jf-posted')
    const countryEl = document.getElementById('jf-country')
    const resultsEl = document.getElementById('jf-results')
    if (roleEl) roleEl.value = ''
    if (remoteEl) remoteEl.value = 'any'
    if (postedEl) postedEl.value = 'all'
    if (countryEl) countryEl.value = 'USA'
    if (resultsEl) resultsEl.value = '30'
    populateCities('USA')
    document.querySelectorAll('#jf-type-chips input').forEach((cb, i) => { cb.checked = i === 0 })
    document.querySelectorAll('#jf-site-chips input').forEach(cb => { cb.checked = true })

    try { localStorage.removeItem(STORAGE_KEY) } catch {}

    allJobs = []
    openAnalysisId = null
    analysisCache = {}

    const list = document.getElementById('jf-results-list')
    if (list) list.innerHTML = ''
    const meta = document.getElementById('jf-results-meta')
    if (meta) meta.classList.add('hidden')
  })

  // Delegated events on the results list
  document.getElementById('jf-results-list')?.addEventListener('click', e => {
    const toggleBtn = e.target.closest('.jf-toggle-jd')
    if (toggleBtn) {
      const jobId = toggleBtn.dataset.jobId
      const jdEl = document.querySelector(`.job-card-full-jd[data-job-id="${jobId}"]`)
      if (jdEl) {
        const isHidden = jdEl.classList.toggle('hidden')
        toggleBtn.textContent = isHidden ? 'View Full JD ▾' : 'Hide JD ▴'
      }
      return
    }

    const analyzeBtn = e.target.closest('.jf-analyze-btn')
    if (analyzeBtn) {
      handleAnalyze(analyzeBtn.dataset.jobId)
      return
    }

    const analyzeRetry = e.target.closest('.jf-analyze-retry')
    if (analyzeRetry) {
      const jobId = analyzeRetry.dataset.jobId
      openAnalysisId = null
      handleAnalyze(jobId)
      return
    }

    const retryBtn = e.target.closest('.jf-retry-btn')
    if (retryBtn) {
      handleSearch()
      return
    }

    const genCL = e.target.closest('.jf-gen-coverletter')
    if (genCL) {
      handleGenerateFromJob(genCL.dataset.jobId, 'cover-letter')
      return
    }

    const genEmail = e.target.closest('.jf-gen-email')
    if (genEmail) {
      handleGenerateFromJob(genEmail.dataset.jobId, 'email')
      return
    }

    // External Apply link click → auto-mark as "in_process" (unless already Applied)
    const applyLink = e.target.closest('.jf-apply-link')
    if (applyLink) {
      const jobId = applyLink.dataset.jobId
      if (jobId && getJobStatus(jobId) !== 'applied') {
        const job = allJobs.find(j => j.id === jobId)
        setJobStatus(jobId, 'in_process', job)
        updateCardStatus(jobId)
      }
      // Don't preventDefault — let the link open the external page normally
      return
    }

    // Toggle button: cycle between Applied ↔ no status
    const appliedBtn = e.target.closest('.jf-toggle-applied')
    if (appliedBtn) {
      const jobId = appliedBtn.dataset.jobId
      const job = allJobs.find(j => j.id === jobId)
      const nextStatus = getJobStatus(jobId) === 'applied' ? null : 'applied'
      setJobStatus(jobId, nextStatus, job)
      updateCardStatus(jobId)
      return
    }
  })

  // Catch middle-click / cmd-click / ctrl-click on Apply links too
  document.getElementById('jf-results-list')?.addEventListener('auxclick', e => {
    const applyLink = e.target.closest('.jf-apply-link')
    if (!applyLink) return
    const jobId = applyLink.dataset.jobId
    if (jobId && getJobStatus(jobId) !== 'applied') {
      const job = allJobs.find(j => j.id === jobId)
      setJobStatus(jobId, 'in_process', job)
      updateCardStatus(jobId)
    }
  })

  // Search on Enter key in role input
  document.getElementById('jf-role')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch()
  })
}