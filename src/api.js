export async function generateCoverLetter({ resumes, jobDescription, language, tone }) {
  return callGenerate({ resumes, jobDescription, language, tone, type: 'cover-letter' });
}

export async function generateEmail({ resumes, jobDescription, language, tone }) {
  return callGenerate({ resumes, jobDescription, language, tone, type: 'email' });
}

export async function generateAnalysis({ resumes, jobDescription, language }) {
  return callGenerate({ resumes, jobDescription, language, type: 'analyze' });
}

async function callGenerate(payload) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Generation failed.');
  return data;
}

// --- Job Search ---

export async function callJobSearch(params) {
  const qs = new URLSearchParams()
  if (params.query)          qs.set('query', params.query)
  if (params.location)       qs.set('location', params.location)
  if (params.remote)         qs.set('remote', params.remote)
  if (params.datePosted)     qs.set('datePosted', params.datePosted)
  if (params.employmentType) qs.set('employmentType', params.employmentType)
  if (params.sites)          qs.set('sites', params.sites)
  if (params.countryIndeed)  qs.set('countryIndeed', params.countryIndeed)
  if (params.resultsWanted)  qs.set('resultsWanted', params.resultsWanted)

  const res = await fetch(`/api/jobs?${qs.toString()}`)
  const data = await res.json()

  if (!res.ok) throw Object.assign(new Error(data.error || 'Search failed'), { code: data.code })
  return data
}
