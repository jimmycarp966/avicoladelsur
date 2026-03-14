#!/usr/bin/env node
import path from "node:path";
import { parseArgs, toBool } from "../lib/args.mjs";
import { createLogger } from "../lib/logger.mjs";
import { REPO_ROOT, getDefaultProfilePath } from "../lib/paths.mjs";
import { readYamlFile } from "../lib/profile.mjs";
import { validateCommand } from "./harness-validate.mjs";
import { runQaChecks } from "./harness-qa-check.mjs";
import { packagePrArtifacts } from "./harness-pr-package.mjs";
import { ensureSafeCommand } from "../lib/guardrails.mjs";
import { runShellCommand } from "../lib/process.mjs";
import { ensureDir, writeJson, writeText } from "../lib/fs-utils.mjs";
import { HarnessError } from "../lib/errors.mjs";
import { ERROR_CODES } from "../lib/constants.mjs";
import { nowRunId, printHandledError, resolveLogFile } from "../lib/runtime.mjs";
import { isDirectExecution } from "../lib/entrypoint.mjs";

async function runTaskFlow(options = {}) {
  const {
    profilePath,
    runId,
    runDir,
    task,
    implementCommand,
    fixCommand,
    logger,
    jsonMode,
    humanConfirmDeploy,
    humanConfirmIrreversible,
    humanConfirmSecrets,
    simulate,
  } = options;

  const profile = readYamlFile(profilePath, null);
  if (!profile) {
    throw new HarnessError(
      ERROR_CODES.CFG_MISSING,
      "Profile is required before running tasks.",
      "Run harness-init first."
    );
  }

  ensureDir(runDir);
  const commandLogFile = path.resolve(runDir, "commands.log");
  const runState = {
    runId,
    task,
    simulated: Boolean(simulate),
    startedAt: new Date().toISOString(),
    commands: [],
    critical: {
      config: true,
      architecture: true,
      qa: true,
      security: true,
    },
    guardrails: {
      blocked: [],
      confirmed: {
        deploy: humanConfirmDeploy,
        irreversible: humanConfirmIrreversible,
        secrets: humanConfirmSecrets,
      },
    },
  };

  writeText(
    path.resolve(runDir, "plan.md"),
    [
      "# Harness Run Plan",
      "",
      `- Run ID: ${runId}`,
      `- Task: ${task}`,
      "- Flow: plan -> implement -> validate -> QA -> PR package",
      "- Guardrails: deploy/irreversible/secrets require explicit human confirmation",
      `- Simulated mode: ${simulate ? "true" : "false"}`,
      "",
      "## Implementation command",
      implementCommand ? `- ${implementCommand}` : "- (not provided)",
    ].join("\n")
  );

  if (implementCommand) {
    ensureSafeCommand(implementCommand, profile, {
      humanConfirmDeploy,
      humanConfirmIrreversible,
      humanConfirmSecrets,
    });

    const implResult = await runShellCommand(implementCommand, {
      cwd: REPO_ROOT,
      logger,
      commandLogFile,
      simulate,
    });

    runState.commands.push({
      command: implementCommand,
      status: implResult.code === 0 ? "PASS" : "FAIL",
      exitCode: implResult.code,
      durationMs: implResult.durationMs,
      simulated: Boolean(implResult.simulated),
    });

    if (implResult.code !== 0) {
      throw new HarnessError(
        ERROR_CODES.INTERNAL,
        "Implementation command failed.",
        "Fix implementation errors and rerun harness-run-task.",
        implResult
      );
    }
  }

  const validation = validateCommand({
    profilePath,
    schemaPath: path.resolve(REPO_ROOT, ".harness", "profile.schema.yaml"),
    jsonMode: false,
    logger,
    checkBranch: true,
  });

  runState.validation = validation;
  runState.critical.config = validation.checks.config.pass;
  runState.critical.architecture = validation.checks.architecture.pass;
  runState.critical.security = validation.checks.security.pass;

  let qaReport = null;
  try {
    qaReport = await runQaChecks({
      profilePath,
      runDir,
      jsonMode,
      logger,
      commandLogFile,
      humanConfirmDeploy,
      humanConfirmIrreversible,
      humanConfirmSecrets,
      simulate,
    });
  } catch (error) {
    runState.critical.qa = false;

    if (!fixCommand) {
      throw error;
    }

    logger.warn("QA failed; starting single review/fix loop", {
      fixCommand,
    });

    ensureSafeCommand(fixCommand, profile, {
      humanConfirmDeploy,
      humanConfirmIrreversible,
      humanConfirmSecrets,
    });

    const fixResult = await runShellCommand(fixCommand, {
      cwd: REPO_ROOT,
      logger,
      commandLogFile,
      allowFailure: false,
      simulate,
    });

    runState.commands.push({
      command: fixCommand,
      status: fixResult.code === 0 ? "PASS" : "FAIL",
      exitCode: fixResult.code,
      durationMs: fixResult.durationMs,
      simulated: Boolean(fixResult.simulated),
      loop: "review-fix-1",
    });

    qaReport = await runQaChecks({
      profilePath,
      runDir,
      jsonMode,
      logger,
      commandLogFile,
      humanConfirmDeploy,
      humanConfirmIrreversible,
      humanConfirmSecrets,
      simulate,
    });

    runState.critical.qa = qaReport.status === "PASS";
  }

  if (qaReport && qaReport.status === "PASS") {
    runState.critical.qa = true;
  }

  runState.finishedAt = new Date().toISOString();
  writeJson(path.resolve(runDir, "run-state.json"), runState);

  const packageResult = packagePrArtifacts({
    profilePath,
    runDir,
    requirePass: true,
    logger,
  });

  const finalResult = {
    status: "PASS",
    runId,
    runDir,
    package: packageResult,
  };

  if (jsonMode) {
    console.log(JSON.stringify(finalResult, null, 2));
  }

  return finalResult;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonMode = toBool(args.json, false);
  const profilePath = path.resolve(String(args.profile || getDefaultProfilePath()));
  const runId = String(args["run-id"] || nowRunId("task"));
  const runDir = path.resolve(String(args["run-dir"] || path.resolve(REPO_ROOT, ".harness", "runs", runId)));
  const logFile = resolveLogFile(args, path.resolve(runDir, "run-task.log"));
  const logger = createLogger({ json: jsonMode, logFile });

  const task = String(args.task || "unspecified-task");
  const implementCommand = typeof args["implement-cmd"] === "string" ? String(args["implement-cmd"]) : "";
  const fixCommand = typeof args["fix-cmd"] === "string" ? String(args["fix-cmd"]) : "";

  logger.info("Starting harness-run-task", {
    runId,
    runDir,
    task,
  });

  await runTaskFlow({
    profilePath,
    runId,
    runDir,
    task,
    implementCommand,
    fixCommand,
    logger,
    jsonMode,
    humanConfirmDeploy: toBool(args["human-confirm-deploy"], false),
    humanConfirmIrreversible: toBool(args["human-confirm-irreversible"], false),
    humanConfirmSecrets: toBool(args["human-confirm-secrets"], false),
    simulate: toBool(args.simulate, false),
  });

  if (!jsonMode) {
    logger.success("harness-run-task completed", {
      runId,
      runDir,
    });
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    printHandledError(error);
  });
}
