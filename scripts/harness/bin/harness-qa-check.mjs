#!/usr/bin/env node
import path from "node:path";
import { parseArgs, toBool, toNumber } from "../lib/args.mjs";
import { createLogger } from "../lib/logger.mjs";
import { REPO_ROOT, getDefaultProfilePath } from "../lib/paths.mjs";
import { readYamlFile } from "../lib/profile.mjs";
import { ensureSafeCommand } from "../lib/guardrails.mjs";
import { runShellCommand } from "../lib/process.mjs";
import { ensureDir, writeJson } from "../lib/fs-utils.mjs";
import { HarnessError } from "../lib/errors.mjs";
import { ERROR_CODES } from "../lib/constants.mjs";
import { nowRunId, printHandledError, resolveLogFile } from "../lib/runtime.mjs";
import { isDirectExecution } from "../lib/entrypoint.mjs";

export async function runQaChecks(options = {}) {
  const {
    profilePath,
    runDir,
    jsonMode = false,
    logger,
    commandLogFile,
    humanConfirmDeploy = false,
    humanConfirmIrreversible = false,
    humanConfirmSecrets = false,
    simulate = false,
  } = options;

  const profile = readYamlFile(profilePath, null);
  if (!profile) {
    throw new HarnessError(
      ERROR_CODES.CFG_MISSING,
      "Profile file is required before running QA.",
      "Run harness-init first or provide --profile with a valid file."
    );
  }

  const timeoutMs = toNumber(profile?.qa?.timeout_seconds, 0) > 0
    ? toNumber(profile.qa.timeout_seconds, 0) * 1000
    : 0;

  const stepOrder = ["lint", "typecheck", "test", "smoke"];
  const results = [];

  for (const stepName of stepOrder) {
    const command = profile?.qa?.commands?.[stepName];
    if (!command || typeof command !== "string") {
      results.push({
        step: stepName,
        status: "SKIP",
        reason: "Command missing in profile.qa.commands",
      });
      continue;
    }

    ensureSafeCommand(command, profile, {
      humanConfirmDeploy,
      humanConfirmIrreversible,
      humanConfirmSecrets,
    });

    try {
      const execution = await runShellCommand(command, {
        cwd: REPO_ROOT,
        timeoutMs,
        logger,
        commandLogFile,
        simulate,
      });

      results.push({
        step: stepName,
        status: execution.code === 0 ? "PASS" : "FAIL",
        command,
        exitCode: execution.code,
        durationMs: execution.durationMs,
        simulated: Boolean(execution.simulated),
      });
    } catch (error) {
      const execution = error?.result || {};
      results.push({
        step: stepName,
        status: "FAIL",
        command,
        exitCode: execution.code ?? 1,
        durationMs: execution.durationMs ?? 0,
        stderr: execution.stderr || error?.message || "Unknown command error",
      });

      if (profile?.qa?.stop_on_failure !== false) {
        break;
      }
    }
  }

  const failedSteps = results.filter((x) => x.status === "FAIL");
  const qaReport = {
    status: failedSteps.length === 0 ? "PASS" : "FAIL",
    timestamp: new Date().toISOString(),
    profilePath,
    simulated: Boolean(simulate),
    results,
  };

  ensureDir(runDir);
  const qaReportPath = path.resolve(runDir, "qa-report.json");
  writeJson(qaReportPath, qaReport);

  if (jsonMode) {
    console.log(JSON.stringify(qaReport, null, 2));
  } else {
    logger?.info("QA report written", { qaReportPath });
  }

  if (failedSteps.length > 0) {
    throw new HarnessError(
      ERROR_CODES.QA_FAILED,
      "QA checks failed.",
      "Fix failing commands and rerun harness-qa-check.",
      {
        failedSteps,
        qaReportPath,
      }
    );
  }

  return qaReport;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonMode = toBool(args.json, false);
  const profilePath = path.resolve(String(args.profile || getDefaultProfilePath()));
  const runId = String(args["run-id"] || nowRunId("qa"));
  const runDir = path.resolve(String(args["run-dir"] || path.resolve(REPO_ROOT, ".harness", "runs", runId)));
  const logFile = resolveLogFile(args, path.resolve(runDir, "qa.log"));
  const commandLogFile = path.resolve(runDir, "commands.log");

  const logger = createLogger({ json: jsonMode, logFile });
  logger.info("Starting harness-qa-check", {
    profilePath,
    runDir,
  });

  const report = await runQaChecks({
    profilePath,
    runDir,
    jsonMode,
    logger,
    commandLogFile,
    humanConfirmDeploy: toBool(args["human-confirm-deploy"], false),
    humanConfirmIrreversible: toBool(args["human-confirm-irreversible"], false),
    humanConfirmSecrets: toBool(args["human-confirm-secrets"], false),
    simulate: toBool(args.simulate, false),
  });

  if (!jsonMode) {
    logger.success("harness-qa-check completed", {
      status: report.status,
      runDir,
    });
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    printHandledError(error);
  });
}
