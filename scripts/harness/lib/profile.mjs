import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import yaml from "js-yaml";
import { REQUIRED_PROFILE_TOP_LEVEL, REQUIRED_PROFILE_FIELDS, MANDATORY_CONFIRMATION_AREAS, ERROR_CODES } from "./constants.mjs";
import { HarnessError } from "./errors.mjs";

function isEmptyValue(value) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

export function getValueByPath(obj, dottedPath) {
  const chunks = dottedPath.split(".");
  let current = obj;
  for (const chunk of chunks) {
    if (!current || typeof current !== "object" || !(chunk in current)) {
      return undefined;
    }
    current = current[chunk];
  }
  return current;
}

export function setValueByPath(obj, dottedPath, value) {
  const chunks = dottedPath.split(".");
  let current = obj;

  for (let i = 0; i < chunks.length - 1; i += 1) {
    const chunk = chunks[i];
    if (!current[chunk] || typeof current[chunk] !== "object") {
      current[chunk] = {};
    }
    current = current[chunk];
  }

  current[chunks[chunks.length - 1]] = value;
}

export function readYamlFile(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const text = fs.readFileSync(filePath, "utf8");
  if (text.trim().length === 0) {
    return fallback;
  }

  return yaml.load(text);
}

export function writeYamlFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const dumped = yaml.dump(value, {
    noRefs: true,
    sortKeys: false,
    lineWidth: 120,
  });
  fs.writeFileSync(filePath, dumped, "utf8");
}

export function validateProfile(profile) {
  const errors = [];

  if (!profile || typeof profile !== "object") {
    errors.push("Profile must be a YAML object.");
    return { ok: false, errors, missing: REQUIRED_PROFILE_FIELDS.slice() };
  }

  const missingTopLevel = REQUIRED_PROFILE_TOP_LEVEL.filter((key) => !(key in profile));
  for (const key of missingTopLevel) {
    errors.push(`Missing top-level key: ${key}`);
  }

  const missingFields = [];
  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = getValueByPath(profile, field);
    if (isEmptyValue(value)) {
      missingFields.push(field);
      errors.push(`Missing required field: ${field}`);
    }
  }

  const confirmations = profile?.guardrails?.require_human_confirmation_for;
  if (Array.isArray(confirmations)) {
    for (const area of MANDATORY_CONFIRMATION_AREAS) {
      if (!confirmations.includes(area)) {
        errors.push(`guardrails.require_human_confirmation_for must include '${area}'`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    missing: missingFields,
  };
}

function buildPromptMap(repoName) {
  return {
    "repo.name": {
      label: "[1] Repo name",
      defaultValue: repoName,
      parse: (raw) => raw,
    },
    "repo.default_branch": {
      label: "[2] Default branch",
      defaultValue: "main",
      parse: (raw) => raw,
    },
    "branches.prefix": {
      label: "[3] New branch prefix",
      defaultValue: "codex/",
      parse: (raw) => raw,
    },
    "branches.mode": {
      label: "[4] Branch policy mode",
      defaultValue: "main-only",
      parse: (raw) => raw,
    },
    "qa.commands.lint": {
      label: "[5] QA lint command",
      defaultValue: "npm.cmd run lint",
      parse: (raw) => raw,
    },
    "qa.commands.typecheck": {
      label: "[6] QA typecheck command",
      defaultValue: "npm.cmd run type-check",
      parse: (raw) => raw,
    },
    "qa.commands.test": {
      label: "[7] QA test command",
      defaultValue: "npm.cmd run type-check",
      parse: (raw) => raw,
    },
    "qa.commands.smoke": {
      label: "[8] QA smoke command",
      defaultValue: "npm.cmd run build",
      parse: (raw) => raw,
    },
    "maintenance.schedule.type": {
      label: "[9] Maintenance frequency",
      defaultValue: "weekly",
      parse: (raw) => raw,
    },
    "maintenance.schedule.day": {
      label: "[10] Maintenance day",
      defaultValue: "MON",
      parse: (raw) => raw.toUpperCase(),
    },
    "maintenance.schedule.time": {
      label: "[11] Maintenance time (HH:MM)",
      defaultValue: "09:00",
      parse: (raw) => raw,
    },
    "pr.required_checks": {
      label: "[12] PR required checks (comma-separated)",
      defaultValue: "lint,typecheck,test,smoke",
      parse: (raw) => raw.split(",").map((x) => x.trim()).filter((x) => x.length > 0),
    },
    "guardrails.require_human_confirmation_for": {
      label: "[13] Guardrail confirmation areas (comma-separated)",
      defaultValue: "deploy,irreversible,secrets",
      parse: (raw) => raw.split(",").map((x) => x.trim()).filter((x) => x.length > 0),
    },
    "guardrails.blocked_command_patterns": {
      label: "[14] Extra blocked command regex (comma-separated, optional)",
      defaultValue: "",
      parse: (raw) => {
        if (!raw || raw.trim().length === 0) {
          return [];
        }
        return raw.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
      },
    },
  };
}

function ensureProfileSkeleton(profile, repoName) {
  if (!profile.version) {
    profile.version = 1;
  }
  if (!profile.repo || typeof profile.repo !== "object") {
    profile.repo = {};
  }
  if (!profile.repo.name) {
    profile.repo.name = repoName;
  }
  if (!profile.branches || typeof profile.branches !== "object") {
    profile.branches = {};
  }
  if (!Array.isArray(profile.branches.protected)) {
    profile.branches.protected = [];
  }
  if (!profile.qa || typeof profile.qa !== "object") {
    profile.qa = {};
  }
  if (!profile.qa.commands || typeof profile.qa.commands !== "object") {
    profile.qa.commands = {};
  }
  if (!profile.guardrails || typeof profile.guardrails !== "object") {
    profile.guardrails = {};
  }
  if (!profile.maintenance || typeof profile.maintenance !== "object") {
    profile.maintenance = {};
  }
  if (!profile.maintenance.schedule || typeof profile.maintenance.schedule !== "object") {
    profile.maintenance.schedule = {};
  }
  if (!profile.pr || typeof profile.pr !== "object") {
    profile.pr = {};
  }

  return profile;
}

export async function ensureProfileFile(options) {
  const {
    profilePath,
    schemaPath,
    examplePath,
    nonInteractive,
    logger,
    repoName,
  } = options;

  let profile = readYamlFile(profilePath, null);

  if (!profile) {
    if (fs.existsSync(examplePath)) {
      profile = readYamlFile(examplePath, {});
      logger?.info("Initialized profile from example template", { profilePath });
    } else {
      profile = {};
      logger?.warn("Profile template not found. Bootstrapping from empty object.", { examplePath });
    }
  }

  profile = ensureProfileSkeleton(profile, repoName);

  const initialValidation = validateProfile(profile);
  if (!initialValidation.ok) {
    if (nonInteractive) {
      throw new HarnessError(
        ERROR_CODES.CFG_MISSING,
        "Critical profile configuration is missing in non-interactive mode.",
        "Run harness-init in interactive mode or fill .harness/profile.yaml fields listed in details.missing.",
        {
          missing: initialValidation.missing,
          errors: initialValidation.errors,
          profilePath,
          schemaPath,
        }
      );
    }

    const promptMap = buildPromptMap(repoName);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      let questionIndex = 0;
      for (const missingField of initialValidation.missing) {
        const metadata = promptMap[missingField];
        if (!metadata) {
          continue;
        }

        questionIndex += 1;
        const currentValue = getValueByPath(profile, missingField);
        const fallback = isEmptyValue(currentValue) ? metadata.defaultValue : currentValue;
        const response = await rl.question(
          `${metadata.label} [default: ${Array.isArray(fallback) ? fallback.join(",") : fallback}]: `
        );

        const clean = response.trim().length > 0 ? response.trim() : Array.isArray(fallback) ? fallback.join(",") : String(fallback);
        const parsed = metadata.parse(clean);

        setValueByPath(profile, missingField, parsed);
        writeYamlFile(profilePath, profile);
        logger?.info("Persisted interactive answer", {
          number: questionIndex,
          field: missingField,
          profilePath,
        });
      }
    } finally {
      rl.close();
    }
  }

  if (!Array.isArray(profile.guardrails.require_human_confirmation_for)) {
    profile.guardrails.require_human_confirmation_for = MANDATORY_CONFIRMATION_AREAS.slice();
  }
  for (const area of MANDATORY_CONFIRMATION_AREAS) {
    if (!profile.guardrails.require_human_confirmation_for.includes(area)) {
      profile.guardrails.require_human_confirmation_for.push(area);
    }
  }

  if (!Array.isArray(profile.guardrails.blocked_command_patterns)) {
    profile.guardrails.blocked_command_patterns = [];
  }

  writeYamlFile(profilePath, profile);

  const finalValidation = validateProfile(profile);
  if (!finalValidation.ok) {
    throw new HarnessError(
      ERROR_CODES.CFG_MISSING,
      "Profile remains incomplete after initialization.",
      "Complete the missing fields in .harness/profile.yaml and rerun harness-init.",
      {
        missing: finalValidation.missing,
        errors: finalValidation.errors,
      }
    );
  }

  if (!fs.existsSync(schemaPath)) {
    throw new HarnessError(
      ERROR_CODES.CFG_MISSING,
      "Profile schema file is missing.",
      "Create .harness/profile.schema.yaml before running harness commands.",
      { schemaPath }
    );
  }

  return profile;
}

