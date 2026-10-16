/** Persisted CV / transcript / notes used for company-report answer suggestions. */
export interface CandidateBackgroundDto {
  cvText: string;
  cvFileName: string;
  cvUpdatedAt: string | null;
  transcriptText: string;
  transcriptFileName: string;
  transcriptUpdatedAt: string | null;
  notes: string;
  updatedAt: string | null;
}

export const emptyCandidateBackground = (): CandidateBackgroundDto => ({
  cvText: "",
  cvFileName: "",
  cvUpdatedAt: null,
  transcriptText: "",
  transcriptFileName: "",
  transcriptUpdatedAt: null,
  notes: "",
  updatedAt: null
});

/** True when the user has uploaded a CV with extractable text. */
export function hasCandidateCv(background: CandidateBackgroundDto): boolean {
  return background.cvText.trim().length > 0;
}
