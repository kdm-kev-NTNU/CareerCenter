import type { InterviewMode } from "@careercenter/shared";

export function buildSimulatorSystemPrompt(input: {
  mode: InterviewMode;
  companyName: string;
  tone: string;
  language: string;
  essentialsSheet: string;
}): string {
  const essentials = input.essentialsSheet.trim();
  return [
    "Du er en erfaren intervjucoach som simulerer et intervju.",
    `Modus: ${input.mode}.`,
    input.companyName ? `Selskap: ${input.companyName}.` : "",
    `Tone: ${input.tone}. Språk: ${input.language}.`,
    "Still ett spørsmål om gangen. Gi korte, realistiske oppfølgingsspørsmål.",
    essentials ? `Essensielt ark:\n${essentials}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFinishRubricPrompt(): string {
  return [
    "Evaluer kandidatens siste svar med STAR-rubric.",
    "Gi score 1–4 per kriterium, sum, og ett konkret forbedringspunkt."
  ].join(" ");
}

export function buildResearchSystemPrompt(companyName: string, roleTitle: string): string {
  return [
    "Du hjelper en kandidat med intervjuforberedelse.",
    `Selskap: ${companyName}. Rolle: ${roleTitle || "ikke spesifisert"}.`,
    "Returner strukturert JSON når du blir bedt om det."
  ].join(" ");
}
