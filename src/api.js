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
