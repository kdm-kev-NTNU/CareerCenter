export interface CompanyReportKeyFacts {
  industry?: string;
  headquarters?: string;
  size?: string;
  ownership?: string;
}

export interface CompanyReportRequirement {
  requirement: string;
  howToShowFit: string;
}

/** Typical company-specific interview question with a concrete answer angle. */
export interface CompanyQuestionPrep {
  /** Likely bedriftsspesifikt spørsmål (f.eks. «Hvorfor oss?»). */
  question: string;
  /** Hvordan svare: struktur + hvilke nisje-fakta som skal inn. */
  answerAngle: string;
  /** Korte nisje-hooks kandidaten kan bruke i svaret. */
  nicheHooks: string[];
}

export interface CompanyReport {
  headline: string;
  keyFacts: CompanyReportKeyFacts;
  aboutCompany: string;
  businessAreas: string[];
  strategyAndNews: string[];
  cultureAndValues: string[];
  roleInContext: string;
  jobAdRequirements: CompanyReportRequirement[];
  /**
   * Nisje-info som skiller dig fra generiske svar:
   * konkrete produkter, deals, strategiskift, kultur-signaler, bransjeposisjon.
   */
  nicheInsights: string[];
  /** Forslag til svar på bedriftsspesifikke spørsmål, basert på nisje-info. */
  companyQuestionPrep: CompanyQuestionPrep[];
  interviewAngles: string[];
  questionsToAsk: string[];
  sources: string[];
}

export const emptyCompanyReport = (): CompanyReport => ({
  headline: "",
  keyFacts: {},
  aboutCompany: "",
  businessAreas: [],
  strategyAndNews: [],
  cultureAndValues: [],
  roleInContext: "",
  jobAdRequirements: [],
  nicheInsights: [],
  companyQuestionPrep: [],
  interviewAngles: [],
  questionsToAsk: [],
  sources: []
});
