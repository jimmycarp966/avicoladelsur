import { pathToFileURL } from "node:url";

export function isDirectExecution(metaUrl) {
  if (!process.argv[1]) {
    return false;
  }

  return pathToFileURL(process.argv[1]).href === metaUrl;
}
