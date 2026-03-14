import fs from "node:fs";
import path from "node:path";
import { DANGEROUS_COMMAND_PATTERNS, ERROR_CODES } from "./constants.mjs";
import { HarnessError } from "./errors.mjs";

function normalizeBlockedPatterns(profile) {
  const profilePatterns = profile?.guardrails?.blocked_command_patterns;
  if (!Array.isArray(profilePatterns)) {
    return [];
  }

  return profilePatterns
    .filter((x) => typeof x === "string" && x.trim().length > 0)
    .map((source) => ({
      type: "profile",
      pattern: new RegExp(source, "i"),
      remediation: "Blocked by repository guardrail pattern.",
      source,
    }));
}

export function detectDangerousCommand(command, profile) {
  const matches = [];

  for (const item of DANGEROUS_COMMAND_PATTERNS) {
    if (item.pattern.test(command)) {
      matches.push({
        type: item.type,
        remediation: item.remediation,
        pattern: String(item.pattern),
      });
    }
  }

  const profilePatterns = normalizeBlockedPatterns(profile);
  for (const item of profilePatterns) {
    if (item.pattern.test(command)) {
      matches.push({
        type: item.type,
        remediation: item.remediation,
        pattern: item.source,
      });
    }
  }

  return matches;
}

export function ensureSafeCommand(command, profile, options = {}) {
  const { humanConfirmDeploy = false, humanConfirmIrreversible = false, humanConfirmSecrets = false } = options;
  const matches = detectDangerousCommand(command, profile);
  if (matches.length === 0) {
    return { ok: true, matches: [] };
  }

  const blocked = matches.filter((entry) => {
    if (entry.type === "deploy") {
      return !humanConfirmDeploy;
    }
    if (entry.type === "irreversible") {
      return !humanConfirmIrreversible;
    }
    if (entry.type === "secrets") {
      return !humanConfirmSecrets;
    }
    return true;
  });

  if (blocked.length > 0) {
    throw new HarnessError(
      ERROR_CODES.GUARDRAIL,
      `Guardrail blocked command: ${command}`,
      "Re-run with explicit human confirmation flags for the blocked area.",
      { command, blocked }
    );
  }

  return { ok: true, matches };
}

export function getCurrentBranch() {
  try {
    const headPath = path.resolve(process.cwd(), ".git", "HEAD");
    if (!fs.existsSync(headPath)) {
      return "unknown";
    }

    const headValue = fs.readFileSync(headPath, "utf8").trim();
    if (headValue.startsWith("ref:")) {
      const ref = headValue.split(":")[1].trim();
      return ref.replace(/^refs\/heads\//, "") || "unknown";
    }

    return headValue.slice(0, 12) || "unknown";
  } catch (_error) {
    return "unknown";
  }
}

export function isProtectedBranch(branchName, profile) {
  const protectedList = profile?.branches?.protected;
  if (!Array.isArray(protectedList)) {
    return branchName === "main" || branchName === "master";
  }

  return protectedList.includes(branchName);
}

export function evaluateBranchPolicy(branchName, profile) {
  const mode = profile?.branches?.mode || "main-only";
  const defaultBranch = profile?.repo?.default_branch || "main";

  if (mode === "main-only") {
    if (branchName === defaultBranch) {
      return {
        allowed: true,
        mode,
        defaultBranch,
        reason: `On required branch '${defaultBranch}'.`,
      };
    }

    return {
      allowed: false,
      mode,
      defaultBranch,
      reason: `Branch policy violation: mode 'main-only' requires '${defaultBranch}' but current is '${branchName}'.`,
    };
  }

  if (isProtectedBranch(branchName, profile)) {
    return {
      allowed: false,
      mode,
      defaultBranch,
      reason: `Branch policy violation: protected branch '${branchName}'.`,
    };
  }

  return {
    allowed: true,
    mode,
    defaultBranch,
    reason: `Branch '${branchName}' allowed by mode '${mode}'.`,
  };
}
