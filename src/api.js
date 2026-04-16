export async function generateCoverLetter({ resumes, jobDescription, language, tone }) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumes, jobDescription, language, tone }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Generation failed.');
  }

  return data;
}
