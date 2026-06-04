---
name: norwegian-public-wcag
description: Verifies Norwegian IKT accessibility law against WCAG 2.1 (A/AA as in regulations), EU WAD for public sector, and Tilgjengelighetsloven. Use for offentlig sektor nettsider/apper, universell utforming, tilgjengelighetserklæring, uutilsynet, WCAG-samsvar, tastatur, kontrast, skjemaer, ARIA, eller når brukeren ber om norsk tilgjengelighetskrav.
---

# Norsk offentlig sektor: WCAG og universell utforming

## Regelverk (kort)

- **Hjemmel**: [Diskriminerings- og tilgjengelighetsloven](https://lovdata.no/lov/2017-06-16-51) (bl.a. § 11 om universell utforming av IKT).
- **Forskrift**: [Forskrift om universell utforming av IKT-løsninger](https://lovdata.no/forskrift/2013-06-21-732) — konkretiserer kravene.
- **Standard**: **WCAG 2.1**, nivå **A** og **AA** — *hvilke* suksesskriterier som gjelder avhenger av **løsningstype og sektor**. Bruk Tilsynets filter (lenke under), ikke anta «alle 78» eller et fast tall uten å sjekke.
- **Offentlig sektor (WAD)**: Fra **1. februar 2023** gjelder tilleggskrav fra EUs webdirektiv — bl.a. **tilgjengelighetserklæring** og rutiner for tilbakemelding. Se [uutilsynet om WAD](https://www.uutilsynet.no/webdirektivet-wad/eus-webdirektiv-wad/265) og [krav om tilgjengelighetserklæring](https://www.uutilsynet.no/webdirektivet-wad/krav-om-tilgjengelegheitserklaering/267).
- **Tolkning og tilsyn**: [Tilsynet for universell utforming av IKT](https://www.uutilsynet.no/regelverk/regelverk-og-krav/746) — offisiell veiledning, suksesskriterier og **testregler** som brukes ved kontroll.

**Viktig**: Ved tvil om tolkning eller scope (unntak, dokumenter, apper, automater), les [reference.md](reference.md) og primærkildene der — ikke erstatt dem med generell «beste praksis».

## Arbeidsflyt for agenten

1. Avklar **løsningstype** (nettsted, mobilapp, dokument, automat osv.) og **sektor** (offentlig/privat).
2. Åpne [WCAG-standarden med filter hos uutilsynet](https://www.uutilsynet.no/wcag-standarden/wcag-standarden/86) og bekreft **hvilke suksesskriterier** som gjelder for denne leveransen.
3. Gå gjennom sjekklisten under på **representative sider/tilstander** (forside, navigasjon, søk, skjema, feiltilstand, innlogget, kart/tabell hvis aktuelt).
4. For **offentlige nettsteder**: verifiser at **tilgjengelighetserklæring** finnes og er oppdatert (vanligvis via [uustatus.no](https://uustatus.no)).
5. Dokumenter avvik med **suksesskriterium** (f.eks. 1.4.3), kort **hvor** (URL/komponent), og **forslag til retting**.

## Sjekkliste: implementering (nettsted / webapp)

Kryss av under utvikling og før release. Punktene følger Tilsynets struktur (prinsipp 1–4) og [oversikt over testregler for nettsteder](https://www.uutilsynet.no/regelverk/oversikt-over-testregler-nettsteder/709).

### Offentlig sektor — organisatorisk (WAD)

- [ ] **Tilgjengelighetserklæring** er publisert og beskriver overensstemmelse, kjente mangler, alternative tilgjengelige måter der relevant, og kontakt for tilbakemelding (jf. uutilsynet / uustatus).
- [ ] **Prosess** for å håndtere tilbakemeldinger om tilgjengelighet er beskrevet og overholdes.
- [ ] **Årlig gjennomgang** (eller etter større endringer) er planlagt; erklæring og faktisk tilstand holdes i tråd.

### 1. Mulig å oppfatte

- [ ] **Ikke-tekstlig innhold (1.1.1)**: Meningsbærende bilder har `alt` (evt. kort + lang beskrivelse der komplekst); dekorative bilder er tomme `alt=""` eller skjult for hjelpemidler; lenkede bilder har beskrivende alternativ eller lenketekst; CAPTCHA har alternativer.
- [ ] **Lyd/video (1.2.x)**: Forhåndsinnspilt video med lyd har **teksting** eller tekstalternativ; der kravet gjelder: **synstolking** (1.2.5); ren lyd / ren video har tekst- eller lydalternativ etter reglene.
- [ ] **Struktur (1.3.1)**: Overskrifter er semantiske (`h1`–`h6`) og logisk hierarki; tabeller har `th`/`scope`/caption der nødvendig; layout-tabeller skilles fra datatabeller; lister er ekte lister; skjemainstruksjoner er koblet til felt (`for`/`aria-labelledby`); spesialtekst (f.eks. sitat) er korrekt markert.
- [ ] **Leserekkefølge (1.3.2)**: DOM-rekkefølge gir mening når CSS/layout endres.
- [ ] **Ikke bare sensorisk (1.3.3)**: Instruksjoner avhenger ikke av «til høyre», form, farge alene osv.
- [ ] **Farge (1.4.1)**: Lenker og tilstand skilles med mer enn bare farge; grafikk/skjema feiler ikke «bare farge»-testen.
- [ ] **Lyd som starter (1.4.2)**: Auto-lyd over ~3 s har styring nær start, tastaturbetjent, innen de første tab-stegene.
- [ ] **Kontrast tekst (1.4.3)**: Normal tekst minst **4,5:1** mot bakgrunn; stor tekst minst **3:1**; tekst i bilder samme krav.
- [ ] **Zoom 200 % (1.4.4)**: Innhold og funksjonalitet beholdes ved minst 200 % zoom.
- [ ] **Unngå bilde av tekst (1.4.5)**: Ekte tekst brukes der det er mulig; bilde av tekst bare når brukeren kan tilpasse visning.
- [ ] **Reflow (1.4.10)**: Ved 320 CSS px bredde (eller tilsvarende zoom) unngås **to-dimensjonal scrolling** for hovedinnhold; alt nås og kan brukes.
- [ ] **Kontrast UI-komponenter/grafikk (1.4.11)**: Ikke-tekst som trengs for å forstå UI/grafikk: typisk **3:1** der kravet gjelder.
- [ ] **Tekstavstand (1.4.12)**: Brukerstiler for linjehøyde, avsnitt, sperring og ordavstand gir ikke tap av innhold/funksjon.
- [ ] **Hover/fokus-innhold (1.4.13)**: Tooltip/menyer som vises ved hover eller fokus kan lukkes uten å flytte peker/fokus unødig, forblir til avvisning, og blokkerer ikke.

### 2. Mulig å betjene

- [ ] **Tastatur (2.1.1)**: All funksjonalitet nås og betjenes med tastatur; unntak kun der standarden tillater det.
- [ ] **Ingen tastaturfelle (2.1.2)**: Kan alltid navigere videre med tastatur.
- [ ] **Enkelt-tegn hurtigtaster (2.1.4)**: Kan slås av eller rekonfigureres med modifikator.
- [ ] **Tid (2.2.1)**: Tidsbegrensninger kan slås av, forlenges eller justeres etter krav.
- [ ] **Pause/stopp (2.2.2)**: Bevegelse/blinking/auto-oppdatering kan pauses/stoppes/skjules.
- [ ] **Blink/glimt (2.3.1)**: Ingen farlig blinkfrekvens eller for stort blinkende areal (terskel tre glimt / areal etter standarden).
- [ ] **Hopp over blokker (2.4.1)**: «Hopp til innhold» eller tilsvarende der gjentatt innhold (header/meny) kommer før hovedinnhold.
- [ ] **Sidetittel (2.4.2)**: `<title>` beskriver emne/formål unikt der det gir mening.
- [ ] **Fokusrekkefølge (2.4.3)**: Matcher forutsigbar bruk.
- [ ] **Formål med lenke (2.4.4)**: Lenketekst (evt. med programmatisk kontekst) er forståelig uten «klikk her» alene.
- [ ] **Flere måter å finne innhold (2.4.5)**: Minst to navigasjonsmåter der kravet gjelder (sett av sider).
- [ ] **Overskrifter/ledetekster beskriver (2.4.6)**: Overskrifter og skjemalabels matcher innhold/formål.
- [ ] **Synlig fokus (2.4.7)**: Tastaturfokus er alltid synlig og ikke bare tidsbegrenset unntatt enkle tilfeller.
- [ ] **Peker/gesture (2.5.1–2.5.4)**: Flerpunktgest har enkel-peker-alternativ; down-event ikke alene trigger uten undo; synlig ledetekst inngår i **accessible name**; bevegelsesaktivering har alternativ.

### 3. Forståelig

- [ ] **Språk (3.1.1 / 3.1.2)**: `lang` på rot; fragmenter på annet språk har `lang`-attributt.
- [ ] **Fokus uten overraskelse (3.2.1)**: Fokus flytter ikke kontekst automatisk.
- [ ] **Inndata (3.2.2)**: Endring i komponent (f.eks. select) starter ikke uventet navigasjon innsending uten forvarsel.
- [ ] **Konsekvent navigering og identifikasjon (3.2.3 / 3.2.4)**: Gjentatte mønstre og ikoner/labels er konsistente på tvers av sider.
- [ ] **Feil i skjema (3.3.1)**: Auto-oppdaget feil identifiserer felt, presis tekst, **kodet som tekst**; feil forblir synlig i skjemaet (med mindre sikkerhet/personvern).
- [ ] **Instruksjoner (3.3.2)**: Ledetekst/instruksjon synlig eller ved fokus, nær felt; obligatoriske felt er tydelig merket og forklart.
- [ ] **Forslag ved feil (3.3.3)**: Når systemet vet korreksjon, gis forslag som tekst og enkel navigasjon til feilen.
- [ ] **Kritiske transaksjoner (3.3.4)**: Juridisk/økonomisk/lagring: bekreftelse, gjennomgang eller angremulighet etter reglene.

### 4. Robust

- [ ] **Navn, rolle, verdi (4.1.2)**: Skjema, knapper, menyer og custom widgets eksponerer korrekt rolle, navn og tilstand for hjelpemidler; `iframe` har beskrivende `title`.
- [ ] **Statusbeskjeder (4.1.3)**: Dynamiske meldinger bruker `role="status"`/`alert` eller `aria-live` i tråd med Tilsynets presisering (resultat, venting, feil, fremdrift).

### PDF og annet nedlastbart innhold

- [ ] PDF og andre dokumenter som er **nødvendige for tjenesten** er universelt utformet eller tilbys i **tilgjengelig alternativ** der unntak ikke gjelder — verifiser mot gjeldende krav for dokumenter (se filter og veiledning på uutilsynet).

## Verktøy (anbefalt i sjekk)

- Automatisert: axe DevTools, WAVE, Lighthouse (tillegg, ikke erstatning for manuell test).
- Tastatur: full navigasjon uten mus; skjermleser: NVDA (Windows) eller VoiceOver (macOS) på kritiske flyter.
- Kontrast: faktiske farger i drift, inkl. hover/disabled.

## Mer dybde

- Lenkesamling til Lovdata, uutilsynet (WAD, testregler, unntak): [reference.md](reference.md)
