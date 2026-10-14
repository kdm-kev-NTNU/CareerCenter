import type { CaseSourceKind, CaseStyle, KnowledgeDocKind } from "@careercenter/shared";

export interface BibleDocSeed {
  slug: string;
  kind: KnowledgeDocKind;
  title: string;
  sourceFilename: string;
  content: string;
}

export interface BibleCaseSeed {
  slug: string;
  title: string;
  prompt: string;
  interviewerInfo: string;
  solution: string;
  sourceKind: CaseSourceKind;
  caseStyle: CaseStyle;
  companyTags: string[];
  docSlug: string;
}
