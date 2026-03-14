#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseArgs, toBool, toNumber } from "../lib/args.mjs";
import { createLogger } from "../lib/logger.mjs";
import { REPO_ROOT, getDefaultProfilePath, toMaintenanceProposalDir, toMaintenanceReportDir } from "../lib/paths.mjs";
import { readYamlFile } from "../lib/profile.mjs";
import { runShellCommand } from "../lib/process.mjs";
import { ensureDir, writeJson, writeText } from "../lib/fs-utils.mjs";
import { evaluateBranchPolicy, getCurrentBranch } from "../lib/guardrails.mjs";
import { HarnessError } from "../lib/errors.mjs";
import { ERROR_CODES } from "../lib/constants.mjs";
import { nowRunId, printHandledError, resolveLogFile } from "../lib/runtime.mjs";
import { isDirectExecution } from "../lib/entrypoint.mjs";

function listOldRunDirs(retentionDays) {
  const baseDir = path.resolve(REPO_ROOT, ".harness", "runs");
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const full = path.resolve(baseDir, entry.name);
      const stat = fs.statSync(full);
      return {
        name: entry.name,
        path: full,
        mtimeMs: stat.mtimeMs,
      };
    })
    .filter((entry) => entry.mtimeMs < threshold);
}

async function ensureMaintenanceBranch(profile, logger, createBranch) {
  const current = getCurrentBranch();
  const policy = evaluateBranchPolicy(current, profile);
  if (!policy.allowed) {
    throw new HarnessError(
      ERROR_CODES.BRANCH_PROTECTED,
      policy.reason,
      "Switch to the branch required by profile.branches.mode before running maintenance.",
      { currentBranch: current, policy }
    );
  }

  const prefix = profile?.branches?.prefix || "codex/";
  const branchName = `${prefix}maintenance-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  if (!createBranch) {
    return {
      current,
      target: current,
      created: false,
      switched: false,
      policy,
    };
  }

  if (policy.mode === "main-only") {
    throw new HarnessError(
      ERROR_CODES.BRANCH_PROTECTED,
      "Branch creation is disabled by main-only policy during maintenance.",
      "Run with --create-branch=false, or change profile.branches.mode if your workflow requires feature branches.",
      { currentBranch: current, policy }
    );
  }

  if (current === branchName) {
    return {
      current,
      target: branchName,
      created: false,
      switched: true,
      policy,
    };
  }

  let created = false;
  try {
    await runShellCommand(`git checkout -b ${branchName}`, {
      cwd: REPO_ROOT,
      logger,
      allowFailure: false,
    });
    created = true;
  } catch (_error) {
    await runShellCommand(`git checkout ${branchName}`, {
      cwd: REPO_ROOT,
      logger,
      allowFailure: false,
    });
  }

  return {
    current,
    target: branchName,
    created,
    switched: true,
    policy,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonMode = toBool(args.json, false);
  const profilePath = path.resolve(String(args.profile || getDefaultProfilePath()));
  const profile = readYamlFile(profilePath, null);
  const reportId = nowRunId("maintenance");
  const reportDir = toMaintenanceReportDir(reportId);
  const logFile = resolveLogFile(args, path.resolve(reportDir, "maintenance.log"));
  const logger = createLogger({ json: jsonMode, logFile });

  if (!profile) {
    throw new Error("Profile missing. Run harness-init first.");
  }

  ensureDir(reportDir);

  const retentionDays = toNumber(profile?.maintenance?.retention_days, 14);
  const oldRuns = listOldRunDirs(retentionDays);

  const todoScan = await runShellCommand(
    "rg -n \"TODO|FIXME|HACK\" src scripts docs .harness --glob \"!**/node_modules/**\"",
    {
      cwd: REPO_ROOT,
      logger,
      allowFailure: true,
    }
  );

  const gitStatus = await runShellCommand("git status --short", {
    cwd: REPO_ROOT,
    logger,
    allowFailure: true,
  });

  const defaultCreateBranch = profile?.branches?.mode === "main-only" ? false : true;
  const createBranch = toBool(args["create-branch"], defaultCreateBranch);
  const branchInfo = await ensureMaintenanceBranch(profile, logger, createBranch);

  const branch = getCurrentBranch();
  const branchPolicy = evaluateBranchPolicy(branch, profile);
  const drift = {
    timestamp: new Date().toISOString(),
    branch,
    branchPolicy,
    gitStatus: gitStatus.stdout.trim(),
    todoFindings: todoScan.stdout.trim(),
    oldRunDirectories: oldRuns,
    branchInfo,
  };

  writeJson(path.resolve(reportDir, "drift-report.json"), drift);

  const reportMarkdown = [
    "# Harness Drift Report",
    "",
    `- Timestamp: ${drift.timestamp}`,
    `- Current branch: ${drift.branch}`,
    `- Branch policy mode: ${drift.branchPolicy.mode}`,
    `- Branch policy allowed: ${drift.branchPolicy.allowed}`,
    `- Old run directories (> ${retentionDays} days): ${oldRuns.length}`,
    "",
    "## Git status",
    "```",
    drift.gitStatus || "(clean)",
    "```",
    "",
    "## TODO/FIXME/HACK scan",
    "```",
    drift.todoFindings || "(none)",
    "```",
    "",
    "## Cleanup proposal",
    `- Proposed branch: ${branchInfo.target}`,
    `- Branch created/switch: ${branchInfo.created || branchInfo.switched ? "yes" : "no"}`,
    "- Proposed actions:",
    "  - archive or delete stale run directories",
    "  - resolve TODO/FIXME/HACK hotspots",
    "  - rerun harness-validate and harness-qa-check",
    "  - open PR with cleanup evidence bundle",
  ].join("\n");

  writeText(path.resolve(reportDir, "drift-report.md"), reportMarkdown);

  const proposalDir = toMaintenanceProposalDir();
  ensureDir(proposalDir);
  const proposalPath = path.resolve(proposalDir, `${reportId}-cleanup-pr.md`);
  writeText(
    proposalPath,
    [
      "# Cleanup PR Proposal",
      "",
      `- Generated at: ${drift.timestamp}`,
      `- Target branch: ${branchInfo.target}`,
      `- Report: ${path.relative(REPO_ROOT, path.resolve(reportDir, "drift-report.md"))}`,
      "",
      "## Suggested title",
      "chore(harness): weekly drift cleanup",
      "",
      "## Suggested body",
      "This PR applies routine harness maintenance based on drift signals.",
      "- Removed stale artifacts",
      "- Followed guardrails and QA checks",
      "- No deploy or irreversible production action executed",
    ].join("\n")
  );

  const result = {
    status: "PASS",
    reportDir,
    proposalPath,
    branchInfo,
  };

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.success("harness-maintenance completed", result);
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    printHandledError(error);
  });
}


