import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../dist/client/", import.meta.url));

test("emits a GitHub Pages-compatible entrypoint", async () => {
  const html = await readFile(new URL("index.html", `file://${output}/`), "utf8");

  assert.match(html, /HERACLES DAILY｜每日训练准备度/);
  assert.match(html, /\/heracles-daily\/assets\//);
  assert.doesNotMatch(html, /(?:href|src)=["']\/assets\//);
  await access(new URL("manifest.webmanifest", `file://${output}/`));
  await access(new URL("sw.js", `file://${output}/`));
});
