import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => vite.close());

test("infers the latest assessment date when Generated At is missing", async () => {
  const { parsePastedData } = await vite.ssrLoadModule("/app/page.tsx");
  const source = `Workout list, each line is an entry of workout
Type: 户外骑行, Date: 08-29 07:40, Duration: 88 mins, Average HR: 103, Max HR: 156, RPE: 3.0

ATL(Fatigue)
Date: 08-28, ATL: 149.8
Date: 08-29, ATL: 177.4

CTL(Fitness)
Date: 08-28, CTL: 255.6
Date: 08-29, CTL: 255.9

Sleep Session Detail:
2026年8月28日 22:49:37 - 2026年8月29日 06:59:37
Total: 8h 9m
Core: 5h 39m
Deep: 1h 0m
REM: 0h 55m
WakeUp: 0h 35m

Average HRV Value During Sleep Session:
2026/8/29 HRV: 41.0 ms
2026/8/28 HRV: 53.0 ms
2026/8/27 HRV: 53.0 ms
2026/8/26 HRV: 61.0 ms
2026/8/25 HRV: 54.0 ms
2026/8/24 HRV: 53.0 ms
2026/8/23 HRV: 57.0 ms
2026/8/22 HRV: 66.0 ms

Resting Heart Rate of Each Day:
2026/8/23: 51.0 bpm
2026/8/24: 52.0 bpm
2026/8/25: 50.0 bpm
2026/8/26: 50.0 bpm
2026/8/27: 51.0 bpm
2026/8/28: 52.0 bpm
2026/8/29: 54.0 bpm`;

  const parsed = parsePastedData(source);

  assert.equal(parsed.values.date, "2026-08-29");
  assert.equal(parsed.values.atl, "177.4");
  assert.equal(parsed.values.ctl, "255.9");
  assert.equal(parsed.values.hrv, "41");
  assert.equal(parsed.values.rhr, "54");
  assert.equal(parsed.values.sleep, "7.57");
  assert.equal(parsed.values.timeInBed, "8.15");
  assert.equal(parsed.values.hrvBaseline, "54");
  assert.equal(parsed.values.rhrBaseline, "51");
});
