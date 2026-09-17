import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(async () => vite.close());
const { parseCyclingSession, classifyCycling, assessCycling, readCyclingHistory, wallTime, assessmentTime } = await vite.ssrLoadModule("/lib/cycling.ts");
const { evaluateReadiness, parsePastedData, CyclingSteps } = await vite.ssrLoadModule("/app/page.tsx");
const at = wallTime("2026-09-17 09:00");
const HOUR = 3_600_000;
const power = (values) => values.map((n, i) => `Power Zone ${i + 1}: ${n}%`).join(", ");
const hr = (values) => values.map((n, i) => `Zone ${i}: ${n}%`).join(", ");
const ride = ({ hoursAgo = 20, duration = 60, rpe = 4, type = "户外骑行", text = "" } = {}) => parseCyclingSession({ type, timestamp: at - hoursAgo * HOUR - duration * 60_000, duration, rpe }, text);
const good = {
  date: "2026-09-17", evaluationAt: "2026-09-17 09:00", cyclingAsOf: "2026-09-17 09:00", cyclingHistory: "[]",
  hrv: "65", hrvBaseline: "65", hrv3d: "65", hrv7avg: "65", hrv7sd: "5", sleep: "7.5", timeInBed: "8", sleep3avg: "7.5",
  rhr: "50", rhrBaseline: "50", atl: "80", ctl: "100", atlYesterday: "80", monotony: "1", density: "0.8",
  pushSets7: "10", pullSets7: "12", legsSets7: "0", pushSets48: "0", pullSets48: "0", legsSets48: "0",
  fatiguePush: "no", fatiguePull: "no", fatigueLegs: "no", lowerSoreness: "1", upperSoreness: "1", pain: "0", symptoms: "none", preference: "auto",
};
const evaluate = (rides, extra = {}) => evaluateReadiness({ ...good, cyclingHistory: JSON.stringify(rides), ...extra });
const report = (entries) => `User: Heracles\nGenerated At: 2026-09-17\nDate Range: 2026-09-01 - 2026-09-17\nWorkout list, each line is an entry of workout\n${entries}\nATL(Fatigue)\nDate: 09-17, ATL: 80\nCTL(Fitness)\nDate: 09-17, CTL: 100\nSleep Session Detail:\nAverage HRV Value During Sleep Session:\n2026/9/17 HRV: 65 ms\nResting Heart Rate of Each Day:\n2026/9/17: 50 bpm`;

test("keeps ordinary low-intensity cycling out of strength set totals and does not ban legs", () => {
  const r = ride({ rpe: 3, text: power([10, 90, 0, 0, 0, 0, 0]) });
  const result = evaluate([r]);
  assert.equal(result.cycling.load48, 180);
  assert.equal(result.cycling.blocked, false);
  assert.equal(result.plan.targetGroup, "legs");
});

test("power detects short sprints despite low average RPE and low HR zones", () => {
  const r = ride({ text: `${hr([10, 80, 10, 0, 0, 0])}, ${power([10, 85, 0, 0, 0, 4, 1])}` });
  assert.equal(classifyCycling(r).kind, "sprint");
  assert.equal(classifyCycling(r).powerSprint, 3);
  const result = evaluate([r]);
  assert.equal(result.cyclingLegBlock, true);
  assert.notEqual(result.plan.targetGroup, "legs");
  assert.ok(result.strengthGroupScores.legs <= 54);
  assert.ok(result.cyclingScore <= 54);
  assert.equal(result.recovery, evaluate([]).recovery);
  assert.equal(result.load, evaluate([]).load);
  assert.equal(result.strengthGroupScores.push, evaluate([]).strengthGroupScores.push);
});

test("HR fallback uses minutes rather than percentage and does not claim anaerobic power", () => {
  const short = classifyCycling(ride({ duration: 10, rpe: 3, text: hr([0, 50, 40, 0, 10, 0]) }));
  const long = classifyCycling(ride({ duration: 150, rpe: 3, text: hr([0, 50, 40, 0, 10, 0]) }));
  assert.equal(short.windowHours, 0);
  assert.equal(long.windowHours, 48);
  assert.match(long.reason, /心率.*估计/);
  assert.equal(long.powerSprint, null);
});

test("complete power takes precedence over HR fallback, but RPE still independently detects stress", () => {
  const text = `${hr([0, 10, 10, 0, 80, 0])}, ${power([10, 90, 0, 0, 0, 0, 0])}`;
  assert.equal(classifyCycling(ride({ rpe: 3, text })).windowHours, 0);
  assert.equal(classifyCycling(ride({ rpe: 8, text })).windowHours, 48);
});

test("parses labelled generic power zones separately from HR zones", () => {
  const text = "HR Zones: Zone 0: 0%, Zone 1: 90%, Zone 2: 10%, Zone 3: 0%, Zone 4: 0%, Zone 5: 0%\nPower Zone Distribution: Z1: 10%, Z2: 80%, Z3: 0%, Z4: 0%, Z5: 0%, Z6: 10%, Z7: 0%";
  const r = ride({ text });
  assert.equal(classifyCycling(r).powerSprint, 6);
  assert.equal(classifyCycling(r).hrHigh, 0);
});

test("clock runs from workout END and is not released by a later easy spin", () => {
  const hard = ride({ hoursAgo: 47, duration: 180, rpe: 8 });
  const recovery = ride({ hoursAgo: 1, duration: 10, rpe: 1 });
  const result = assessCycling([hard, recovery], at);
  assert.equal(result.blocked, true);
  assert.equal(result.remainingHours, 1);
});

test("duplicate rides count once and future/ongoing rides do not affect assessment", () => {
  const r = ride({ rpe: 8 });
  const future = ride({ hoursAgo: -1, rpe: 10 });
  const result = assessCycling([r, r, future], at);
  assert.equal(result.sessions.length, 1);
  assert.equal(result.load48, 480);
});

test("long endurance rides and repeated moderate rides accumulate local restrictions", () => {
  assert.equal(assessCycling([ride({ duration: 120, rpe: 5 })], at).blocked, true);
  assert.equal(assessCycling([ride({ hoursAgo: 25, duration: 120, rpe: 5 })], at).blocked, false);
  const rides = [ride({ hoursAgo: 30, duration: 100, rpe: 5 }), ride({ hoursAgo: 10, duration: 100, rpe: 5 })];
  const result = assessCycling(rides, at);
  assert.equal(result.load48, 1000);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /多次骑行/);
});

test("48-hour expiry still requires leg symptoms and warmup reassessment", () => {
  const r = ride({ hoursAgo: 49, rpe: 8 });
  assert.equal(evaluate([r]).cyclingRecheck, true);
  const checked = evaluate([r], { warmupRpeDelta: "0", warmupPain: "0", movementQuality: "normal" });
  assert.equal(checked.cyclingRecheck, false);
  assert.equal(checked.plan.targetGroup, "legs");
  const before = evaluate([ride({ hoursAgo: 47.99, rpe: 8 })], { warmupRpeDelta: "0", warmupPain: "0", movementQuality: "normal" });
  assert.notEqual(before.plan.targetGroup, "legs");
});

test("actual lower-limb soreness uses the UI's 1–5 scale and overrides elapsed time", () => {
  const result = evaluate([ride({ hoursAgo: 80, rpe: 8 })], { lowerSoreness: "4", preference: "legs" });
  assert.notEqual(result.plan.targetGroup, "legs");
  assert.match(result.fatigueSummary, /腿受限/);
  assert.ok(result.strengthGroupScores.legs <= 54);
});

test("manual preference cannot bypass hard-cycling recovery, even at high systemic readiness", () => {
  for (const preference of ["legs", "lower", "auto", "strength", "cycling", "boxing"]) {
    const result = evaluate([ride({ rpe: 8 })], { preference });
    assert.ok(result.readiness >= 80);
    assert.notEqual(result.plan.targetGroup, "legs");
    assert.equal(result.cyclingTempoAllowed, false);
    assert.doesNotMatch(result.plan.detail, /3×6/);
  }
});

test("recovery cycling's rendered steps never contain tempo sets", () => {
  const result = evaluate([ride({ rpe: 8 })], { preference: "cycling" });
  assert.equal(result.decision, "恢复性活动（腿部受限）");
  const html = renderToStaticMarkup(createElement(CyclingSteps, { tempoAllowed: result.cyclingTempoAllowed, recovering: result.cyclingCooldown, dose: result.plan.dose }));
  assert.doesNotMatch(html, /3×6/);
  assert.match(html, /不安排节奏/);
  assert.match(html, /包含热身和放松/);
  const unrestricted = evaluate([], { preference: "cycling" });
  assert.equal(unrestricted.cyclingTempoAllowed, true);
});

test("missing intensity data remains unknown rather than a zero-load assurance", () => {
  const r = ride({ rpe: null });
  assert.equal(classifyCycling(r).unknown, true);
  assert.equal(evaluate([r]).cycling.incomplete, true);
  assert.notEqual(evaluate([r]).plan.targetGroup, "legs");
  assert.match(evaluate([r]).dataWarnings.join(" "), /缺少RPE/);
  assert.equal(readCyclingHistory("broken"), null);
  assert.equal(readCyclingHistory("{}"), null);
  assert.equal(assessCycling(null, at).load48, null);
});

test("explicit sprint tag and a manually dated supplement work without power and do not double load", () => {
  assert.equal(classifyCycling(ride({ text: "Workout Tag: 6×10秒反复冲刺" })).kind, "sprint");
  assert.equal(classifyCycling(ride({ text: "Workout Tag: 轻松骑，无冲刺" })).kind, "ordinary");
  const result = evaluate([ride({ rpe: 8 })], { cyclingManualKind: "sprint", cyclingManualEnd: "2026-09-16T18:00" });
  assert.equal(result.cycling.load48, 480);
  assert.equal(result.cycling.blocked, true);
  const future = assessCycling([], at, { kind: "sprint", end: at + HOUR });
  assert.equal(future.blocked, false);
});

test("legacy 36h flag is preserved conservatively until the original report is reimported", () => {
  const result = evaluateReadiness({ ...good, cyclingHistory: "", cyclingAsOf: "", hardCycling36: "1", preference: "legs" });
  assert.notEqual(result.plan.targetGroup, "legs");
  assert.match(result.allLimitations.join(" "), /旧版/);
});

test("full importer reads missing-RPE power sprints, indoor aliases and keeps leg strength sets zero", () => {
  const source = report(`Type: Virtual Ride, Date: 09-16 18:00, Duration: 60 mins, Average HR: 110, Max HR: 150\n${power([10, 85, 0, 0, 0, 4, 1])}`);
  const parsed = parsePastedData(source);
  const rides = readCyclingHistory(parsed.values.cyclingHistory);
  assert.equal(rides.length, 1);
  assert.equal(rides[0].rpe, null);
  assert.equal(rides[0].end, wallTime("2026-09-16 19:00"));
  assert.equal(classifyCycling(rides[0]).kind, "sprint");
  assert.equal(parsed.values.legsSets48, "0");
  assert.equal(parsed.values.legsSets7, "0");
  assert.equal(parsed.values.aerobicMinutes7, "60");
  assert.equal(parsed.values.workoutLoad, undefined);
});

test("full importer excludes ongoing workouts and deduplicates pasted entries", () => {
  const line = "Type: 室内单车, Date: 09-16 18:00, Duration: 60 mins, RPE: 8\n";
  const source = report(`${line}${line}Type: 户外骑行, Date: 09-17 08:00, Duration: 120 mins, RPE: 8\n`);
  const parsed = parsePastedData(source);
  assert.equal(readCyclingHistory(parsed.values.cyclingHistory).length, 1);
  assert.equal(parsed.values.workoutLoad, "480");
  assert.equal(parsed.audit.excludedAfterEvaluation, 1);
});

test("date changes cannot silently use yesterday's assessment time or freshness", () => {
  assert.equal(assessmentTime("2026-09-18", "2026-09-17 08:00"), wallTime("2026-09-18 09:00"));
  assert.equal(evaluate([], { date: "2026-09-18" }).cyclingUncertain, true);
  assert.ok(Number.isNaN(wallTime("2026-09-31 10:00")));
});

test("preserves the previously deployed 7.5-hour sleep debt baseline", () => {
  assert.equal(evaluate([], { sleep3avg: "7.5" }).sleepDebt3d, 0);
  assert.equal(evaluate([], { sleep3avg: "7" }).sleepDebt3d, 1.5);
  assert.equal(evaluate([], { sleep3avg: "8" }).sleepDebt3d, 0);
});

test("invalid manual finish time cannot be mistaken for a cleared sprint session", () => {
  const result = evaluate([], { cyclingManualKind: "sprint", cyclingManualEnd: "", preference: "legs", warmupRpeDelta: "0", warmupPain: "0", movementQuality: "normal" });
  assert.equal(result.cyclingLegBlock, true);
  assert.notEqual(result.plan.targetGroup, "legs");
  assert.match(result.dataWarnings.join(" "), /结束时间/);
});

test("painful legs plus unavailable upper body fall back to rest, not cycling", () => {
  const result = evaluate([ride({ rpe: 8 })], { pain: "2", painArea: "左膝", preference: "legs", pushSets48: "10", pullSets48: "10" });
  assert.equal(result.plan.title, "休息与无痛轻活动");
  assert.equal(result.strengthScore, null);
  assert.equal(result.cyclingTempoAllowed, false);
});

test("JSON roundtrip retains optional intensity and rejects corrupted ride data", () => {
  const r = ride({ rpe: null, text: power([10, 85, 0, 0, 0, 4, 1]) });
  const history = readCyclingHistory(JSON.stringify([r]));
  assert.equal(classifyCycling(history[0]).kind, "sprint");
  assert.equal(readCyclingHistory(JSON.stringify([{ ...r, end: r.start - 1 }])), null);
});

test("workout-end restriction remains active across midnight", () => {
  const parsed = parsePastedData(report("Type: 户外骑行, Date: 09-16 23:30, Duration: 90 mins, RPE: 8\n"));
  const history = readCyclingHistory(parsed.values.cyclingHistory);
  assert.equal(history[0].end, wallTime("2026-09-17 01:00"));
  assert.equal(assessCycling(history, at).remainingHours, 40);
});

test("a malformed cycling record cannot masquerade as confirmed no riding", () => {
  const parsed = parsePastedData(report("Type: 户外骑行, Date: 09-16 25:00, Duration: 60 mins, RPE: 9\n"));
  const result = evaluateReadiness({ ...good, ...parsed.values });
  assert.equal(result.cyclingUncertain, true);
  assert.notEqual(result.plan.targetGroup, "legs");
  assert.match(parsed.fields.join(" "), /未识别项/);
});
