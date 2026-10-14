import type { InterviewPrepRepository } from "../interviewPrepRepository.js";
import { RESTART_INTERRUPT_MESSAGE } from "./jobCancellationRegistry.js";

/** Mark in-flight jobs/plans as failed after process restart (no live AbortController). */
export async function recoverInterruptedJobs(repository: InterviewPrepRepository): Promise<{
  importJobs: number;
  prepPlans: number;
}> {
  const [importJobs, prepPlans] = await Promise.all([
    repository.failInterruptedImportJobs(RESTART_INTERRUPT_MESSAGE),
    repository.failInterruptedPrepPlans(RESTART_INTERRUPT_MESSAGE)
  ]);
  return { importJobs, prepPlans };
}
