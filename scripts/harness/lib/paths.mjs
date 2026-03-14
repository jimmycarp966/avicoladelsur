import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const REPO_ROOT = path.resolve(currentDir, "../../..");

export function resolveRepoPath(relativePath) {
  return path.resolve(REPO_ROOT, relativePath);
}

export function getDefaultProfilePath() {
  return resolveRepoPath(".harness/profile.yaml");
}

export function getDefaultSchemaPath() {
  return resolveRepoPath(".harness/profile.schema.yaml");
}

export function getDefaultExamplePath() {
  return resolveRepoPath(".harness/profile.example.yaml");
}

export function getCoreSourcePath() {
  return resolveRepoPath("tools/harness-core");
}

export function getGlobalCorePath() {
  const homeDir = process.platform === "win32" ? process.env.USERPROFILE || os.homedir() : os.homedir();
  return path.join(homeDir, ".agents", "harness-core");
}

export function toRunDir(runId) {
  return resolveRepoPath(path.join(".harness", "runs", runId));
}

export function toMaintenanceReportDir(reportId) {
  return resolveRepoPath(path.join(".harness", "maintenance", "reports", reportId));
}

export function toMaintenanceProposalDir() {
  return resolveRepoPath(path.join(".harness", "maintenance", "proposals"));
}
