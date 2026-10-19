import path from "node:path";
import { unlink } from "node:fs/promises";

export const analyzerUploadDir = path.resolve(
  process.env.ANALYZER_UPLOAD_DIR || path.join(process.cwd(), "uploads", "analyzer"),
);

export function isAnalyzerUploadPath(filePath: unknown): filePath is string {
  if (typeof filePath !== "string" || !filePath) return false;
  const resolved = path.resolve(filePath);
  return resolved.startsWith(`${analyzerUploadDir}${path.sep}`);
}

export async function deleteAnalyzerUploads(...files: Array<string | undefined>) {
  await Promise.all(files.filter(isAnalyzerUploadPath).map((file) => unlink(file).catch(() => {})));
}
