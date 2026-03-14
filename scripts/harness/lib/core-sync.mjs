import fs from "node:fs";
import path from "node:path";

export function syncCoreToGlobal(options) {
  const { sourcePath, targetPath, logger = null } = options;

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Core source path does not exist: ${sourcePath}`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    force: true,
  });

  const versionFile = path.join(sourcePath, "VERSION");
  const version = fs.existsSync(versionFile)
    ? fs.readFileSync(versionFile, "utf8").trim()
    : "unknown";

  const meta = {
    synced_at: new Date().toISOString(),
    source: sourcePath,
    version,
  };

  fs.writeFileSync(path.join(targetPath, ".sync-meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");

  if (logger) {
    logger.success("Harness core synchronized", {
      sourcePath,
      targetPath,
      version,
    });
  }

  return meta;
}
