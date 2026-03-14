export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const trimmed = token.slice(2);
    if (trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1);
      args[key] = value;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[trimmed] = true;
      continue;
    }

    args[trimmed] = next;
    i += 1;
  }

  return args;
}

export function toBool(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
