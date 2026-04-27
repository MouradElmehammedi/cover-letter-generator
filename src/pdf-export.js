import { jsPDF } from "jspdf";

function buildFileName(text) {
  const subjectMatch = text.match(/(?:Objet|Subject)\s*:\s*(?:Candidature au poste de|Application for the position of)\s*(.+)/i);
  const position = subjectMatch?.[1]?.trim().replace(/[^\w\s-]/g, "") || "position";

  const companyMatch =
    text.match(/(?:Company|Entreprise|Société)\s*:\s*(.+)/i) ||
    text.match(/(?:Dear\s+(?:Hiring Manager|.*?)\s+at\s+)(.+)/i) ||
    text.match(/(?:Madame, Monsieur,?|Dear Sir or Madam,?)\s*\n+.*?(?:at|chez|au sein de|à)\s+(.+?)[\s,.]/i);
  const company = companyMatch?.[1]?.trim().replace(/[^\w\s-]/g, "") || "company";

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}-${pad(now.getHours())}-${pad(now.getMinutes())}`;

  const sanitize = (s) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 50);

  return `${sanitize(position)}_${sanitize(company)}_${date}.pdf`;
}

export function exportToPdf(text) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const margin = 72; // 1 inch
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const lineHeight = 16; // ~12pt with comfortable spacing

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  let y = margin;

  for (const rawLine of text.split("\n")) {
    const wrapped = rawLine.length ? doc.splitTextToSize(rawLine, usableWidth) : [""];
    for (const line of wrapped) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  doc.save(buildFileName(text));
}
