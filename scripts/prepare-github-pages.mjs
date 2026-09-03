import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const basePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");
if (!basePath.startsWith("/") || basePath === "/") process.exit(0);

const output = fileURLToPath(new URL("../dist/client/", import.meta.url));

async function rewrite(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewrite(entryPath);
      continue;
    }
    if (!/\.(?:html|rsc)$/.test(entry.name)) continue;
    const original = await readFile(entryPath, "utf8");
    const updated = original.replaceAll("/assets/", `${basePath}/assets/`);
    if (updated !== original) await writeFile(entryPath, updated);
  }
}

await rewrite(output);
