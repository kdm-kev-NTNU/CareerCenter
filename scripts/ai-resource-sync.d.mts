export interface SyncFilePlan {
  path: string;
  action: string;
  message?: string;
}

export interface SyncRejected {
  path?: string;
  message: string;
}

export interface SyncConflict {
  path: string;
  message: string;
}

export interface SyncExportFile {
  path: string;
  content: string;
  writeStrategy?: string;
}

export interface SyncExportBundle {
  files?: SyncExportFile[];
}

export interface SyncAiResourcesOptions {
  apiUrl?: string;
  target?: string;
  cwd?: string;
  yes?: boolean;
  force?: boolean;
  backup?: boolean;
  now?: string;
  name?: string;
  pin?: string;
  bundle?: SyncExportBundle;
  fetchFn?: typeof fetch;
}

export interface SyncAiResourcesResult {
  target: string;
  cwd: string;
  dryRun: boolean;
  manifestPath: string;
  backupRoot: string | null;
  files: SyncFilePlan[];
  conflicts: SyncConflict[];
  rejected: SyncRejected[];
}

export function syncAiResources(options?: SyncAiResourcesOptions): Promise<SyncAiResourcesResult>;

export function runCli(
  argv?: string[],
  io?: { stdout: { write: (chunk: string) => void } }
): Promise<{ exitCode: number }>;
