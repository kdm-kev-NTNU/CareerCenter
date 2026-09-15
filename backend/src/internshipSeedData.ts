export const internshipOutcomeStatusLabels = ["Tilbud", "Avslått", "Trukket"] as const;

export const defaultInternshipStatuses = [
  "Interessert",
  "Forbereder søknad",
  "Søkt",
  "Online test",
  "Ferdig med online test",
  "Case",
  "Ferdig case",
  "Videosøknad",
  "Ferdig videosøknad",
  "Intervju 1",
  "Intervju 1 med case",
  "Intervju 2",
  "Intervju 2 med case",
  "Tilbud",
  "Avslått",
  "Trukket"
] as const;

export function internshipStatusKind(label: string): "stage" | "outcome" {
  return (internshipOutcomeStatusLabels as readonly string[]).includes(label) ? "outcome" : "stage";
}

export const defaultInternshipLocations = [
  "Oslo",
  "Trondheim",
  "Bergen",
  "Stavanger",
  "Remote",
  "Hybrid",
  "Annen"
];

export const defaultInternshipRequirementTypes: Array<{ label: string; description: string }> = [
  { label: "CV", description: "Oppdatert CV tilpasset stillingen" },
  { label: "Søknadsbrev", description: "Personlig søknadsbrev på norsk eller engelsk" },
  { label: "Karakterutskrift (norsk)", description: "Offisiell karakterutskrift fra NTNU" },
  { label: "Transkripsjon (engelsk)", description: "Engelsk transkripsjon av karakterer" },
  { label: "Portefølje / GitHub", description: "Lenke til relevante prosjekter" },
  { label: "Motivasjonsbrev", description: "Kort motivasjon for bedrift og rolle" },
  { label: "Anbefalingsbrev", description: "Referanse fra veileder eller arbeidsgiver" },
  { label: "LinkedIn-profil", description: "Profil oppdatert og konsistent med CV" },
  { label: "Vitnemål videregående", description: "Kopi av vitnemål hvis bedt om" },
  { label: "Attest / politiattest", description: "Hvis stillingen krever sikkerhetsklarering" },
  { label: "Språktest (TOEFL/IELTS)", description: "Dokumentasjon av engelskkunnskaper" },
  { label: "Case / hjemmeoppgave", description: "Teknisk eller forretningscase" },
  { label: "Online test", description: "Numerisk, logisk eller situasjonsbasert test" },
  { label: "Videosøknad", description: "Forhåndsinnspilt videosvar eller videointervju" },
  { label: "Intervjuforberedelse", description: "Forberedelse på intervju og spørsmål" }
];
