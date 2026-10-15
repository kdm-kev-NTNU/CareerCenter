/** Definitions shared by the question cleanup agent and the LLM question extraction prompt. */

export const audienceDefinitions: string[] = [
  "Hvem stiller spørsmålet (audience):",
  "- candidate: et spørsmål en intervjuer stiller kandidaten, og som kandidaten kan øve på å svare på. Står ofte med «Ser etter:» og «Vinkling:» under seg.",
  "- ask_interviewer_company: et spørsmål kandidaten stiller intervjueren om selskapet, rollen, teamet, arbeidsmåter eller prosessen («Hvordan jobber dere med KI internt?», «Hva er neste steg i prosessen?»).",
  "- ask_interviewer_personal: et spørsmål kandidaten stiller intervjueren om personens egen erfaring, valg og opplevelser («Hva overrasket deg mest det første året ditt her?», «Hva gjorde at du ble værende?»). Kjennetegn: «du/deg/din» handler om intervjueren selv.",
  "- Overskriften avgjør retningen. Alt under overskrifter som «Spørsmål du stiller dem», «Spørsmål du stiller en partner» eller «spørsmålene du skal stille» er spørsmål kandidaten stiller, selv om teksten alene kunne vært stilt til kandidaten. Skill deretter mellom personal og company ut fra hvem spørsmålet handler om."
];

export const categoryDefinitions: string[] = [
  "Kategori (category) for audience candidate:",
  "- behavioral: atferd/STAR. Ber om noe kandidaten faktisk har opplevd («Fortell om en gang …», «Gi et eksempel på …», «Describe a time …»).",
  "- situational: hypotetisk scenario som besvares med fremgangsmåte («Hva ville du gjort hvis …», «Du oppdager en feil … Hva gjør du?»).",
  "- motivation: hvorfor bransjen, rollen eller selskapet, og ambisjoner («Hvorfor konsulent?», «Hvor ser du deg selv om fem år?»).",
  "- personal: introduksjon, personlighet, styrker og svakheter, fritid, hvordan andre beskriver kandidaten, hvordan kandidaten liker å få tilbakemeldinger.",
  "- technical: faglige og tekniske spørsmål om teknologi, metode, prosjekter og fagkunnskap («Hvordan fungerer RAG?»).",
  "- case: en caseoppgave eller et forretningsproblem som skal løses i intervjuet.",
  "- brainteaser: estimering, gjettestykker og hoderegning («Hvor mange ladestasjoner finnes i Norge?»).",
  "- company: kunnskap om akkurat dette selskapet («Hva vet du om oss?», «Hva er fordelene og ulempene med plattformen vår?»).",
  "For ask_interviewer_company bruker du category company, og for ask_interviewer_personal category personal."
];

export const nonQuestionDefinitions: string[] = [
  "Ikke et intervjuspørsmål:",
  "- instruks_til_intervjuer: instruks til intervjueren, øvingspartneren eller KI-boten («Spør alltid \"kan du nevne en til?\"», «Still minst tre oppfølginger: …», «Hvilken modus vil du øve på …?»).",
  "- tips: råd til kandidaten der spørsmålet bare er et eksempel i en setning («Ha alltid de to andre i bakhånd. «Kan du nevne en til?» er et vanlig oppfølgingsspørsmål …»).",
  "- selvrefleksjon: spørsmål kandidaten skal tenke over alene under forberedelsene («Er det en tilbakemelding du husker fordi den irriterte deg?»).",
  "- mal: svarmal, standardsvar, e-postmal eller utfyllingsfelt («Det har jeg ikke jobbet direkte med … Stemmer den forståelsen?», «Har du et kvarter i løpet av uken …?»).",
  "- duplikat: samme spørsmål som et tidligere i listen, med nesten lik ordlyd.",
  "- ikke_sporsmal: alt annet som ikke er et intervjuspørsmål."
];
