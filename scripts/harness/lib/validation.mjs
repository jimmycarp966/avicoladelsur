import fs from "node:fs";
import path from "node:path";
import { REQUIRED_HARNESS_DOCS, ERROR_CODES, MANDATORY_CONFIRMATION_AREAS } from "./constants.mjs";
import { HarnessError } from "./errors.mjs";
import { detectDangerousCommand, getCurrentBranch, evaluateBranchPolicy } from "./guardrails.mjs";
import { readYamlFile, validateProfile } from "./profile.mjs";

function checkAgentsIndex(repoRoot) {
  const agentsPath = path.resolve(repoRoot, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    return {
      ok: false,
      reason: "AGENTS.md is missing.",
    };
  }

  const content = fs.readFileSync(agentsPath, "utf8");
  const lines = content.split(/\r?\n/);
  const hasHarnessLink = content.includes("docs/harness/README.md");

  return {
    ok: lines.length <= 80 && hasHarnessLink,
    reason: lines.length > 80
      ? "AGENTS.md must be a short index (<= 80 lines)."
      : !hasHarnessLink
      ? "AGENTS.md must reference docs/harness/README.md."
      : "ok",
    lineCount: lines.length,
  };
}

function checkDocs(repoRoot) {
  const missing = REQUIRED_HARNESS_DOCS.filter((relativePath) => !fs.existsSync(path.resolve(repoRoot, relativePath)));
  return {
    ok: missing.length === 0,
    missing,
  };
}

function collectConfiguredCommands(profile) {
  const commands = [];
  const qaCommands = profile?.qa?.commands || {};

  for (const [name, value] of Object.entries(qaCommands)) {
    if (typeof value === "string" && value.trim().length > 0) {
      commands.push({ area: `qa.${name}`, command: value });
    }
  }

  if (typeof profile?.maintenance?.command === "string" && profile.maintenance.command.trim().length > 0) {
    commands.push({ area: "maintenance.command", command: profile.maintenance.command });
  }

  return commands;
}

function checkGuardrails(profile) {
  const reasons = [];
  const confirmations = profile?.guardrails?.require_human_confirmation_for;

  if (!Array.isArray(confirmations)) {
    reasons.push("guardrails.require_human_confirmation_for must be an array");
  } else {
    for (const area of MANDATORY_CONFIRMATION_AREAS) {
      if (!confirmations.includes(area)) {
        reasons.push(`guardrails.require_human_confirmation_for must include '${area}'`);
      }
    }
  }

  const blocked = profile?.guardrails?.blocked_command_patterns;
  if (!Array.isArray(blocked)) {
    reasons.push("guardrails.blocked_command_patterns must be an array");
  }

  const configuredCommands = collectConfiguredCommands(profile);
  const dangerousConfiguredCommands = [];
  for (const item of configuredCommands) {
    const matches = detectDangerousCommand(item.command, profile);
    if (matches.length > 0) {
      dangerousConfiguredCommands.push({ ...item, matches });
    }
  }

  if (dangerousConfiguredCommands.length > 0) {
    reasons.push("Configured automated commands include blocked dangerous patterns");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    dangerousConfiguredCommands,
  };
}

export function runMechanicalValidation(options) {
  const {
    repoRoot,
    profilePath,
    schemaPath,
    checkBranch = true,
  } = options;

  const result = {
    pass: true,
    checks: {
      config: { pass: true, details: [] },
      architecture: { pass: true, details: [] },
      security: { pass: true, details: [] },
    },
    branch: getCurrentBranch(),
  };

  if (!fs.existsSync(profilePath)) {
    result.pass = false;
    result.checks.config.pass = false;
    result.checks.config.details.push(`Missing profile file: ${profilePath}`);
    return result;
  }

  if (!fs.existsSync(schemaPath)) {
    result.pass = false;
    result.checks.config.pass = false;
    result.checks.config.details.push(`Missing schema file: ${schemaPath}`);
  }

  const profile = readYamlFile(profilePath, null);
  const profileValidation = validateProfile(profile);
  if (!profileValidation.ok) {
    result.pass = false;
    result.checks.config.pass = false;
    result.checks.config.details.push(...profileValidation.errors);
  }

  const agents = checkAgentsIndex(repoRoot);
  if (!agents.ok) {
    result.pass = false;
    result.checks.architecture.pass = false;
    result.checks.architecture.details.push(agents.reason);
  }

  const docs = checkDocs(repoRoot);
  if (!docs.ok) {
    result.pass = false;
    result.checks.architecture.pass = false;
    result.checks.architecture.details.push(`Missing harness docs: ${docs.missing.join(", ")}`);
  }

  if (profile) {
    const guardrailCheck = checkGuardrails(profile);
    if (!guardrailCheck.ok) {
      result.pass = false;
      result.checks.security.pass = false;
      result.checks.security.details.push(...guardrailCheck.reasons);
    }

    if (checkBranch) {
      const policy = evaluateBranchPolicy(result.branch, profile);
      result.branchPolicy = policy;
      if (!policy.allowed) {
        result.pass = false;
        result.checks.security.pass = false;
        result.checks.security.details.push(policy.reason);
      }
    }
  }

  return result;
}

export function throwIfValidationFailed(validationResult) {
  if (validationResult.pass) {
    return;
  }

  if (!validationResult.checks.config.pass) {
    throw new HarnessError(
      ERROR_CODES.CFG_MISSING,
      "Validation failed on configuration checks.",
      "Fix .harness/profile.yaml and .harness/profile.schema.yaml based on validation output.",
      validationResult
    );
  }

  if (!validationResult.checks.security.pass && validationResult.checks.security.details.some((x) => x.includes("Branch policy violation"))) {
    throw new HarnessError(
      ERROR_CODES.BRANCH_PROTECTED,
      "Validation failed because branch policy is violated.",
      "Switch to the branch required by profile.branches.mode and rerun harness commands.",
      validationResult
    );
  }

  if (!validationResult.checks.security.pass) {
    throw new HarnessError(
      ERROR_CODES.GUARDRAIL,
      "Validation failed on security/guardrail checks.",
      "Remove blocked commands and ensure guardrails require explicit human confirmation.",
      validationResult
    );
  }

  throw new HarnessError(
    ERROR_CODES.INTERNAL,
    "Validation failed on architecture checks.",
    "Ensure AGENTS.md index and docs/harness files are present and up to date.",
    validationResult
  );
}
