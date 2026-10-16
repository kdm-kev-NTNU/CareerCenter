import type { AbilityTestKind } from "@careercenter/shared";

export interface AbilityProviderTest {
  kind: AbilityTestKind;
  title: string;
  description: string;
  defaultMinutes: number;
  playable: boolean;
}

export interface AbilityProviderCatalogTest {
  group: "ferdighet" | "logikk" | "personlighet";
  name: string;
  duration: string;
  measures: string;
  /** When set, this catalog entry maps to a playable in-app test. */
  playableKind?: AbilityTestKind;
}

export interface AbilityProvider {
  id: string;
  name: string;
  shortDescription: string;
  officialUrl: string;
  officialUrlLabel: string;
  howItWorks: string[];
  tips: string[];
  catalog: AbilityProviderCatalogTest[];
  tests: AbilityProviderTest[];
}

export const abilityProviders: AbilityProvider[] = [
  {
    id: "aon",
    name: "AON",
    shortDescription:
      "Øving for Aon Assessment Solutions (tidligere cut-e): Switch Challenge, Scales CLX, numerisk og verbal resonnering, og multitasking (Scales MTA VI).",
    officialUrl:
      "https://www.aon.com/en/capabilities/talent-and-rewards/prepare-for-your-online-assessment",
    officialUrlLabel: "Prepare for your Online Assessment (Aon)",
    howItWorks: [
      "En Aon-test starter med introduksjon og interaktive eksempler uten tidsfrist.",
      "Deretter kommer den faktiske testen, ofte med tidsbegrensning. Personlighetstester er vanligvis uten tidsfrist.",
      "Du kan vanligvis ta pauser mellom ulike tester, men ikke midt i en enkelt test.",
      "Prestasjonstester: poeng for riktig svar, trekk for feil. Du forventes ikke å rekke alle oppgavene."
    ],
    tips: [
      "Bruk PC eller laptop med oppdatert nettleser og stabilt nett.",
      "Sitt i et rolig rom uten avbrytelser. Skru av telefonen.",
      "Ikke start når du er sliten — ta testen når du er uthvilt.",
      "Svar raskt, men nøye. Feil svar trekker vanligvis ned.",
      "For numerisk resonnering: ha kalkulator, penn og papir klart."
    ],
    catalog: [
      {
        group: "logikk",
        name: "Deductive Reasoning (switchChallenge)",
        duration: "6 min",
        measures: "Finn riktig firesifret kode som gjør input om til output.",
        playableKind: "switch_challenge"
      },
      {
        group: "logikk",
        name: "Inductive Logical Reasoning (scales clx)",
        duration: "6 min",
        measures: "Finn mønsteret og velg rutenettene som følger regelen.",
        playableKind: "scales_clx"
      },
      {
        group: "ferdighet",
        name: "Numerical Reasoning (scales numerical)",
        duration: "12 min · 37 oppgaver",
        measures: "Avgjør om påstander er sanne ut fra tallark (sant / usant / kan ikke avgjøres).",
        playableKind: "scales_numerical"
      },
      {
        group: "ferdighet",
        name: "Verbal Reasoning (scales verbal)",
        duration: "12 min · 49 oppgaver",
        measures: "Avgjør om påstander er sanne ut fra tekst (sant / usant / kan ikke avgjøres).",
        playableKind: "scales_verbal"
      },
      {
        group: "ferdighet",
        name: "Language Skills (scales lt)",
        duration: "10 min",
        measures: "Utfylling, definisjoner og rettskriving."
      },
      {
        group: "ferdighet",
        name: "Mechanical Reasoning (scales mtu)",
        duration: "15 min · 24 oppgaver",
        measures: "Mekanisk og teknisk forståelse."
      },
      {
        group: "ferdighet",
        name: "Multi-tasking Capability (scales MTA VI)",
        duration: "5 min",
        measures:
          "Utfør flere oppgaver samtidig: land fly, døm regnestykker og bokstavrekker.",
        playableKind: "scales_mta"
      },
      {
        group: "ferdighet",
        name: "Working Memory (gridChallenge)",
        duration: "9 min",
        measures: "Husk informasjon mens du bearbeider noe annet."
      },
      {
        group: "ferdighet",
        name: "Complex Planning (motionChallenge)",
        duration: "6 min",
        measures: "Planlegg trekk for å nå et mål."
      },
      {
        group: "logikk",
        name: "Inductive Reasoning (scales ix)",
        duration: "5 min · 20 oppgaver",
        measures: "Finn figuren som ikke følger mønsteret."
      },
      {
        group: "logikk",
        name: "Deductive-logical Thinking (gapChallenge)",
        duration: "6 min",
        measures: "Fyll tom celle for å fullføre mønsteret."
      },
      {
        group: "personlighet",
        name: "ADEPT-15® Work-Related Behaviour",
        duration: "ca. 30 min",
        measures: "Arbeidsrelaterte preferanser (ingen fasit)."
      }
    ],
    tests: [
      {
        kind: "switch_challenge",
        title: "Switch Challenge",
        description:
          "Deduktiv: finn koden som gjør input om til output. Vanskelighetsgraden øker for hvert riktige svar.",
        defaultMinutes: 6,
        playable: true
      },
      {
        kind: "scales_clx",
        title: "Scales CLX",
        description: "Induktiv: finn regelen og velg de to rutenettene som følger den.",
        defaultMinutes: 6,
        playable: true
      },
      {
        kind: "scales_numerical",
        title: "Numerisk resonnering",
        description:
          "Flere dataark med tabeller og diagrammer. Avgjør om hver påstand er sant, usant eller ikke kan avgjøres.",
        defaultMinutes: 12,
        playable: true
      },
      {
        kind: "scales_verbal",
        title: "Verbal resonnering",
        description:
          "Les tekster og avgjør om påstander er sanne, usanne eller ikke kan avgjøres ut fra teksten alene.",
        defaultMinutes: 12,
        playable: true
      },
      {
        kind: "scales_mta",
        title: "Scales MTA VI",
        description:
          "Multitasking: land fly gjennom rullebanen samtidig som du dømmer regnestykker og bokstavrekker (correct / wrong).",
        defaultMinutes: 5,
        playable: true
      }
    ]
  }
];

export function getAbilityProvider(id: string): AbilityProvider | undefined {
  return abilityProviders.find((p) => p.id === id);
}

export function isKnownAbilityProvider(id: string): boolean {
  return abilityProviders.some((p) => p.id === id);
}
