import type { BibleCaseSeed, BibleDocSeed } from "./bibleTypes.js";

export const originalDocs: BibleDocSeed[] = [
  {
    slug: "case-typer",
    kind: "case",
    title: "Casetype og rammeverk",
    sourceFilename: "case-typer.md",
    content: `Bruk samme rekkefølge i hver case: avklar, avgrens, hypoteser, undersøk, løs, forebygg.
Kandidatstyrt case betyr at du driver analysen og ber om data. Intervjuerstyrt case betyr at du får spørsmål i faser og skal svare strukturert på hvert.

Lønnsomhet: bryt resultatnedgangen i pris, volum, produktmiks og kostnad. Ikke foreslå prispåslag før du vet hvilken bøtte som faktisk flyttet seg.
Markedsinngang: størrelse, vekst, konkurranse, tilgang til kanal, enhetsøkonomi og hva som må være sant for at det skal lønne seg.
Oppkjøp: strategisk treff, hva kjøperen faktisk får, hva som er vanskelig å integrere, og om prisen tåler de risikoene.
Prising: betalingsvilje, alternativet kunden har i dag, bidrag per enhet, og hvor mye volum du har råd til å miste.
Digitalt landskap: kartlegg mot verdikjeden, prioriter der forretningen er kritisk og smerten er høy, og foreslå ett første inngrep framfor en stor omskriving.
Markedsstørrelse: bryt ned i faktorer, si antakelsene, regn i runde tall, og avslutt med et intervall.
Kapasitet: skill etterspørsel, flaskehals og kostnad ved å løse flaskehalsen. Et nytt skift og en ny ressurs er ulike svar.

Hva er den første hypotesen din i en lønnsomhetscase?
Hvilke data ber du om før du anbefaler å gå inn i et nytt marked?
Hvordan prioriterer du et fragmentert IT-landskap uten å kartlegge hver eneste applikasjon?
Når bør du la være å anbefale et oppkjøp selv om strategien høres riktig ut?`
  },
  {
    slug: "it-tema",
    kind: "tech_topics",
    title: "IT-temaer til teknisk intervju",
    sourceFilename: "it-tema.md",
    content: `Dette er en sjekkliste til et teknisk intervju i et konsulent- eller produktmiljø. Svar med et eksempel, en avveining og når du ville valgt det andre alternativet.

Hva er forskjellen på en monolitt og en modulær arkitektur når noe feiler i produksjon?
Når er mikrotjenester verdt kostnaden, og når er de ikke det?
Hva skiller IaaS, PaaS og SaaS i ansvar for drift, sikkerhet og tid til produksjon?
Når ville du valgt privat sky, offentlig sky eller en hybrid, og hvilken risiko følger valget?
Hva betyr CI og CD i praksis for et team som slipper sjeldent?
Hvem eier prioritering i et smidig team, og hva gjør du når utviklerne og produkteieren er uenige?
Hva er forskjellen på punkt-til-punkt-integrasjon og en hendelsesdrevet flyt?
Hvordan samler du krav når bestilleren beskriver en løsning og ikke et problem?
Hva koster IT egentlig utover lisenser: drift, endring, sikkerhet og ventetid i forretningen?
Hvordan ville du forklart teknisk gjeld til en leder som vil ha en ny funksjon neste måned?`
  }
];

export const originalCases: BibleCaseSeed[] = [
  {
    slug: "sildre-oppsummering",
    title: "Sildre: fem minutters kundeoppsummering",
    sourceKind: "single_case",
    caseStyle: "interviewer_led",
    companyTags: ["consulting", "deals", "it"],
    docSlug: "case-typer",
    prompt: `Du er associate. En kollega vil ha en oppsummering på maks fem minutter av Sildre AS: hva som betyr noe, og hvor dere kan bidra. Ikke lag presentasjon.

Sildre selger sportsutstyr. Selskapet ble startet i 2004, har 18 butikker og en nettbutikk som nå står for 22 % av omsetningen. Omsetningen var 410, 445 og 480 millioner kroner de tre siste årene. Bruttofortjenesten falt fra 44 % til 39 %. Driftsresultatet falt fra 38 til 24 millioner, selv om omsetningen steg. Varelageret økte fra 70 til 112 millioner, og kundefordringene fra 18 til 41 millioner.

Et investeringsselskap kjøpte Sildre for tre år siden og vil gjøre selskapet klar for et salg innen fire år. Nettveksten har gitt rot i lager og i koblingen mellom kasse, nettbutikk og økonomisystem. Fire utviklere eier en egen app for medlemskap. Butikkene har stort sett stabile team, men tre butikker har høyt sykefravær. En viktig leverandør i Vietnam er omtalt i en gransking av arbeidsforhold. Sildre vurderer å kjøpe en liten bruktplattform som har lojale, unge kunder, egne returlinjer og nesten ingen systemstøtte.

Si hva du ville tatt med, hva du ville latt ligge, og ett konkret neste steg.`,
    interviewerInfo: `Gi ikke flere tall med mindre kandidaten spør om en bro. Da kan du si: varekost opp 28 millioner, frakt og IT-drift opp 9 millioner, lønn opp 6 millioner. Prisene er ikke hevet. Volumet i butikk er flatt, nettet står for nesten hele omsetningsveksten.

Vurder struktur og prioritering, ikke om de nevner alt. En IT-vinkling bør treffe integrasjon, personopplysninger og tredjepart. En transaksjonsvinkling bør treffe marginbro, arbeidskapital og om oppkjøpet tåler manuell drift. En strategivinkling bør velge én hovedhistorie: lønnsom vekst i nett, ikke en liste.`,
    solution: `Omsetningen vokser, men kontantene og marginen gjør det ikke. Nettet har flyttet salget uten at lager, fordringer og systemer er dimensjonert for det.

Prioriter tre spor. Først en margin- og lagerbro, så en enkel integrasjon mellom kanalene før nye systemer, og til slutt en avgrenset vurdering av oppkjøpet: annet kundesegment, svak systemstøtte og kort historikk. Leverandørsaken og de tre butikkene er omdømme- og driftsrisiko, ikke hovedcasen.

Anbefaling: ikke start med oppkjøp. Gjør Sildre i stand til å tjene penger på veksten de allerede har. Neste steg er en to-ukers gjennomgang av marginbro, lagerdager og hvor ordre faktisk stopper mellom nett og butikk.`
  },
  {
    slug: "kystforsikring-it",
    title: "Kystforsikring: fornye IT-landskapet",
    sourceKind: "single_case",
    caseStyle: "interviewer_led",
    companyTags: ["consulting", "it"],
    docSlug: "case-typer",
    prompt: `CIO-en i Kystforsikring ber deg hjelpe til med å fornye IT-landskapet som start på en digital omstilling.

De har omtrent 120 applikasjoner. Rundt 90 er egenutviklet, mange av dem på en stormaskin i eget datasenter. Nye funksjoner i skadeoppgjøret tar seks til ni måneder. Skadesystemet hadde to alvorlige driftsbrudd sist kvartal. CIO-en vil ha en rask vurdering: hvor bør de begynne, og hvilke tekniske grep er aktuelle?

Du har ikke en full applikasjonsliste. Beskriv hvordan du ville vurdert landskapet, og hvordan du ville prioritert.`,
    interviewerInfo: `Slipp dette når kandidaten ber om struktur eller når de har lagt et rammeverk:
Verdikjede: avtale, skade, premie og betaling, salg, støttefunksjoner.
Skade er forretningskritisk, egenutviklet, høy smerte på stabilitet og tid til produksjon.
Premie og betaling er i stor grad hyllevare, middels smerte, dyrt å bytte.
Salg er egenutviklet, middels smerte, ikke der driftsbruddene sitter.
Støttefunksjoner er lav kritikalitet.

Ikke gi en målarkitektur med en gang. Spør hvordan de ville brukt funnene overfor CIO-en, som vil ha beslutninger og ikke en lang liste.`,
    solution: `Kartlegg applikasjonene mot verdikjeden og scor tre ting: hvor kritisk funksjonen er, hvor vond smerten er, og om systemet er egenutviklet eller hyllevare. Bruk det de allerede har: hendelseslogger, en grov systemliste og samtaler med CIO, driftsleder og to forretningsansvarlige.

Prioriter skade. Det er kritisk, ustabilt og tregt å endre. Ikke skriv om alt. Løft én kundereise ut i mindre deler som kan feile uten å ta med seg resten, kjør ny kode på en plattform der kapasitet ikke sitter i eget datasenter, og vurder hyllevare der prosessen er standard. Premiesystemet kan vente. Støttefunksjoner er ikke første året.

Lukk casen mot de to smertene CIO-en kom med: færre driftsbrudd i skade, og kortere vei til neste funksjon. Første 90 dager er kart, én avgrenset reise og en beslutning om hva som ikke skal røres.`
  },
  {
    slug: "ovnsvarme-margin",
    title: "Ovnsvarme: resultatnedgang",
    sourceKind: "single_case",
    caseStyle: "candidate_led",
    companyTags: ["consulting"],
    docSlug: "case-typer",
    prompt: `Ovnsvarme driver 40 kaféer. Omsetningen er omtrent flat mot i fjor, men driftsresultatet er ned 20 %. Daglig leder vil vite hvorfor, og hva de bør gjøre først.

Du styrer analysen. Be om det du trenger. Avslutt med en anbefaling og hva du ville sjekket før de bruker penger.`,
    interviewerInfo: `Gi bare det kandidaten spør om.
Pris per bakst er uendret. Antall kunder er uendret. Snittkjøp er uendret.
Hvetekost er opp 15 %. Svinn, målt som andel av varekost, er opp fra 4 % til 9 %, og det er verst i 8 kaféer.
Lønn er opp 5 %, drevet av turnover i de samme 8 kaféene, ikke av flere timer i de stabile kaféene.
Leie og energi er omtrent flate.
Konkurrentene har ikke hevet prisene.`,
    solution: `Resultatnedgangen sitter ikke i etterspørselen. Pris, kunder og snittkjøp er flate, så et prispåslag er en gjetning og møter et marked som ikke har flyttet seg.

Broen er varekost og svinn, pluss lønn i et mindretall av kaféene. De 8 kaféene forklarer både svinnet og turnoveren. Det peker mot drift i enkeltlokasjoner, ikke mot konseptet.

Første grep: mål svinn per kafé i to uker og sett inn de butikksjefene som allerede driver stramt, før dere forhandler hvete på nytt. Hveten er reell, men den er bransjefelles. Svinnet er deres eget. Ikke åpne nye kaféer før de 8 er på nivå med resten.`
  },
  {
    slug: "fjellpost-sverige",
    title: "Fjellpost: pakkebokser i Sverige",
    sourceKind: "single_case",
    caseStyle: "candidate_led",
    companyTags: ["consulting"],
    docSlug: "case-typer",
    prompt: `Fjellpost setter ut pakkebokser i Norge og vurderer Sverige. Ledelsen vil vite om de bør gå inn, og hva som må være sant for at det skal lønne seg.

Du styrer analysen. Anslå markedet grovt, og si hva du ville undersøkt før en investering.`,
    interviewerInfo: `Gi tall når de ber om dem, ikke før.
Sverige har omtrent 10 millioner innbyggere. Anta 2,4 pakker per person per år, vekst 8 % i året, hvis kandidaten ikke legger en egen antakelse.
Tre etablerte aktører har til sammen omtrent 70 % av hentepunktene. Resten er spredt.
En boks koster 80 000 svenske kroner å sette ut. Driftskost er 6 000 kroner i året. Bidrag per pakke som hentes i boksen er 4 kroner.
De trenger omtrent 40 % belegg på 80 luker, én henting per luke per dag, for å gå i null på driftsbidrag før kapitalkost. Du kan la kandidaten regne selv.
Regulering er ikke en stenger, men tomte- og sameieavtaler tar tid i by.`,
    solution: `Markedet er stort nok til at spørsmålet ikke er størrelse, men posisjon. 10 millioner ganger 2,4 pakker er i størrelsesorden 24 millioner pakker, og det vokser. Tre aktører sitter på mesteparten av hentepunktene, så Fjellpost vinner ikke ved å være «også en boks».

Enhetsøkonomien krever belegg. Uten et sted der boksen er det enkle valget, en avtale med en nettbutikk eller et hull i dekningen, blir 80 000 kroner per boks en lang tilbakebetaling.

Anbefaling: ikke en bred lansering. Test i to byer der de etablerte er svake, med en konkret pakkeavtale som fyller boksen fra dag én. Gå videre bare hvis belegget nærmer seg break-even innen avtalt tid. Hvis ikke, er Sverige et fint marked de ikke klarer å ta.`
  },
  {
    slug: "havlys-oppkjop",
    title: "Havlys: kjøpe nettmerket Nete",
    sourceKind: "single_case",
    caseStyle: "candidate_led",
    companyTags: ["deals", "consulting"],
    docSlug: "case-typer",
    prompt: `Havlys selger båtutstyr i butikk og på nett i Norge. De vurderer å kjøpe Nete, et mindre nettmerke med sterk lojalitet hos yngre kunder, egne returemballasjer og lav, men positiv vekst. Nete har ingen butikker, kort regnskapshistorikk og styrer mye i regneark.

Bør Havlys kjøpe, og hva må være avklart først?`,
    interviewerInfo: `Nete omsatte for 40 millioner i fjor, margin før skatt 3 %. Havlys omsatte for 600 millioner, margin 8 %.
Overlapp i kunder er lav. Nete selger et smalere, dyrere sortiment.
Nete har ingen ERP. Lageret telles manuelt. To personer kan prosessen.
Selger vil ha 6 ganger driftsresultatet. Driftsresultatet er omtrent 2 millioner, så prisen som nevnes er rundt 12 millioner før justeringer.
Ingen tall på kundefrafall. Gjenta det hvis kandidaten antar at lojaliteten er målt.`,
    solution: `Det strategiske argumentet er et kundesegment Havlys ikke har, ikke kostnadsuttak. Integrasjonen er den reelle risikoen: kunnskapen sitter i to personer og i regneark, og Havlys' systemer løser ikke Netes flyt av seg selv.

Prisen på rundt 12 millioner er liten mot Havlys, så dette er ikke en case om å tåle beløpet. Det er en case om å betale for noe som kan forsvinne i integrasjonen. Uten binding av nøkkelpersonene og en plan for lager og ordre som virker i overgangen, kjøper de en merkevare de ikke klarer å drifte.

Anbefaling: gå videre bare med en avgrenset sjekk av omsetningskvalitet, gjentakende kunder og hvem som faktisk kan driften. Strukturer prisen slik at en del henger på at de personene blir. Hvis selger ikke vil det, er merkevaren for tynn til å bære risikoen.`
  },
  {
    slug: "lesetid-pris",
    title: "Lesetid: heve månedsprisen",
    sourceKind: "single_case",
    caseStyle: "interviewer_led",
    companyTags: ["consulting"],
    docSlug: "case-typer",
    prompt: `Lesetid tar 99 kroner i måneden for et digitalt abonnement. Ledelsen vil heve prisen til 129 kroner. De har 200 000 betalende abonnenter. Variabel kostnad per abonnent er 15 kroner i måneden. Månedlig churn er 3 %.

En enkel spørreundersøkelse sier at 40 % godt kan tenke seg 129 kroner, og at 25 % sier de ville sagt opp. Hva ville du anbefalt, og hva stoler du ikke på i undersøkelsen?`,
    interviewerInfo: `Undersøkelsen er blant eksisterende abonnenter som svarte på e-post, svarprosent 12 %. Ingen test med faktisk pris.
Faste kostnader er 8 millioner kroner i måneden og endres ikke av prisen.
Nye abonnenter kommer inn med omtrent samme rate som churn i dag, så basen er stabil på 200 000 før et prishopp.
Hvis kandidaten spør: de som sier de ville sagt opp, er ikke de samme som de minst lønnsomme. Det vet selskapet ikke.`,
    solution: `Bidraget i dag er 84 kroner. Ved 129 kroner er det 114 kroner, men bare hvis kunden blir. 25 % frafall på hele basen tar volumet til 150 000 og bidraget fra omtrent 16,8 millioner til 17,1 millioner i måneden, før de faste kostnadene. Det er nesten flatt, og undersøkelsen er for svak til å bære et hopp: lav svarprosent og sagt intensjon, ikke observert oppsigelse.

Anbefaling: ikke innfør 129 for alle. Test prisen på nye kunder eller et avgrenset segment, mål faktisk churn i 60 dager, og regn på hvor stort frafall hoppet tåler. Break-even-frafallet er det nyttige tallet å legge fram, ikke gjennomsnittet fra undersøkelsen.`
  },
  {
    slug: "verksted-kapasitet",
    title: "Verkstedet: skift eller ny løftebukk",
    sourceKind: "single_case",
    caseStyle: "candidate_led",
    companyTags: ["consulting"],
    docSlug: "case-typer",
    prompt: `Et bilverksted har 6 løftebukker. Kundene venter i snitt to uker. Eieren vil vite om de skal åpne et kveldsskift eller sette inn en sjuende buk.

Etterspørselen vokser omtrent 10 % i året. Hva vil du finne ut, og hva heller du mot før du har alle tallene?`,
    interviewerInfo: `Bukkene er i bruk 85 % av åpningstiden 08–16 på hverdager. Ventetiden kommer av kø, ikke av deler.
En mekaniker dekker én buk. Det er 6 mekanikere på dagtid. Sykefravær gjør at én buk ofte står.
Kveldsskift 16–20 krever 4 mekanikere, overtidstillegg 30 %, og når omtrent halvparten av etterslepet hvis kundene faktisk kan komme etter 16. Det vet de ikke.
En ny buk koster 400 000 kroner og krever én ekstra mekaniker på dagtid. Lokalet har plass.
Deler er ikke flaskehalsen.`,
    solution: `Flaskehalsen er bemannet buktid, ikke veggene. 85 % belegg med fravær betyr at den sjuende bukkene står stille de dagene de allerede mangler en mekaniker. Mer utstyr løser ikke fravær.

Kveldsskift tester om etterspørselen faktisk ligger etter klokken 16, og det kan skrus av. En ny buk er en varig kostnad som fortsatt krever en person.

Anbefaling: mål i to uker hvor mange som ville tatt timer etter 16, og dekk fraværet med en innleid mekaniker på dagtid før dere bygger. Hvis kveldseterspørselen er reell, start med skift. Bukk nummer sju kommer etter at dagtid er stabilt bemannet.`
  },
  {
    slug: "oslo-lading",
    title: "Hvor mange ladepunkter trenger Oslo om ti år?",
    sourceKind: "single_case",
    caseStyle: "candidate_led",
    companyTags: ["consulting"],
    docSlug: "case-typer",
    prompt: `Et nettselskap spør hvor mange offentlige ladepunkter Oslo kan trenge om ti år. De vil ha størrelsesorden og hva anslaget er mest følsomt for, ikke et presist tall.

Tenk høyt. Si antakelsene før du regner.`,
    interviewerInfo: `Ikke korriger antakelser med mindre de er urimelige med en faktor ti. Oslo har i dag i underkant av en million innbyggere. La kandidaten velge elbilandel, kjørelengde og hvor stor del av ladingen som skjer hjemme.
Et fornuftig spenn i dag er at mesteparten av energien lades hjemme eller på jobb, og at offentlige punkter dekker rest, taxi og de uten egen plass.
Premisser du kan bekrefte hvis de spør: mange borettslag har ikke garasjeplass til alle, og effekt i nettet kan begrense før antall stolper gjør det.`,
    solution: `Bryt det ned: biler om ti år, andel elbil, energi per bil, andel som må lades offentlig, og energi per offentlig punkt per døgn. Runde tall holder. Avslutt med et intervall, ikke ett tall.

Følsomheten sitter i andelen som ikke kan lade hjemme, og i hvor hardt punktet brukes. Elbilandelen betyr mindre når den allerede er høy. Nettkapasitet kan gjøre «nok stolper» til feil spørsmål: det kan være effekt per gate som stopper først.

Et godt svar sier hva som ville endret anbefalingen, og hvilket tall nettselskapet bør måle neste år for å snevre intervallet.`
  }
];
