#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs, toBool } from "../lib/args.mjs";
import { createLogger } from "../lib/logger.mjs";
import { REPO_ROOT, getDefaultProfilePath } from "../lib/paths.mjs";
import { readYamlFile } from "../lib/profile.mjs";
import { readJsonIfExists, writeJson, writeText, ensureDir } from "../lib/fs-utils.mjs";
import { HarnessError } from "../lib/errors.mjs";
import { ERROR_CODES } from "../lib/constants.mjs";
import { nowRunId, printHandledError, resolveLogFile } from "../lib/runtime.mjs";
import { isDirectExecution } from "../lib/entrypoint.mjs";

function safeExec(command) {
  try {
    const tokens = command.split(/\s+/).filter((x) => x.length > 0);
    const bin = tokens[0];
    const args = tokens.slice(1);
    const result = spawnSync(bin, args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      shell: false,
    });

    if (result.status !== 0) {
      return "";
    }

    return (result.stdout || "").trim();
  } catch (_error) {
    return "";
  }
}

function buildChecklistMarkdown(profile, qaReportStatus) {
  const checks = Array.isArray(profile?.pr?.required_checks)
    ? profile.pr.required_checks
    : ["lint", "typecheck", "test", "smoke"];

  const lines = [
    "# PR Checklist",
    "",
    `- QA overall status: **${qaReportStatus}**`,
    "",
    "## Required checks",
    ...checks.map((x) => `- [ ] ${x}`),
    "",
    "## Manual confirmations",
    "- [ ] No deploy command executed without explicit human confirmation",
    "- [ ] No destructive command executed without explicit human confirmation",
    "- [ ] No secret extraction command executed without explicit human confirmation",
    "",
    "## Packaging",
    "- [ ] Summary generated",
    "- [ ] Guardrail report attached",
    "- [ ] QA report attached",
  ];

  return lines.join("\n");
}

export function packagePrArtifacts(options = {}) {
  const {
    profilePath,
    runDir,
    requirePass = true,
    logger = null,
  } = options;

  const profile = readYamlFile(profilePath, null);
  if (!profile) {
    throw new HarnessError(
      ERROR_CODES.CFG_MISSING,
      "Cannot package PR without a valid profile.",
      "Run harness-init first and ensure .harness/profile.yaml exists."
    );
  }

  ensureDir(runDir);

  const qaReportPath = path.resolve(runDir, "qa-report.json");
  const qaReport = readJsonIfExists(qaReportPath, null);
  const runStatePath = path.resolve(runDir, "run-state.json");
  const runState = readJsonIfExists(runStatePath, {});

  if (requirePass) {
    if (!qaReport) {
      throw new HarnessError(
        ERROR_CODES.QA_FAILED,
        "QA report missing. Cannot package PR.",
        "Run harness-qa-check before harness-pr-package.",
        { qaReportPath }
      );
    }

    if (qaReport.status !== "PASS") {
      throw new HarnessError(
        ERROR_CODES.QA_FAILED,
        "QA report status is FAIL. Cannot package PR.",
        "Fix QA failures and rerun harness-qa-check.",
        { qaReportPath }
      );
    }

    if (runState?.critical?.config === false || runState?.critical?.architecture === false) {
      throw new HarnessError(
        ERROR_CODES.CFG_MISSING,
        "Critical architecture/config checks failed. Cannot package PR.",
        "Run harness-validate and fix failed checks.",
        { runStatePath }
      );
    }

    if (runState?.critical?.security === false) {
      throw new HarnessError(
        ERROR_CODES.GUARDRAIL,
        "Security guardrail checks failed. Cannot package PR.",
        "Resolve guardrail violations and rerun harness flow.",
        { runStatePath }
      );
    }
  }

  const branch = safeExec("git branch --show-current");
  const gitStatus = safeExec("git status --short");

  const summary = [
    "# Harness PR Package Summary",
    "",
    `- Timestamp: ${new Date().toISOString()}`,
    `- Branch: ${branch || "unknown"}`,
    `- QA status: ${qaReport?.status || "UNKNOWN"}`,
    "",
    "## Changed files",
    "```",
    gitStatus || "(clean)",
    "```",
    "",
    "## Included artifacts",
    "- qa-report.json",
    "- guardrail-report.json",
    "- pr-checklist.md",
    "- commands.log",
  ].join("\n");

  const guardrailReport = {
    status: runState?.critical?.security === false ? "FAIL" : "PASS",
    timestamp: new Date().toISOString(),
    details: runState?.guardrails || {},
  };

  const checklist = buildChecklistMarkdown(profile, qaReport?.status || "UNKNOWN");

  writeText(path.resolve(runDir, "summary.md"), summary);
  writeJson(path.resolve(runDir, "guardrail-report.json"), guardrailReport);
  writeText(path.resolve(runDir, "pr-checklist.md"), checklist);

  const commandsLogPath = path.resolve(runDir, "commands.log");
  if (!fs.existsSync(commandsLogPath)) {
    const fallbackCommands = Array.isArray(runState?.commands)
      ? runState.commands.map((x) => `[${x.status}] ${x.command}`).join("\n")
      : "";
    writeText(commandsLogPath, fallbackCommands || "No command log available.");
  }

  const packageResult = {
    status: "PASS",
    runDir,
    files: [
      "summary.md",
      "qa-report.json",
      "guardrail-report.json",
      "pr-checklist.md",
      "commands.log",
    ],
  };

  logger?.success("PR package generated", packageResult);
  return packageResult;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonMode = toBool(args.json, false);
  const profilePath = path.resolve(String(args.profile || getDefaultProfilePath()));
  const runId = String(args["run-id"] || nowRunId("pr"));
  const runDir = path.resolve(String(args["run-dir"] || path.resolve(REPO_ROOT, ".harness", "runs", runId)));
  const logFile = resolveLogFile(args, path.resolve(runDir, "pr-package.log"));

  const logger = createLogger({ json: jsonMode, logFile });
  logger.info("Starting harness-pr-package", { profilePath, runDir });

  const result = packagePrArtifacts({
    profilePath,
    runDir,
    requirePass: !toBool(args["no-require-pass"], false),
    logger,
  });

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    printHandledError(error);
  });
}


