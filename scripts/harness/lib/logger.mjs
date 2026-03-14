import fs from "node:fs";
import path from "node:path";

function formatLine(level, message, data = undefined, jsonMode = false) {
  const timestamp = new Date().toISOString();
  if (jsonMode) {
    return JSON.stringify({ timestamp, level, message, data });
  }

  const payload = data ? ` ${JSON.stringify(data)}` : "";
  return `[${timestamp}] [${level}] ${message}${payload}`;
}

export function createLogger({ json = false, logFile = "" } = {}) {
  const write = (level, message, data = undefined) => {
    const line = formatLine(level, message, data, json);
    if (level === "ERROR") {
      console.error(line);
    } else {
      console.log(line);
    }

    if (logFile) {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, `${line}\n`, "utf8");
    }
  };

  return {
    info: (message, data) => write("INFO", message, data),
    warn: (message, data) => write("WARN", message, data),
    error: (message, data) => write("ERROR", message, data),
    success: (message, data) => write("SUCCESS", message, data),
  };
}
