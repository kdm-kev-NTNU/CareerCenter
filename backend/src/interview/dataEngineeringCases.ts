import type { BibleCaseSeed } from "./bibleTypes.js";

export const dataEngineeringCases = [
  {
    "slug": "data-01",
    "title": "Tallet stemmer ikke",
    "prompt": "Tallet stemmer ikke\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nFeilsøking, forretningsforståelse og kommunikasjon.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvordan definerer de «aktiv kunde»? Siste 30 dager, minst én transaksjon, åpen konto?\nHvilken periode og hvilket tidspunkt er tallene hentet ut?\nHar avviket alltid vært der, eller oppstod det nylig?\n\nOppfølging du kan stille:\n«Hva om begge tallene viser seg å være riktige etter hver sin definisjon?»\n«Hvem bør bestemme hvilken definisjon som gjelder?»\n\nFallgruve:\nÅ anta at ditt eget tall er riktig, eller å begynne å endre kode før du vet hva som er forskjellig.",
    "solution": "Den vanligste årsaken er ulike definisjoner, ikke teknisk feil. Start der.\nDeretter tekniske hypoteser: duplikater, ulik tidsavgrensning, ulike filtre (bedriftskunder med eller ikke) eller forsinket data.\nSammenlign på kundenivå: hvilke kunder finnes bare i den ene listen? Da ser du mønsteret raskt.\nAvklar hvem som eier definisjonen, og dokumenter den.\nForebygg: én felles definisjon i et dataprodukt i stedet for at hvert team regner ut sin egen.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-02",
    "title": "Summen ble tre ganger så stor",
    "prompt": "Summen ble tre ganger så stor\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nForståelse av joins og fan-out, uten at du må skrive SQL.\n\nAvklaringsspørsmål kandidaten bør stille:\nKan én kunde ha flere kontoer?\nHva representerer én rad i kontotabellen?\n\nOppfølging du kan stille:\n«Hvorfor ikke bare fjerne duplikatene med DISTINCT?»\n«Hvordan ville du oppdaget dette hvis summen bare økte med 3 %?»\n\nFallgruve:\nÅ legge på DISTINCT for å få tallet til å se riktig ut. Det skjuler feilen i stedet for å løse den.",
    "solution": "Nesten helt sikkert fan-out: kunder med flere kontoer får sine transaksjoner gjentatt én gang per konto.\nVerifiser: tell rader før og etter koblingen.\nLøsning: summer per kunde først og koble etterpå, eller koble på riktig nøkkel (kontonummer).\nForebygg: en test som sjekker at det er én rad per kunde i den ferdige tabellen.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-03",
    "title": "Pipelinen feilet i natt",
    "prompt": "Pipelinen feilet i natt\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nPrioritering under press, kommunikasjon og integritet.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvem bruker rapporten, og hva skjer hvis den er én dag gammel?\nHva sier feilmeldingen? Har det skjedd før?\nHvem eier pipelinen eller kilden?\n\nOppfølging du kan stille:\n«Lederen ringer og vil ha tallene uansett. Hva sier du?»\n«Du klarer ikke å finne feilen alene. Hva gjør du?»\n\nFallgruve:\nÅ presse ut en rapport man ikke har kontroll på. I en bank er feil tall til ledelsen verre enn forsinkede tall.",
    "solution": "Varsle tidlig: si fra til brukerne at tallene kan bli forsinket. Gårsdagens tall tydelig merket er bedre enn feil tall.\nFinn ut hvor den feilet: uthenting (kilden nede, tilgang utløpt), lasting eller transformasjon (endret format, en datatest slo ut).\nStoppet en datatest jobben, har testen gjort jobben sin. Ikke skru den av for å få rapporten ut.\nKjør på nytt når årsaken er fikset. Jobben bør tåle omkjøring uten duplikater.\nEtterpå: kort gjennomgang og bedre varsling.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-04",
    "title": "Duplikate transaksjoner",
    "prompt": "Duplikate transaksjoner\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nDatakvalitet, forsiktighet og forretningsforståelse.\n\nAvklaringsspørsmål kandidaten bør stille:\nFinnes det en unik transaksjons-ID fra kilden?\nKan det være to legitime, like kjøp samme dag, for eksempel to kaffer på 49 kr?\n\nOppfølging du kan stille:\n«Hvor mange rapporter kan ha vist feil tall? Hva gjør du med det?»\n\nFallgruve:\nÅ fjerne duplikater basert på beløp og dato alene, og dermed slette ekte kjøp.",
    "solution": "Ikke slett før du vet om det er ekte duplikater. To like kjøp samme dag kan være helt reelle.\nHar radene samme transaksjons-ID, er det en teknisk feil.\nFinn årsaken: ble en lasting kjørt to ganger? Sendte kilden samme fil på nytt?\nFjern duplikatene basert på ID, og behold én.\nForebygg: en test på unik ID og en lasting som tåler omkjøring.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-05",
    "title": "Plutselig halvparten så mye data",
    "prompt": "Plutselig halvparten så mye data\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nOm du stoler blindt på at «grønt» betyr riktig, og om du tenker på volum som et kvalitetssignal.\n\nAvklaringsspørsmål kandidaten bør stille:\nEr det en helligdag, helg eller noe annet som kan forklare det?\nGjelder det alle banker eller bare én?\nKom hele filen fra kilden, eller ble den avbrutt?\n\nOppfølging du kan stille:\n«Hvor stort avvik synes du bør gi varsel?»\n«Hva om det viser seg å være riktig?»\n\nFallgruve:\nÅ ikke reagere fordi pipelinen var grønn.",
    "solution": "En jobb uten feilmelding betyr ikke at dataene er riktige.\nSjekk først forretningsforklaringer: helligdag, systemstans hos kilden.\nBryt ned på bank, kanal eller time for å se hvor dataene mangler.\nHvis det er en ufullstendig leveranse: kontakt kildeeier og last på nytt når komplett fil finnes.\nForebygg: en automatisk volumsjekk som varsler ved store avvik fra normalen.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-06",
    "title": "Kolonnen skiftet navn",
    "prompt": "Kolonnen skiftet navn\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nOm du ser rotårsaken og ikke bare symptomet.\n\nAvklaringsspørsmål kandidaten bør stille:\nVar endringen varslet? Er det andre endringer samtidig?\nEr innholdet det samme, eller har også enheten endret seg (øre vs kroner)?\n\nOppfølging du kan stille:\n«Hvordan ville du oppdaget det hvis navnet var det samme, men enheten endret?»\n\nFallgruve:\nÅ fikse navnet uten å sjekke om betydningen også har endret seg.",
    "solution": "Ja, oppdater koden, men sjekk først at innholdet er det samme. Et navnebytte kan skjule en enhetsendring.\nSjekk hvilke rapporter og tabeller lenger ned i flyten som påvirkes.\nRotårsaken er manglende avtale med kildeeier. Foreslå at endringer varsles på forhånd (en «datakontrakt»).\nAt pipelinen feilet høyt er bra. Det verste er en endring som glir gjennom stille og gir feil tall.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-07",
    "title": "Tallene for i går er feil hver mandag",
    "prompt": "Tallene for i går er feil hver mandag\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nMønstergjenkjenning og hypotesetenkning.\n\nAvklaringsspørsmål kandidaten bør stille:\nHva betyr «rar»: for lite data, for mye, eller feil fordeling?\nKjører jobben i helgene?\nLeverer kilden data i helgene?\n\nOppfølging du kan stille:\n«Hvordan forklarer du dette for brukeren uten tekniske ord?»\n\nFallgruve:\nÅ starte med å lese all koden i stedet for å bruke mønsteret som ledetråd.\n4. Mini-cases B: Krav, forretning og prioritering",
    "solution": "Et mønster knyttet til en ukedag peker mot tidspunkt og planlegging, ikke tilfeldige feil.\nHypoteser: jobben kjører ikke i helgen, kilden leverer helgedata først mandag, eller tidssone gjør at transaksjoner havner på feil dag.\nSjekk den enkleste først: når kjørte jobben, og hvor mye data kom inn per dag?\nForebygg: dokumenter når dataene er komplette, og vis «sist oppdatert» i rapporten.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-08",
    "title": "Vag bestilling",
    "prompt": "Vag bestilling\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nKravavklaring og evnen til å finne det egentlige behovet.\n\nAvklaringsspørsmål kandidaten bør stille:\nHva skal tabellen brukes til? Hvilken beslutning skal den støtte?\nHvem skal bruke den, og hvordan?\nHvilken periode, og hvor ofte må den oppdateres?\nTrenger de kundenivå, eller holder aggregerte tall? (personvern)\n\nOppfølging du kan stille:\n«Produkteieren sier: bare lag den, vi finner ut av det senere. Hva gjør du?»\n\nFallgruve:\nÅ bygge en stor tabell som ikke svarer på det de egentlig lurte på.",
    "solution": "Spør etter formålet. Det endrer ofte hele løsningen.\nLever en liten første versjon raskt og få tilbakemelding før du bygger mer.\nAggregerte tall er ofte både enklere og tryggere enn data per kunde.\nAvklar hvem som eier kategoriseringen.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-09",
    "title": "To team, to definisjoner",
    "prompt": "To team, to definisjoner\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nSamarbeid, nøytralitet og forståelse av at data handler om felles språk.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvorfor trenger de ulike definisjoner? Er begge legitime for sitt formål?\nFinnes det en overordnet eier av begrepene?\n\nOppfølging du kan stille:\n«Hva hvis lederen din sier at du må velge én?»\n\nFallgruve:\nÅ velge side eller ta beslutningen på egen hånd uten å involvere de som eier begrepet.",
    "solution": "Begge kan ha rett. Markedsføring og risiko har ulike behov.\nLøsning kan være å lage to tydelig navngitte mål, for eksempel «aktiv_markedsføring» og «aktiv_risiko», i stedet for å velge en vinner.\nDokumenter begge definisjonene der folk finner dem.\nLøft spørsmålet om felles definisjon til den som eier begrepene, i stedet for å avgjøre det selv som sommerstudent.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-10",
    "title": "Lederen vil ha tallet i dag",
    "prompt": "Lederen vil ha tallet i dag\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nIntegritet under press og forventningsstyring.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvor presist må tallet være for beslutningen?\nHvor usikker er jeg egentlig, og hvorfor?\n\nOppfølging du kan stille:\n«Lederen sier forbeholdet ser dårlig ut i et styremøte. Hva svarer du?»\n\nFallgruve:\nÅ levere tallet uten forbehold fordi det haster.",
    "solution": "Gjør en rask fornuftssjekk: stemmer størrelsesorden med tidligere tall og en uavhengig kilde?\nLever med tydelig forbehold («foreløpig, ikke kvalitetssikret, kan avvike med ...»), eller avtal kort utsettelse.\nAldri presenter usikre tall som sikre.\nFølg opp med det kvalitetssikrede tallet etterpå.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-11",
    "title": "Åtte uker, mange idéer",
    "prompt": "Åtte uker, mange idéer\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nSamarbeid, forretningsforståelse og evnen til å levere noe ferdig.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvem er brukerne, og hvilket problem er størst for dem?\nHvilke data har vi tilgang til nå?\nHva vil oppdragsgiver se på demoen?\n\nOppfølging du kan stille:\n«Teamet er uenig om hvilken idé som er best. Hvordan løser dere det?»\n\nFallgruve:\nÅ velge den teknisk mest spennende idéen uten å sjekke om dataene finnes eller om noen trenger den.",
    "solution": "Vurder idéene på verdi (hvor stort problem den løser) og gjennomførbarhet (data, tid, kompetanse).\nVelg én, lag en liten fungerende versjon tidlig og bygg videre. En ferdig liten løsning slår en halvferdig stor.\nSjekk datatilgang tidlig. I en bank kan det ta tid, og det er ofte den største risikoen.\nAvtal hyppig tilbakemelding med veileder og brukere.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-12",
    "title": "Ingen bruker dashboardet",
    "prompt": "Ingen bruker dashboardet\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nBrukerfokus og evnen til å se på data som et produkt.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvem var det laget for, og hvilket behov skulle det dekke?\nVet de at det finnes?\nHar noen sagt hvorfor de ikke bruker det?\n\nOppfølging du kan stille:\n«Hva lærer du av dette til neste gang dere lager noe?»\n\nFallgruve:\nÅ legge til flere grafer i håp om at det blir mer brukt.\n5. Mini-cases C: Design og flyt av data",
    "solution": "Ikke start med å bygge mer. Snakk med brukerne først.\nMulige årsaker: de vet ikke om det, de stoler ikke på tallene, det svarer på feil spørsmål, eller det er vanskelig å bruke.\nHver årsak gir ulik løsning: synliggjøring, kvalitetssikring, ny innretning eller forenkling.\nDet kan også være riktig å legge det ned. Ubrukte løsninger koster vedlikehold.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-13",
    "title": "Ny datakilde",
    "prompt": "Ny datakilde\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nStrukturert tankegang fra kilde til ferdig data, altså ETL/ELT i praksis.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvilket format og hvor mye data? Hvor ofte?\nKommer hele datasettet hver gang, eller bare endringer?\nInneholder den personopplysninger?\nHvem eier kilden?\n\nOppfølging du kan stille:\n«Hvorfor lagre rådataene i det hele tatt?»\n«Hva gjør du hvis filen en natt ikke kommer?»\n\nFallgruve:\nÅ hoppe rett til den ferdige tabellen uten å bevare eller undersøke rådataene.",
    "solution": "Utforsk først (EDA): hva betyr kolonnene, hva er unik nøkkel, finnes det mangler og rare verdier?\nLast rått inn uendret (f.eks. fra S3 til Snowflake), så du alltid kan gå tilbake.\nTransformer stegvis: rens, fjern duplikater, koble mot eksisterende data.\nTest unikhet, tomme felt og forventet volum.\nDokumenter og avtal med kildeeier hvordan endringer varsles.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-14",
    "title": "Forbruksoversikt i appen",
    "prompt": "Forbruksoversikt i appen\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nHelhetsforståelse og evnen til å tenke ende til ende uten å drukne i detaljer.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvor ligger transaksjonene i dag, og hvordan kategoriseres de?\nHvor ferskt må det være?\nHvordan skal appen hente tallene?\n\nOppfølging du kan stille:\n«Hva om kunden mener en transaksjon har fått feil kategori?»\n«Hva om de vil ha det i sanntid?»\n\nFallgruve:\nÅ starte med verktøyvalg. Start med flyten og kravene.",
    "solution": "Kilde: transaksjoner fra kjernesystemet.\nHent og last: daglig batch inn i et rålag i varehuset.\nTransformer: rens, fjern duplikater, koble på kategori, summer til én rad per kunde, måned og kategori.\nKvalitet: summene stemmer mot kilden, alle transaksjoner har kategori (eller «annet»).\nLever: en ferdig tabell eller et API som appen leser fra, med streng tilgangsstyring.\nAvslutt med avveiningen: batch holder fordi kundene ser på månedstall.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-15",
    "title": "Manuell Excel-rapport",
    "prompt": "Manuell Excel-rapport\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nOm du ser forbedringsmuligheter og forstår gevinsten av automatisering.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvem leser rapporten, og hva brukes den til?\nHvilke tre systemer, og har vi tilgang til dataene?\nGjør hun manuelle vurderinger underveis som må bevares?\n\nOppfølging du kan stille:\n«Er dette verdt å automatisere hvis rapporten bare lages én gang i kvartalet?»\n\nFallgruve:\nÅ bygge en automatisk løsning uten å forstå de manuelle vurderingene hun gjør.",
    "solution": "Kartlegg dagens prosess steg for steg før du automatiserer. Ofte ligger det skjulte regler i hodet til den som gjør jobben.\nAutomatiser i små steg: først uthentingen, så beregningene, til slutt leveransen.\nKjør gammel og ny løsning parallelt noen uker og sammenlign tallene.\nGevinst: tid spart, færre manuelle feil og mulighet til å oppdatere oftere.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-16",
    "title": "«Vi vil ha det i sanntid»",
    "prompt": "«Vi vil ha det i sanntid»\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nOm du utfordrer krav konstruktivt og forstår at enkelhet har verdi.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvilken beslutning blir bedre av at tallet er minutter gammelt i stedet for timer?\nHvor ofte ser noen på rapporten?\n\nOppfølging du kan stille:\n«Produkteieren insisterer. Hva gjør du?»\n\nFallgruve:\nÅ si ja uten å spørre hvorfor, eller nei uten å forstå behovet.\n6. Mini-cases D: Personvern, samarbeid og integritet",
    "solution": "Sanntid er mer komplisert og dyrere å bygge og drifte.\nOfte løser «hver time» eller «hver morgen før kl. 8» det egentlige behovet.\nHvis det finnes et reelt sanntidsbehov (f.eks. svindel), er det verdt kostnaden.\nForeslå å starte enkelt og øke frekvensen hvis behovet viser seg.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-17",
    "title": "Fødselsnummer i datasettet",
    "prompt": "Fødselsnummer i datasettet\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nPersonvernforståelse og mot til å si ifra.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvem har tilgang til datasettet?\nFinnes det et behov for identifikatorene i analysen?\nHvem er riktig person å ta dette opp med?\n\nOppfølging du kan stille:\n«Teamet sier det alltid har vært slik. Hva gjør du?»\n\nFallgruve:\nÅ la det ligge fordi det «ikke er din oppgave».",
    "solution": "Prinsippet er dataminimering: hent bare det formålet krever. En intern kunde-ID holder ofte.\nSi ifra til teamet og veileder, sakelig og uten å peke på skyldige.\nMulige tiltak: fjerne kolonnene, erstatte med pseudonyme ID-er, eller maskere dem for de som ikke trenger dem.\nVed tvil: involver personvernansvarlig.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-18",
    "title": "Du har gjort en feil",
    "prompt": "Du har gjort en feil\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nIntegritet, ansvar og kommunikasjon.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvor stor er feilen, og hvem har brukt tallene?\nHar noen tatt beslutninger basert på dem?\n\nOppfølging du kan stille:\n«Hvorfor ikke bare rette det stille, når ingen har lagt merke til det?»\n\nFallgruve:\nÅ skjule feilen. I data er tillit det viktigste du har.",
    "solution": "Si ifra raskt og åpent til veileder og brukerne. Ikke rett det i stillhet.\nForklar hva som var feil, hvilke perioder som er berørt og når riktig tall er på plass.\nRett feilen og legg til en test som fanger den neste gang.\nFokus på læring, ikke skyld.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-19",
    "title": "Uenig med en senior",
    "prompt": "Uenig med en senior\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nKommunikasjon, ydmykhet og evne til å si ifra konstruktivt.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvilke hensyn ligger bak forslaget som jeg kanskje ikke ser?\n\nOppfølging du kan stille:\n«Hva om det viser seg at du hadde rett?»\n\nFallgruve:\nÅ enten tie helt, eller å kjøre over en erfaren kollega uten å forstå begrunnelsen.",
    "solution": "Start med å forstå: spør hvorfor den løsningen er valgt. Det kan finnes gode grunner du ikke kjenner til.\nHvis du fortsatt er uenig: legg frem alternativet ditt med begrunnelse, gjerne som et spørsmål («Hva om vi ...?»).\nBruk fakta, ikke meninger: tid, kostnad, vedlikehold.\nGodta beslutningen hvis den går imot deg, og bidra fullt ut.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  },
  {
    "slug": "data-20",
    "title": "Du får ikke tilgang til dataene",
    "prompt": "Du får ikke tilgang til dataene\n\nDette er en muntlig mini-case. Du får lite informasjon med vilje. Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang.",
    "interviewerInfo": "Hva de tester:\nInitiativ, tålmodighet og evnen til å holde fremdrift tross hindringer.\n\nAvklaringsspørsmål kandidaten bør stille:\nHvem kan påvirke tilgangen, og vet de at det haster?\nFinnes det testdata eller syntetiske data vi kan bruke i mellomtiden?\n\nOppfølging du kan stille:\n«Hva hvis tilgangen ikke kommer før uke fem?»\n\nFallgruve:\nÅ vente passivt, eller å forsøke å omgå tilgangskontrollen.",
    "solution": "Si ifra til veileder tidlig, så de kan hjelpe med å eskalere.\nBruk ventetiden: bygg pipelinen og testene på syntetiske eller anonymiserte data, så dere er klare når tilgangen kommer.\nGjør forarbeid: kravavklaring, design, dokumentasjon.\nForstå at tilgangsstyring i en bank finnes av gode grunner.",
    "sourceKind": "mini_cases",
    "caseStyle": "interviewer_led",
    "companyTags": [
      "data",
      "bank"
    ],
    "docSlug": "data-rammeverk"
  }
] as BibleCaseSeed[];
