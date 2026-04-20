import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

function buildFileName(text) {
  // Try to extract job title from subject line (e.g. "Objet : Candidature au poste de X" or "Subject: Application for the position of X")
  const subjectMatch = text.match(/(?:Objet|Subject)\s*:\s*(?:Candidature au poste de|Application for the position of)\s*(.+)/i);
  const position = subjectMatch?.[1]?.trim().replace(/[^\w\s-]/g, "") || "position";

  // Try to extract company name from lines near the top (often appears in the header block)
  // Look for common patterns: "Company:", "Entreprise:", or a standalone capitalized line after the date
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

  return `${sanitize(position)}_${sanitize(company)}_${date}.docx`;
}

export async function exportToDocx(text) {
  const paragraphs = text.split("\n").map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Arial",
            size: 24, // 12pt
          }),
        ],
      }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, buildFileName(text));
}
