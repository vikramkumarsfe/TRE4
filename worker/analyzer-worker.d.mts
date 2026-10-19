export interface AnalyzerJob {
  runId: string;
  userId: string;
  answerPath: string;
  keyPath?: string;
}

export function analyzeAnalyzerJob(job: AnalyzerJob): Promise<unknown>;
