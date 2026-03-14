#!/usr/bin/env node
import path from "node:path";
import { parseArgs, toBool } from "../lib/args.mjs";
import { createLogger } from "../lib/logger.mjs";
import { REPO_ROOT, getDefaultProfilePath, getDefaultSchemaPath } from "../lib/paths.mjs";
import { runMechanicalValidation, throwIfValidationFailed } from "../lib/validation.mjs";
import { nowRunId, printHandledError, resolveLogFile } from "../lib/runtime.mjs";
import { isDirectExecution } from "../lib/entrypoint.mjs";

export function validateCommand(options = {}) {
  const {
    profilePath,
    schemaPath,
    jsonMode = false,
    logger,
    checkBranch = true,
  } = options;

  const validationResult = runMechanicalValidation({
    repoRoot: REPO_ROOT,
    profilePath,
    schemaPath,
    checkBranch,
  });

  if (jsonMode) {
    console.log(JSON.stringify(validationResult, null, 2));
  }

  throwIfValidationFailed(validationResult);
  logger?.success("Mechanical validation passed", {
    branch: validationResult.branch,
  });

  return validationResult;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonMode = toBool(args.json, false);
  const profilePath = path.resolve(String(args.profile || getDefaultProfilePath()));
  const schemaPath = path.resolve(String(args.schema || getDefaultSchemaPath()));
  const logFile = resolveLogFile(args, path.resolve(REPO_ROOT, ".harness", "logs", `validate-${nowRunId()}.log`));

  const logger = createLogger({ json: jsonMode, logFile });
  logger.info("Starting harness-validate", {
    profilePath,
    schemaPath,
  });

  const result = validateCommand({
    profilePath,
    schemaPath,
    jsonMode,
    logger,
    checkBranch: !toBool(args["skip-branch-check"], false),
  });

  if (!jsonMode) {
    logger.success("harness-validate completed", {
      status: "PASS",
      branch: result.branch,
      logFile,
    });
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    printHandledError(error);
  });
}


