import { spawn } from "node:child_process";
import { appendText } from "./fs-utils.mjs";

export async function runShellCommand(command, options = {}) {
  const {
    cwd = process.cwd(),
    timeoutMs = 0,
    env = {},
    logger = null,
    commandLogFile = "",
    allowFailure = false,
    simulate = false,
  } = options;

  const startedAt = Date.now();

  if (simulate) {
    const simulated = {
      command,
      cwd,
      code: 0,
      stdout: `[SIMULATED] ${command}`,
      stderr: "",
      timedOut: false,
      durationMs: 0,
      simulated: true,
    };

    if (logger) {
      logger.warn("Simulated command execution", { command, cwd });
    }

    if (commandLogFile) {
      appendText(commandLogFile, `${simulated.stdout}\n`);
    }

    return simulated;
  }

  if (logger) {
    logger.info("Executing command", { command, cwd });
  }

  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const settle = (result, shouldReject = false) => {
      if (logger) {
        if (result.code === 0) {
          logger.success("Command completed", {
            command,
            durationMs: result.durationMs,
          });
        } else {
          logger.error("Command failed", {
            command,
            code: result.code,
            durationMs: result.durationMs,
            timedOut,
          });
        }
      }

      if (shouldReject) {
        reject(Object.assign(new Error(`Command failed: ${command}`), { result }));
      } else {
        resolve(result);
      }
    };

    let child;
    try {
      child = spawn(command, {
        cwd,
        shell: true,
        env: {
          ...process.env,
          ...env,
        },
      });
    } catch (error) {
      const result = {
        command,
        cwd,
        code: 1,
        stdout,
        stderr: error?.message || "spawn failed",
        timedOut: false,
        durationMs: Date.now() - startedAt,
      };
      settle(result, !allowFailure);
      return;
    }

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (commandLogFile) {
        appendText(commandLogFile, text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (commandLogFile) {
        appendText(commandLogFile, text);
      }
    });

    let timeoutHandle = null;
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
    }

    child.on("error", (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const result = {
        command,
        cwd,
        code: 1,
        stdout,
        stderr: error?.message || "spawn error",
        timedOut,
        durationMs: Date.now() - startedAt,
      };

      settle(result, !allowFailure);
    });

    child.on("close", (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const result = {
        command,
        cwd,
        code: code ?? 1,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - startedAt,
      };

      settle(result, !allowFailure && result.code !== 0);
    });
  });
}
