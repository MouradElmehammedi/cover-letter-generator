const JOBSPY_BASE = process.env.JOBSPY_API_URL || 'http://vmi3247974.contaboserver.net:8000'

const HOURS_MAP = { today: 24, '3days': 72, week: 168, month: 720 }

const EMP_TYPE_MAP = {
  FULLTIME:   ['fulltime', 'full-time', 'full time'],
  PARTTIME:   ['parttime', 'part-time', 'part time'],
  CONTRACTOR: ['contract', 'contractor'],
  INTERN:     ['intern', 'internship'],
}

function normalizeJob(job) {
  const desc = job.description || ''
  const parts = (job.location || '').split(',').map(s => s.trim()).filter(Boolean)
  const country = parts.length ? parts[parts.length - 1] : ''

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location || '',
    country,
    isRemote: job.is_remote === true,
    employmentType: job.job_type || '',
    postedAt: job.date_posted ? `${job.date_posted}T00:00:00Z` : null,
    description: desc,
    snippet: desc.length > 220 ? desc.slice(0, 220) + '…' : desc,
    applyLink: job.job_url_direct || job.job_url || null,
    googleLink: job.job_url || null,
    publisher: job.site || '',
    salary: {
      min: job.min_amount ?? null,
      max: job.max_amount ?? null,
      currency: job.currency ?? null,
      period: job.interval ?? null,
    },
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })

  const {
    query,
    location,
    remote,
    datePosted,
    employmentType,
    sites,
    countryIndeed,
    resultsWanted,
  } = req.query

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Search term is required.', code: 'MISSING_QUERY' })
  }

  const params = new URLSearchParams()
  params.set('search_term', query.trim())
  if (location) params.set('location', location)
  if (countryIndeed) params.set('country_indeed', countryIndeed)

  const wanted = Math.min(Math.max(parseInt(resultsWanted, 10) || 30, 1), 100)
  params.set('results_wanted', String(wanted))

  const hoursOld = HOURS_MAP[datePosted]
  if (hoursOld) params.set('hours_old', String(hoursOld))

  const siteList = (sites || 'linkedin,indeed,glassdoor,google')
    .split(',').map(s => s.trim()).filter(Boolean)
  for (const s of siteList) params.append('site', s)

  try {
    const upstream = await fetch(`${JOBSPY_BASE}/scrape?${params.toString()}`)

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '')
      console.error('JobSpy upstream error:', upstream.status, errText)
      return res.status(502).json({ error: 'Job search unavailable.', code: 'UPSTREAM_ERROR' })
    }

    const json = await upstream.json()
    let jobs = (json.jobs || []).map(normalizeJob)
    const skippedSites = Array.isArray(json.skipped_sites) ? json.skipped_sites : []

    // Client-side filters JobSpy doesn't support server-side
    const empFilters = (employmentType || '').split(',').filter(Boolean)
    if (empFilters.length) {
      jobs = jobs.filter(j => {
        const jt = (j.employmentType || '').toLowerCase()
        if (!jt) return true // keep unknowns — JobSpy often returns null for job_type
        return empFilters.some(e => (EMP_TYPE_MAP[e] || []).some(kw => jt.includes(kw)))
      })
    }

    if (remote === 'remote')      jobs = jobs.filter(j => j.isRemote === true)
    else if (remote === 'onsite') jobs = jobs.filter(j => j.isRemote !== true)

    return res.status(200).json({ jobs, totalResults: jobs.length, page: 1, skippedSites })
  } catch (err) {
    console.error('Jobs API error:', err)
    return res.status(502).json({ error: 'Job search unavailable.', code: 'UPSTREAM_ERROR' })
  }
}