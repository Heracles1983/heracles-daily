import assert from "node:assert/strict";
import test from "node:test";

test("renders the HERACLES DAILY application shell", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>HERACLES DAILY｜每日训练准备度<\/title>/);
  assert.match(html, /粘贴数据，直接生成今日训练/);
  assert.match(html, /今日准备度/);
  assert.doesNotMatch(html, /codex-preview/);
});
