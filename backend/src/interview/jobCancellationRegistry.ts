/**
 * Explicit in-process cancellation registry.
 * Invariant: a DB row with status "running" for an import/research job must have
 * a live AbortController registered here while this process owns the work.
 */
export class JobCancellationRegistry {
  private readonly controllers = new Map<string, AbortController>();

  begin(key: string): AbortSignal {
    this.abort(key);
    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller.signal;
  }

  signalFor(key: string): AbortSignal | undefined {
    return this.controllers.get(key)?.signal;
  }

  abort(key: string): boolean {
    const existing = this.controllers.get(key);
    if (!existing) return false;
    existing.abort();
    this.controllers.delete(key);
    return true;
  }

  end(key: string): void {
    this.controllers.delete(key);
  }

  has(key: string): boolean {
    return this.controllers.has(key);
  }

  static importKey(jobId: string): string {
    return `import:${jobId}`;
  }

  static researchKey(planId: string): string {
    return `research:${planId}`;
  }

  static curateKey(planId: string): string {
    return `curate:${planId}`;
  }
}

export const RESTART_INTERRUPT_MESSAGE = "Avbrutt ved omstart, trykk Fortsett";
export const USER_CANCEL_MESSAGE = "Stoppet av bruker";
