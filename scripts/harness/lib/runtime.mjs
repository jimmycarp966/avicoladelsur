import path from "node:path";
import { HarnessError } from "./errors.mjs";
import { ERROR_CODES } from "./constants.mjs";

export function nowRunId(prefix = "run") {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `${prefix}-${stamp}`;
}

export function resolveLogFile(args, fallbackPath) {
  if (typeof args["log-file"] === "string" && args["log-file"].trim().length > 0) {
    return path.resolve(args["log-file"]);
  }
  return fallbackPath;
}

export function printHandledError(error, logger = null, jsonMode = false) {
  const safeError = error instanceof HarnessError
    ? error
    : new HarnessError(
        ERROR_CODES.INTERNAL,
        error?.message || "Unhandled harness error",
        "Inspect stack trace and script output.",
        { stack: error?.stack }
      );

  if (logger) {
    logger.error(safeError.message, {
      code: safeError.code,
      remediation: safeError.remediation,
      details: safeError.details,
    });
  } else if (jsonMode) {
    console.error(
      JSON.stringify({
        status: "FAIL",
        code: safeError.code,
        message: safeError.message,
        remediation: safeError.remediation,
        details: safeError.details,
      })
    );
  } else {
    console.error(`[FAIL] ${safeError.code}: ${safeError.message}`);
    if (safeError.remediation) {
      console.error(`Remediation: ${safeError.remediation}`);
    }
    if (safeError.details) {
      console.error(`Details: ${JSON.stringify(safeError.details, null, 2)}`);
    }
  }

  process.exitCode = 1;
}
