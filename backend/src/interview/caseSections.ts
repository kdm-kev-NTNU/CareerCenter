export interface ParsedCaseSections {
  prompt: string;
  interviewerInfo: string;
  solution: string;
}

const promptMarker = /^(?:#{1,3}\s*)?(?:prompt|case|oppgave)\s*:?\s*$/im;
const interviewerMarker = /^(?:#{1,3}\s*)?(?:interviewer|intervjuer|veiledning)\s*(?:info)?\s*:?\s*$/im;
const solutionMarker = /^(?:#{1,3}\s*)?(?:solution|løsning|fasit)\s*:?\s*$/im;

export function parseCaseSections(content: string): ParsedCaseSections {
  const trimmed = content.trim();
  if (!trimmed) {
    return { prompt: "", interviewerInfo: "", solution: "" };
  }

  type SectionKey = "prompt" | "interviewerInfo" | "solution";
  const markerDefs: Array<{ key: SectionKey; regex: RegExp }> = [
    { key: "prompt", regex: promptMarker },
    { key: "interviewerInfo", regex: interviewerMarker },
    { key: "solution", regex: solutionMarker }
  ];

  const hits: Array<{ key: SectionKey; index: number; length: number }> = [];
  for (const marker of markerDefs) {
    const match = marker.regex.exec(trimmed);
    if (match?.index !== undefined) {
      hits.push({ key: marker.key, index: match.index, length: match[0].length });
    }
  }

  if (hits.length === 0) {
    const paragraphs = trimmed.split(/\n{2,}/);
    return {
      prompt: paragraphs[0]?.trim() ?? trimmed,
      interviewerInfo: paragraphs.slice(1).join("\n\n").trim(),
      solution: ""
    };
  }

  hits.sort((a, b) => a.index - b.index);
  const sections: ParsedCaseSections = { prompt: "", interviewerInfo: "", solution: "" };

  for (let i = 0; i < hits.length; i += 1) {
    const hit = hits[i];
    const start = hit.index + hit.length;
    const end = hits[i + 1]?.index ?? trimmed.length;
    sections[hit.key] = trimmed.slice(start, end).trim();
  }

  return sections;
}
