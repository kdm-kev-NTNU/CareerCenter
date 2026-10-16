import { createSeededRng } from "./switchChallenge.js";
import type { PassageSheet, StatementItem, StatementTest, StatementVerdict } from "./statementTest.js";

const VERBAL_STATEMENT_COUNT = 49;

interface VerbalPassage {
  id: string;
  title: string;
  text: string;
  statements: Array<{
    text: string;
    verdict: StatementVerdict;
    rationale: string;
  }>;
}

/**
 * Curated Norwegian passages with hand-authored true / false / cannot_say
 * statements. Each passage includes all three verdicts.
 */
export const VERBAL_PASSAGE_BANK: VerbalPassage[] = [
  {
    id: "vp-1",
    title: "Fjernarbeid i teknologiselskaper",
    text: "Etter pandemien lot mange teknologiselskaper ansatte jobbe hjemmefra tre dager i uken. En undersøkelse blant 400 ansatte viste at 62 % opplevde høyere produktivitet hjemme, mens 18 % savnet faglige diskusjoner på kontoret. Ledelsen innførte obligatorisk kontordag hver tirsdag for å styrke samarbeidet. Selskapet planlegger ikke å gå tilbake til full kontortid i 2026.",
    statements: [
      {
        text: "Flertallet av de spurte ansatte opplevde høyere produktivitet hjemme.",
        verdict: "true",
        rationale: "Teksten sier at 62 % opplevde høyere produktivitet hjemme, som er et flertall."
      },
      {
        text: "Selskapet krever kontorarbeid alle ukedager.",
        verdict: "false",
        rationale: "Teksten sier at ansatte kan jobbe hjemme tre dager, og at bare tirsdag er obligatorisk på kontoret."
      },
      {
        text: "Ansatte i andre bransjer har samme erfaring med fjernarbeid.",
        verdict: "cannot_say",
        rationale: "Teksten handler kun om teknologiselskaper og denne undersøkelsen."
      },
      {
        text: "Selskapet planlegger å gå tilbake til full kontortid i 2026.",
        verdict: "false",
        rationale: "Teksten sier eksplisitt at selskapet ikke planlegger å gå tilbake til full kontortid i 2026."
      },
      {
        text: "Obligatorisk kontordag er lagt til tirsdag.",
        verdict: "true",
        rationale: "Teksten sier at ledelsen innførte obligatorisk kontordag hver tirsdag."
      }
    ]
  },
  {
    id: "vp-2",
    title: "Kollektivtransport i byen",
    text: "Byrådet vedtok å utvide trikkelinjen med fire nye stopp innen utgangen av 2027. Prosjektet er budsjettert til 1,2 milliarder kroner, hvorav staten dekker 40 %. Ifølge en reisendesundersøkelse bruker 55 % av innbyggerne kollektivtransport minst to ganger i uken. Biltrafikken i sentrum sank med 8 % året etter at rushtidsavgiften ble innført.",
    statements: [
      {
        text: "Staten dekker mer enn en tredjedel av prosjektbudsjettet.",
        verdict: "true",
        rationale: "40 % er mer enn en tredjedel (ca. 33 %)."
      },
      {
        text: "Trikkelinjen skal utvides med seks nye stopp.",
        verdict: "false",
        rationale: "Teksten sier fire nye stopp, ikke seks."
      },
      {
        text: "Flertallet av innbyggerne er fornøyd med trikketilbudet.",
        verdict: "cannot_say",
        rationale: "Teksten oppgir bruksfrekvens, men ikke tilfredshet."
      },
      {
        text: "Biltrafikken i sentrum sank etter at rushtidsavgiften ble innført.",
        verdict: "true",
        rationale: "Teksten sier at biltrafikken sank med 8 % året etter innføringen."
      }
    ]
  },
  {
    id: "vp-3",
    title: "Matbutikkjede og bærekraft",
    text: "Matbutikkjeden Nordlys kuttet matsvinn med 15 % fra 2023 til 2024 ved å selge varer nær utløpsdato til redusert pris. Kjeden innførte også plastfrie fruktposer i alle butikker. Leverandøravtalene krever at fiskeprodukter er MSC-sertifisert. Nordlys har ikke offentliggjort tall for CO₂-utslipp fra transport.",
    statements: [
      {
        text: "Matsvinnet ble redusert mellom 2023 og 2024.",
        verdict: "true",
        rationale: "Teksten sier at matsvinn ble kuttet med 15 % fra 2023 til 2024."
      },
      {
        text: "Nordlys har offentliggjort CO₂-tall for transport.",
        verdict: "false",
        rationale: "Teksten sier at Nordlys ikke har offentliggjort tall for CO₂-utslipp fra transport."
      },
      {
        text: "Kundene foretrekker plastfrie poser fremfor vanlige poser.",
        verdict: "cannot_say",
        rationale: "Teksten nevner innføringen, men ikke kundepreferanser."
      },
      {
        text: "Fiskeprodukter hos Nordlys skal være MSC-sertifisert.",
        verdict: "true",
        rationale: "Leverandøravtalene krever MSC-sertifisering for fiskeprodukter."
      }
    ]
  },
  {
    id: "vp-4",
    title: "Universitetsopptak",
    text: "I 2025 søkte 12 400 studenter seg til bachelorprogrammet i dataingeniørfag. Av disse fikk 1 860 tilbud om studieplass. Antall søkere økte med 9 % sammenlignet med 2024. Fakultetet opprettet et nytt kurs i maskinlæring, men det er ikke obligatorisk for førsteårsstudenter. Studieavgift for utenlandske studenter utenfor EØS ble holdt uendret.",
    statements: [
      {
        text: "Færre enn 2 000 søkere fikk tilbud om studieplass i 2025.",
        verdict: "true",
        rationale: "1 860 tilbud er færre enn 2 000."
      },
      {
        text: "Antall søkere sank fra 2024 til 2025.",
        verdict: "false",
        rationale: "Teksten sier at antall søkere økte med 9 %."
      },
      {
        text: "Maskinlæringskurset er obligatorisk for førsteårsstudenter.",
        verdict: "false",
        rationale: "Teksten sier eksplisitt at kurset ikke er obligatorisk for førsteårsstudenter."
      },
      {
        text: "Flertallet av søkerne hadde matematikk R2.",
        verdict: "cannot_say",
        rationale: "Teksten sier ingenting om søkernes forkunnskaper."
      }
    ]
  },
  {
    id: "vp-5",
    title: "Sykehuskapasitet",
    text: "Regionsykehuset økte antallet sengeplasser med 40 i 2024. Ventetiden for planlagte ortopediske inngrep sank fra 14 til 11 uker. Akuttmottaket behandlet 8 % flere pasienter enn året før. Sykehuset ansatte 25 nye sykepleiere, men rapporterte fortsatt underbemanning på nattevakter. Bygget av ny poliklinikk er utsatt til 2028.",
    statements: [
      {
        text: "Ventetiden for planlagte ortopediske inngrep ble kortere.",
        verdict: "true",
        rationale: "Ventetiden sank fra 14 til 11 uker."
      },
      {
        text: "Akuttmottaket behandlet færre pasienter enn året før.",
        verdict: "false",
        rationale: "Teksten sier at akuttmottaket behandlet 8 % flere pasienter."
      },
      {
        text: "Ny poliklinikk åpner i 2026.",
        verdict: "false",
        rationale: "Bygget er utsatt til 2028, ikke 2026."
      },
      {
        text: "Pasienttilfredsheten økte etter flere sengeplasser.",
        verdict: "cannot_say",
        rationale: "Teksten nevner ikke pasienttilfredshet."
      }
    ]
  },
  {
    id: "vp-6",
    title: "Elbilandel i Norge",
    text: "I 2024 utgjorde elbiler 82 % av nybilsalget i Norge. Gjennomsnittlig rekkevidde for nye elbiler økte til 480 km. Staten reduserte engangsavgiftsfordelen for elbiler over 500 000 kroner. Ladestasjoner langs hovedveiene økte med 1 200 punkter. Hydrogenbiler utgjorde under 0,1 % av nybilsalget.",
    statements: [
      {
        text: "Elbiler utgjorde mer enn tre fjerdedeler av nybilsalget i 2024.",
        verdict: "true",
        rationale: "82 % er mer enn 75 %."
      },
      {
        text: "Hydrogenbiler utgjorde over 1 % av nybilsalget.",
        verdict: "false",
        rationale: "Teksten sier under 0,1 %."
      },
      {
        text: "Alle elbiler fikk uendret avgiftsfordel i 2024.",
        verdict: "false",
        rationale: "Fordelen ble redusert for elbiler over 500 000 kroner."
      },
      {
        text: "Flertallet av elbileiere lader hjemme hver natt.",
        verdict: "cannot_say",
        rationale: "Teksten sier ingenting om ladevaner hjemme."
      }
    ]
  },
  {
    id: "vp-7",
    title: "Netthandelsvekst",
    text: "Norske forbrukere handlet varer på nett for 48 milliarder kroner i 2024, en økning på 6 % fra året før. Returandelen for klær lå på 28 %. De tre største aktørene sto for 51 % av omsetningen. Fysiske butikker i sentrum rapporterte uendret omsetning i samme periode. Momsfritak for små utenlandske forsendelser ble fjernet i 2023.",
    statements: [
      {
        text: "Netthandelen økte fra 2023 til 2024.",
        verdict: "true",
        rationale: "Teksten sier en økning på 6 % fra året før."
      },
      {
        text: "De tre største aktørene sto for under halvparten av omsetningen.",
        verdict: "false",
        rationale: "51 % er over halvparten."
      },
      {
        text: "Fysiske butikker i sentrum hadde fallende omsetning i 2024.",
        verdict: "false",
        rationale: "Teksten sier uendret omsetning."
      },
      {
        text: "Returandelen for elektronikk var lavere enn for klær.",
        verdict: "cannot_say",
        rationale: "Teksten oppgir kun returandel for klær."
      }
    ]
  },
  {
    id: "vp-8",
    title: "Vindkraftutbygging",
    text: "To nye vindparker til havs ble godkjent i 2025 med samlet kapasitet på 1,4 GW. Utbyggingen forventes å starte i 2027. Lokale fiskere har klaget på mulige konsekvenser for gyteområder. Regjeringen lovet en kompensasjonsordning, men beløpet er ikke fastsatt. Landbasert vindkraft fikk ingen nye konsesjoner i samme år.",
    statements: [
      {
        text: "Havvindparkene som ble godkjent har samlet kapasitet over 1 GW.",
        verdict: "true",
        rationale: "1,4 GW er over 1 GW."
      },
      {
        text: "Utbyggingen startet i 2025.",
        verdict: "false",
        rationale: "Teksten sier at utbyggingen forventes å starte i 2027."
      },
      {
        text: "Landbasert vindkraft fikk flere nye konsesjoner i 2025.",
        verdict: "false",
        rationale: "Teksten sier at landbasert vindkraft ikke fikk nye konsesjoner."
      },
      {
        text: "Kompensasjonen til fiskerne er på 200 millioner kroner.",
        verdict: "cannot_say",
        rationale: "Teksten sier at beløpet ikke er fastsatt."
      }
    ]
  },
  {
    id: "vp-9",
    title: "Bankenes boliglånsrente",
    text: "I mars 2025 hevet Norges Bank styringsrenten med 0,25 prosentpoeng. Tre av fire storbanker fulgte etter med tilsvarende økning i boliglånsrenten innen to uker. Den fjerde banken ventet til april. Andelen husholdninger med flytende rente var 92 %. Forbrukslån hadde høyere rente enn boliglån i hele perioden.",
    statements: [
      {
        text: "Flertallet av storbankene hevet boliglånsrenten innen to uker.",
        verdict: "true",
        rationale: "Tre av fire er et flertall."
      },
      {
        text: "Alle fire storbanker hevet renten samtidig som Norges Bank.",
        verdict: "false",
        rationale: "Den fjerde banken ventet til april."
      },
      {
        text: "De fleste husholdninger hadde flytende rente.",
        verdict: "true",
        rationale: "92 % hadde flytende rente."
      },
      {
        text: "Boligprisene falt etter renteøkningen.",
        verdict: "cannot_say",
        rationale: "Teksten nevner ikke boligpriser."
      }
    ]
  },
  {
    id: "vp-10",
    title: "Skolematordning",
    text: "Kommunen innførte gratis skolemat for alle elever på barnetrinnet fra høsten 2024. Ordningen koster 18 millioner kroner årlig og finansieres over kommunebudsjettet. En spørreundersøkelse blant foresatte viste 71 % støtte. Ungdomsskolene er ikke omfattet. Leverandøren er et lokalt kooperativ som også leverer til sykehjem.",
    statements: [
      {
        text: "Gratis skolemat gjelder elever på barnetrinnet.",
        verdict: "true",
        rationale: "Teksten sier at ordningen gjelder alle elever på barnetrinnet."
      },
      {
        text: "Ungdomsskolene er også omfattet av ordningen.",
        verdict: "false",
        rationale: "Teksten sier at ungdomsskolene ikke er omfattet."
      },
      {
        text: "Flertallet av foresatte støttet ordningen.",
        verdict: "true",
        rationale: "71 % støtte er et flertall."
      },
      {
        text: "Ordningen reduserte fraværet blant elevene.",
        verdict: "cannot_say",
        rationale: "Teksten sier ingenting om fravær."
      }
    ]
  },
  {
    id: "vp-11",
    title: "Cybersikkerhet i offentlig sektor",
    text: "Direktoratet for sikkerhet rapporterte 340 alvorlige cyberhendelser i offentlig sektor i 2024, opp 22 % fra 2023. Over halvparten skyldtes phishing. Et nytt krav om tofaktorautentisering for alle ansatte trådte i kraft 1. januar 2025. Kommunene fikk tilskudd på til sammen 90 millioner kroner til sikkerhetsoppgradering. Ingen kommuner ble unntatt kravet.",
    statements: [
      {
        text: "Antall alvorlige cyberhendelser økte fra 2023 til 2024.",
        verdict: "true",
        rationale: "Teksten sier en økning på 22 %."
      },
      {
        text: "Under halvparten av hendelsene skyldtes phishing.",
        verdict: "false",
        rationale: "Teksten sier at over halvparten skyldtes phishing."
      },
      {
        text: "Tofaktorautentisering ble obligatorisk for alle ansatte fra 1. januar 2025.",
        verdict: "true",
        rationale: "Teksten beskriver nettopp dette kravet."
      },
      {
        text: "Private bedrifter fikk samme tilskudd som kommunene.",
        verdict: "cannot_say",
        rationale: "Teksten handler kun om offentlig sektor og kommuner."
      }
    ]
  },
  {
    id: "vp-12",
    title: "Turisme etter sesongen",
    text: "Destinasjon Vestlandet registrerte 2,1 millioner gjestedøgn i sommersesongen 2025, en nedgang på 3 % fra 2024. Campingplasser hadde økning, mens hotell overnight stays falt. Cruiseanløp ble begrenset til tre skip per uke i Julihavn. Lokal handelsstand rapporterte høyere omsetning i juni enn i juli. Været var kaldere enn gjennomsnittet i juli.",
    statements: [
      {
        text: "Totalt antall gjestedøgn sank fra 2024 til 2025.",
        verdict: "true",
        rationale: "Teksten sier en nedgang på 3 %."
      },
      {
        text: "Hotellovernattinger økte i 2025.",
        verdict: "false",
        rationale: "Teksten sier at hotell overnight stays falt."
      },
      {
        text: "Cruiseanløp i Julihavn er begrenset til tre skip per uke.",
        verdict: "true",
        rationale: "Teksten sier eksplisitt denne begrensningen."
      },
      {
        text: "Turistene var mer fornøyd med camping enn med hotell.",
        verdict: "cannot_say",
        rationale: "Teksten sammenligner volum, ikke tilfredshet."
      }
    ]
  }
];

function shuffleInPlace<T>(rng: () => number, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/**
 * Build a scales verbal test: curated passages + seeded shuffle to ~49 statements.
 */
export function generateVerbalReasoning(seed: number): StatementTest {
  const rng = createSeededRng(seed >>> 0);
  const passages = [...VERBAL_PASSAGE_BANK];
  shuffleInPlace(rng, passages);

  const sheets: PassageSheet[] = passages.map((p, i) => ({
    id: `tekst-${i + 1}`,
    title: p.title,
    kind: "passage" as const,
    text: p.text
  }));

  const sheetIdByPassage = new Map(
    passages.map((p, i) => [p.id, sheets[i]!.id] as const)
  );

  const all: StatementItem[] = [];
  for (const passage of passages) {
    const sheetId = sheetIdByPassage.get(passage.id)!;
    const stmts = [...passage.statements];
    shuffleInPlace(rng, stmts);
    for (const s of stmts) {
      all.push({
        id: `verb-${all.length + 1}`,
        sheetId,
        text: s.text,
        verdict: s.verdict,
        rationale: s.rationale
      });
    }
  }

  shuffleInPlace(rng, all);
  const statements = all.slice(0, VERBAL_STATEMENT_COUNT);

  // Keep only sheets that are referenced
  const usedSheetIds = new Set(statements.map((s) => s.sheetId));
  const usedSheets = sheets.filter((s) => usedSheetIds.has(s.id));

  return {
    kind: "scales_verbal",
    seed,
    sheets: usedSheets,
    statements
  };
}

export const VERBAL_REASONING_STATEMENT_COUNT = VERBAL_STATEMENT_COUNT;
