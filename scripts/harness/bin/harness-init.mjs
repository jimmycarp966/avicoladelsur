#!/usr/bin/env node
import path from "node:path";
import readline from "node:readline/promises";
import { parseArgs, toBool } from "../lib/args.mjs";
import { createLogger } from "../lib/logger.mjs";
import { ensureProfileFile } from "../lib/profile.mjs";
import { REPO_ROOT, getDefaultExamplePath, getDefaultProfilePath, getDefaultSchemaPath, getCoreSourcePath, getGlobalCorePath } from "../lib/paths.mjs";
import { syncCoreToGlobal } from "../lib/core-sync.mjs";
import { getCurrentBranch, evaluateBranchPolicy } from "../lib/guardrails.mjs";
import { HarnessError } from "../lib/errors.mjs";
import { ERROR_CODES } from "../lib/constants.mjs";
import { runShellCommand } from "../lib/process.mjs";
import { nowRunId, printHandledError, resolveLogFile } from "../lib/runtime.mjs";
import { isDirectExecution } from "../lib/entrypoint.mjs";

async function enforceBranchPolicy(profile, nonInteractive, logger) {
  const currentBranch = getCurrentBranch();
  const policy = evaluateBranchPolicy(currentBranch, profile);

  if (policy.allowed) {
    logger.success("Branch policy check passed", { currentBranch, mode: policy.mode });
    return { currentBranch, mode: policy.mode, createdBranch: null, switchedTo: null };
  }

  if (policy.mode === "main-only") {
    const target = policy.defaultBranch || profile?.repo?.default_branch || "main";

    if (nonInteractive) {
      throw new HarnessError(
        ERROR_CODES.BRANCH_PROTECTED,
        policy.reason,
        `Switch to '${target}' and rerun harness-init.`,
        { currentBranch, target, mode: policy.mode }
      );
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const response = await rl.question(
        `[15] Branch policy is main-only and current branch is '${currentBranch}'. Switch to '${target}' now? (yes/no) [yes]: `
      );
      const normalized = response.trim().toLowerCase();
      const approved = normalized.length === 0 || ["y", "yes", "si", "s"].includes(normalized);

      if (!approved) {
        throw new HarnessError(
          ERROR_CODES.BRANCH_PROTECTED,
          policy.reason,
          `Switch to '${target}' and rerun harness-init.`
        );
      }

      await runShellCommand(`git checkout ${target}`, {
        cwd: REPO_ROOT,
        logger,
      });

      logger.success("Switched branch to satisfy main-only policy", { target });
      return { currentBranch, mode: policy.mode, createdBranch: null, switchedTo: target };
    } finally {
      rl.close();
    }
  }

  if (nonInteractive || policy.mode === "fail") {
    throw new HarnessError(
      ERROR_CODES.BRANCH_PROTECTED,
      policy.reason,
      `Create and checkout a new branch, for example: git checkout -b ${(profile.branches.prefix || "codex/")}harness-setup`
    );
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    let approved = policy.mode === "auto-create";

    if (!approved) {
      const response = await rl.question(
        `[15] Current branch '${currentBranch}' is blocked by policy. Create a new branch now? (yes/no) [yes]: `
      );
      const normalized = response.trim().toLowerCase();
      approved = normalized.length === 0 || ["y", "yes", "si", "s"].includes(normalized);
    }

    if (!approved) {
      throw new HarnessError(
        ERROR_CODES.BRANCH_PROTECTED,
        policy.reason,
        "Switch to an allowed branch and rerun harness-init."
      );
    }

    const prefix = profile?.branches?.prefix || "codex/";
    const branchName = `${prefix}harness-${nowRunId("init")}`;
    await runShellCommand(`git checkout -b ${branchName}`, {
      cwd: REPO_ROOT,
      logger,
    });

    logger.success("Created and switched to new branch", { branchName });
    return { currentBranch, mode: policy.mode, createdBranch: branchName, switchedTo: branchName };
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonMode = toBool(args.json, false);
  const nonInteractive = toBool(args["non-interactive"], false) || toBool(process.env.CI, false);
  const profilePath = path.resolve(String(args.profile || getDefaultProfilePath()));
  const schemaPath = path.resolve(String(args.schema || getDefaultSchemaPath()));
  const examplePath = path.resolve(String(args.example || getDefaultExamplePath()));
  const logFile = resolveLogFile(args, path.resolve(REPO_ROOT, ".harness", "logs", `init-${nowRunId()}.log`));

  const logger = createLogger({ json: jsonMode, logFile });
  logger.info("Starting harness-init", {
    profilePath,
    schemaPath,
    examplePath,
    nonInteractive,
  });

  const coreTargetPath = path.resolve(String(args["core-target"] || getGlobalCorePath()));

  const syncMeta = syncCoreToGlobal({
    sourcePath: getCoreSourcePath(),
    targetPath: coreTargetPath,
    logger,
  });

  const profile = await ensureProfileFile({
    profilePath,
    schemaPath,
    examplePath,
    nonInteractive,
    logger,
    repoName: path.basename(REPO_ROOT),
  });

  const branch = await enforceBranchPolicy(profile, nonInteractive, logger);

  const result = {
    status: "PASS",
    command: "harness-init",
    profilePath,
    coreTargetPath,
    coreSync: syncMeta,
    branch,
    logFile,
  };

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.success("harness-init completed", result);
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    printHandledError(error);
  });
}
