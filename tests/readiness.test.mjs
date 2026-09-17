import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(async () => vite.close());
const { default: Home, evaluateReadiness, parsePastedData, expireDailyValues, updateFormField, applyImportedData, recordFirstSetFeedback } = await vite.ssrLoadModule("/app/page.tsx");
const { wallTime, parseCyclingSession } = await vite.ssrLoadModule("/lib/cycling.ts");
const { assessActivityLoad, readActivityHistory } = await vite.ssrLoadModule("/lib/activity-load.ts");
const at = wallTime("2026-09-17 09:00"), HOUR = 3_600_000;
const bench = { name: "杠铃卧推", weight: 100, unit: "kg", reps: 8, sets: 3, group: "push", date: "2026-09-10", time: "09:00", timestamp: wallTime("2026-09-10 09:00"), sessionRpe: 6 };
const good = {
  date: "2026-09-17", evaluationAt: "2026-09-17 09:00", cyclingAsOf: "2026-09-17 09:00", cyclingHistory: "[]", activityHistory: "[]", activityAsOf: "2026-09-17 09:00",
  hrv: "65", hrvBaseline: "65", hrv3d: "65", hrv7avg: "65", hrv7sd: "5", sleep: "7.5", timeInBed: "8", sleep3avg: "7.5", sleepDays3: "3",
  rhr: "50", rhrBaseline: "50", atl: "80", ctl: "100", atlYesterday: "80", monotony: "1", density: "0.8",
  pushSets7: "10", pullSets7: "12", legsSets7: "0", pushSets48: "0", pullSets48: "0", legsSets48: "0",
  fatiguePush: "no", fatiguePull: "no", fatigueLegs: "no", lowerSoreness: "1", upperSoreness: "1", pain: "0", symptoms: "none", preference: "push", strengthHistory: JSON.stringify([bench]),
};
const evaluate = extra => evaluateReadiness({ ...good, ...extra });
const activity = ({ type = "爬楼", duration = 60, rpe = 9, age = 15, detail = "" } = {}) => ({ type, duration, rpe, detail, end: at - age * HOUR, start: at - age * HOUR - duration * 60_000 });
const report = (entries = "", sleeps = "") => `User: Synthetic\nGenerated At: 2026-09-17\nDate Range: 2026-09-01 - 2026-09-17\nWorkout Filter: 所有运动\nWorkout list, each line is an entry of workout\n${entries}\nATL(Fatigue)\nDate: 09-17, ATL: 80\nCTL(Fitness)\nDate: 09-17, CTL: 100\nSleep Session Detail:\n${sleeps}\nAverage HRV Value During Sleep Session:\n2026/9/17 HRV: 65 ms\nResting Heart Rate of Each Day:\n2026/9/17: 50 bpm`;
const sleep = (start, end, hours) => `${start} - ${end}\nTotal: ${hours}h\nCore: ${hours}h\nDeep: 0h\nREM: 0h\nWakeUp: 0h`;
const nights = [17, 16, 15].map(day => sleep(`2026年9月${day - 1}日 23:00`, `2026年9月${day}日 07:00`, 8));
const firstWeight = result => Number(/^([\d.]+)/.exec(result.plan.exercises[0].prescription)?.[1]);

test("RIR feedback cannot reverse today's Moderate or Low weight reduction", () => {
  for (const extra of [{ warmupRpeDelta: "2" }, { hrv: "55" }]) {
    const initial = { ...good, ...extra };
    const cap = firstWeight(evaluateReadiness(initial));
    for (const rir of [0, 1, 2, 3, 4, 5]) {
      let state = recordFirstSetFeedback(initial, "firstSetWeight", "100");
      state = recordFirstSetFeedback(state, "firstSetRir", String(rir));
      const output = evaluateReadiness(state);
      assert.ok(firstWeight(output) <= cap, `RIR ${rir} exceeded ${cap}kg`);
      if (rir <= 2) assert.ok(firstWeight(output) < cap);
      assert.match(output.plan.dose, /RPE [35]/);
    }
  }
});

test("RIR uses actual first-set weight, and repeated edits do not compound reductions", () => {
  let state = recordFirstSetFeedback({ ...good, warmupRpeDelta: "2" }, "firstSetWeight", "50");
  state = recordFirstSetFeedback(state, "firstSetRir", "2");
  const output = firstWeight(evaluateReadiness(state));
  assert.ok(output < 50);
  state = recordFirstSetFeedback(state, "firstSetRir", "1");
  assert.equal(firstWeight(evaluateReadiness(state)), output);
});

test("increases require actual weight and pain-free stable movement, and stay bounded", () => {
  let state = recordFirstSetFeedback(good, "firstSetRir", "5");
  assert.equal(firstWeight(evaluateReadiness(state)), 100);
  state = recordFirstSetFeedback(state, "firstSetWeight", "100");
  assert.equal(firstWeight(evaluateReadiness(state)), 100);
  state = updateFormField(updateFormField(state, "movementQuality", "normal"), "warmupPain", "0");
  assert.equal(firstWeight(evaluateReadiness(state)), 102.5);
  state = recordFirstSetFeedback(state, "firstSetWeight", "150");
  assert.equal(firstWeight(evaluateReadiness(state)), 102.5);
});

test("first-set feedback is bound to the exercise and cleared on preference changes", () => {
  const calibrated = recordFirstSetFeedback(good, "firstSetRir", "2");
  const other = updateFormField(calibrated, "preference", "legs");
  assert.equal(other.firstSetRir, "");
  assert.equal(other.firstSetExercise, "");
  const mismatched = evaluate({ firstSetExercise: "another exercise", firstSetRir: "2" });
  assert.equal(firstWeight(mismatched), 100);
});

test("rounding on light equipment never increases a downgraded weight", () => {
  const light = { ...bench, weight: 2 };
  const result = evaluate({ strengthHistory: JSON.stringify([light]), warmupRpeDelta: "2" });
  assert.ok(firstWeight(result) <= 1.4);
  let lightState = recordFirstSetFeedback({ ...good, strengthHistory: JSON.stringify([light]), movementQuality: "normal", warmupPain: "0" }, "firstSetWeight", "2");
  lightState = recordFirstSetFeedback(lightState, "firstSetRir", "5");
  assert.equal(firstWeight(evaluateReadiness(lightState)), 2);
});

test("dated observations survive same-day reload but expire on the following day", () => {
  const snapshot = expireDailyValues(good).form;
  const same = expireDailyValues(snapshot, good.date, true).form;
  assert.equal(evaluateReadiness(same).readiness, evaluateReadiness(good).readiness);
  const next = expireDailyValues(snapshot, "2026-09-18", true);
  assert.equal(next.form.hrv, "");
  assert.equal(next.form.sleep, "");
  assert.equal(next.form.pain, "");
  assert.equal(next.form.fatiguePush, "unknown");
  assert.equal(next.form.strengthHistory, good.strengthHistory);
  assert.equal(evaluateReadiness(next.form).readiness, null);
  assert.ok(next.expired.length > 10);
});

test("legacy undated drafts require reimport without discarding dated workout history", () => {
  const migrated = expireDailyValues(good, good.date, true);
  assert.equal(migrated.form.hrv, "");
  assert.equal(migrated.form.strengthHistory, good.strengthHistory);
  assert.equal(evaluateReadiness(migrated.form).recovery, null);
});

test("editing one fresh field never refreshes yesterday's other observations", () => {
  const snapshot = expireDailyValues(good).form;
  const edited = updateFormField({ ...snapshot, date: "2026-09-18" }, "hrv", "70");
  assert.equal(edited.hrv, "70");
  assert.equal(edited.rhr, "");
  assert.equal(edited.pain, "");
  assert.equal(JSON.parse(edited.fieldDates).hrv, "2026-09-18");
  assert.equal(evaluateReadiness(edited).readiness, null);
});

test("full reimport clears all absent readings even if the report is from the same day", () => {
  const loaded = applyImportedData(expireDailyValues(good).form, { values: { date: good.date, hrv: "64" }, fields: ["HRV"] }, true);
  for (const key of ["rhr", "rhrBaseline", "sleep", "sleep3avg", "hrvBaseline", "atl", "density", "pain"]) assert.equal(loaded[key], "", key);
  assert.equal(loaded.hrv, "64");
  assert.equal(evaluateReadiness(loaded).readiness, null);
});

test("partial input only reuses observations already tagged with the same assessment date", () => {
  const snapshot = expireDailyValues(good).form;
  const same = applyImportedData(snapshot, { values: { hrv: "70" }, fields: ["HRV"] }, false);
  assert.equal(same.rhr, "50");
  const next = applyImportedData(snapshot, { values: { date: "2026-09-18", hrv: "70" }, fields: ["HRV"] }, false);
  assert.equal(next.rhr, "");
  assert.equal(evaluateReadiness(next).readiness, null);
});

test("three-day sleep uses daily totals, includes naps, deduplicates records and excludes future naps", () => {
  const nap = sleep("2026年9月16日 15:00", "2026年9月16日 16:00", 1);
  const future = sleep("2026年9月17日 15:00", "2026年9月17日 16:00", 1);
  const parsed = parsePastedData(report("", [...nights, nights[0], nap, nap, future].join("\n")));
  assert.equal(parsed.values.sleep, "8");
  assert.equal(parsed.values.sleepDays3, "3");
  assert.equal(parsed.values.sleep3avg, "8.33");
  assert.equal(evaluate(parsed.values).sleepDebt3d, 0);
});

test("missing sleep days remain unknown instead of fabricating a three-day average", () => {
  const parsed = parsePastedData(report("", nights[0]));
  assert.equal(parsed.values.sleepDays3, "1");
  assert.equal(parsed.values.sleep3avg, undefined);
  const result = evaluate({ ...parsed.values, sleep3avg: "" });
  assert.equal(result.sleepDebt3d, null);
  assert.notEqual(result.recoveryConfidence, "高");
});

test("overlapping sleep from another device does not inflate daily sleep", () => {
  const overlap = sleep("2026年9月17日 00:00", "2026年9月17日 07:00", 7);
  const parsed = parsePastedData(report("", [...nights, overlap].join("\n")));
  assert.equal(parsed.values.sleep3avg, "8");
});

test("sleep debt changes recovery and the actual prescription at the 7.5-hour baseline", () => {
  const normal = evaluate({ sleep3avg: "7.5" });
  const debt = evaluate({ sleep3avg: "5" });
  assert.equal(normal.sleepDebt3d, 0);
  assert.equal(debt.sleepDebt3d, 7.5);
  assert.ok(debt.recovery < normal.recovery);
  assert.ok(debt.readiness < normal.readiness);
  assert.equal(debt.readinessLevel.level, 2);
  assert.match(debt.plan.dose, /RPE 3–4/);
  assert.equal(firstWeight(debt), 70);
});

test("moderate local soreness lowers the actual weight, volume, duration and action", () => {
  const normal = evaluate({});
  const sore = evaluate({ upperSoreness: "3" });
  assert.ok(sore.readiness >= 80);
  assert.ok(sore.strengthGroupScores.push < 80);
  assert.match(sore.plan.title, /降量/);
  assert.match(sore.plan.dose, /40–50.*RPE 5–6/);
  assert.ok(sore.plan.exercises.length < normal.plan.exercises.length);
  assert.equal(firstWeight(sore), 90);
  assert.ok(sore.plan.exercises.every(item => item.rpe === "5–6"));
  assert.equal(sore.actionState, "MODIFY");
});

test("severe upper soreness blocks push, pull, swimming and boxing even with high global readiness", () => {
  for (const preference of ["push", "pull", "swimming", "boxing"]) {
    const result = evaluate({ upperSoreness: "5", preference });
    assert.ok(result.strengthGroupScores.push <= 54);
    assert.ok(result.strengthGroupScores.pull <= 54);
    assert.equal(result.plan.targetGroup, "legs");
  }
});

test("hard stairs affect legs without becoming strength sets or charging ATL again", () => {
  for (const type of ["爬楼", "爬楼梯", "Stair Climbing"]) {
    const parsed = parsePastedData(report(`Type: ${type}, Date: 09-16 18:00, Duration: 60 mins, RPE: 9`));
    assert.equal(parsed.values.aerobicMinutes7, "60");
    assert.equal(parsed.values.legsSets48, "0");
    assert.equal(parsed.values.legsSets7, "0");
    const result = evaluate({ ...parsed.values, preference: "legs" });
    assert.equal(result.activityBlocks.legs, true);
    assert.notEqual(result.plan.targetGroup, "legs");
    assert.equal(result.load, evaluate({}).load);
    assert.equal(result.cyclingTempoAllowed, false);
  }
});

test("sport mapping preserves unaffected groups and ordinary easy activities remain available", () => {
  const rows = [
    [activity({ type: "划船" }), [false, true, true]],
    [activity({ type: "游泳" }), [true, true, false]],
    [activity({ type: "游泳", detail: "蛙泳打腿" }), [true, true, true]],
    [activity({ type: "拳击" }), [true, false, true]],
    [activity({ type: "步行", rpe: 2, duration: 20 }), [false, false, false]],
  ];
  for (const [session, expected] of rows) {
    const actual = assessActivityLoad([session], at);
    assert.deepEqual(["push", "pull", "legs"].map(group => actual.groups[group].blocked), expected, session.type);
  }
});

test("long hikes and descents have a window from the end, while duplicate and ongoing records are excluded", () => {
  const hike = activity({ type: "徒步", duration: 240, rpe: 3, age: 23 });
  const result = assessActivityLoad([hike, hike, activity({ age: -1 })], at);
  assert.equal(result.sessions.length, 1);
  assert.equal(result.groups.legs.remainingHours, 1);
  assert.equal(assessActivityLoad([{ ...hike, start: hike.start - 2 * HOUR, end: hike.end - 2 * HOUR }], at).groups.legs.blocked, false);
  assert.equal(assessActivityLoad([activity({ type: "徒步", duration: 90, rpe: 3, detail: "下山" })], at).groups.legs.blocked, true);
});

test("missing sport intensity stays unknown and requires a local check", () => {
  const result = evaluate({ activityHistory: JSON.stringify([activity({ type: "划船", rpe: null })]), preference: "pull" });
  assert.equal(result.activity.incomplete, true);
  assert.equal(result.activity.missingRpe, 1);
  assert.notEqual(result.plan.targetGroup, "pull");
  assert.equal(readActivityHistory("broken"), null);
  assert.equal(readActivityHistory(JSON.stringify([{ ...activity(), end: 0 }])), null);
});

test("a hard sport's 48-hour expiry still requires local reassessment", () => {
  const extra = { activityHistory: JSON.stringify([activity({ type: "划船", age: 49 })]), preference: "pull" };
  assert.notEqual(evaluate(extra).plan.targetGroup, "pull");
  const checked = evaluate({ ...extra, warmupRpeDelta: "0", warmupPain: "0", movementQuality: "normal" });
  assert.equal(checked.activityBlocks.pull, false);
  assert.equal(checked.plan.targetGroup, "pull");
});

test("swimming stays gentle during a leg window and does not silently change to cycling", () => {
  const result = evaluate({ activityHistory: JSON.stringify([activity()]), preference: "swimming" });
  assert.match(result.plan.title, /游泳/);
  assert.match(result.plan.dose, /20–30.*RPE 2–3/);
  assert.match(result.plan.detail, /不安排.*强力打腿/);
  assert.equal(result.actionState, "RECOVER");
});

test("combined cycling and stairs accumulate one leg recovery restriction", () => {
  const cycling = parseCyclingSession({ type: "户外骑行", timestamp: at - 20 * HOUR - 75 * 60_000, duration: 75, rpe: 6 }, "");
  const result = evaluate({ preference: "legs", cyclingHistory: JSON.stringify([cycling]), activityHistory: JSON.stringify([activity({ duration: 75, rpe: 6 })]) });
  assert.equal(result.cycling.blocked, false);
  assert.equal(result.activity.groups.legs.blocked, false);
  assert.equal(result.legLoad48, 900);
  assert.equal(result.activityBlocks.legs, true);
  assert.notEqual(result.plan.targetGroup, "legs");
  assert.equal(result.load, evaluate({}).load);
});

test("strength cooldown, like cycling, starts at session end", () => {
  const source = report("Type: 力量训练, Date: 09-15 08:00, Duration: 120 mins, RPE: 6, Workout Tag: 杠铃卧推: 100kg × 8 × 3组");
  const parsed = parsePastedData(source);
  assert.equal(parsed.values.pushSets48, "3");
  assert.notEqual(evaluate({ ...parsed.values, preference: "push" }).plan.targetGroup, "push");
});

test("filtered or malformed activity exports cannot report complete local history", () => {
  const filtered = parsePastedData(report().replace("Workout Filter: 所有运动", "Workout Filter: 骑行"));
  assert.equal(filtered.values.activityAsOf, "");
  const malformed = parsePastedData(report("Type: 爬楼, Date: 09-16 25:00, Duration: 60 mins, RPE: 9"));
  assert.equal(malformed.values.activityAsOf, "");
  assert.equal(evaluate(malformed.values).activityUncertain, true);
});

test("HRV ratio and Z-score count as one signal and never diagnose CNS fatigue", () => {
  const result = evaluate({ hrv: "55" });
  assert.ok(result.hrvRatio < .9 && result.hrvZ < -1);
  assert.equal(result.rhrDelta, 0);
  assert.equal(result.neuralTriggers, 1);
  assert.equal(result.neuralKnownInputs, 2);
  assert.equal(result.neuralPressure, "Moderate");
  assert.equal(result.cnsFatigue, undefined);
  assert.equal(evaluate({ hrv: "55", rhr: "55" }).neuralTriggers, 2);
});

test("one warmup observation cannot grant complete-check confidence", () => {
  assert.equal(evaluate({ warmupPain: "0" }).warmupComplete, false);
  assert.equal(evaluate({ warmupPain: "0", warmupRpeDelta: "0", movementQuality: "normal", warmupHr: "normal", warmupEnergy: "same" }).warmupComplete, true);
});

test("rendered app presents the updated model without a CNS diagnosis label", () => {
  const html = renderToStaticMarkup(createElement(Home));
  assert.match(html, /v4\.9/);
  assert.match(html, /自主神经恢复信号/);
  assert.match(html, /其他专项活动与局部恢复/);
  assert.doesNotMatch(html, /CNS fatigue|CNS Fatigue/);
});
