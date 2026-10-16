/** Typical company-specific interview question with a concrete answer draft. */
export interface CompanyQuestionPrep {
  /** Likely bedriftsspesifikt spørsmål (f.eks. «Hvorfor oss?»). */
  question: string;
  /** Hva intervjueren egentlig tester. */
  whyTheyAsk: string;
  /** Utkast i jeg-form, cirka 60–120 ord. */
  suggestedAnswer: string;
  /** Hvilke CV- og karakterfakta svaret bruker. */
  backgroundUsed: string[];
  /** Hvilke bedriftsfakta svaret bruker. */
  companyHooks: string[];
}

export interface QuestionToAsk {
  question: string;
  /** Hvorfor spørsmålet er lurt å stille. */
  why: string;
}

export interface CompanyReport {
  headline: string;
  /** Korte fakta svarene bygger på. */
  mustKnow: string[];
  /** Forslag til svar på bedriftsspesifikke spørsmål. */
  questionPrep: CompanyQuestionPrep[];
  /** Lure spørsmål kandidaten kan stille dem. */
  questionsToAsk: QuestionToAsk[];
  sources: string[];
}

export const emptyCompanyReport = (): CompanyReport => ({
  headline: "",
  mustKnow: [],
  questionPrep: [],
  questionsToAsk: [],
  sources: []
});
