// Coaching defaults, not a validated physiological recovery model or set-equivalence.
// Repeated-sprint recovery evidence: https://pubmed.ncbi.nlm.nih.gov/33300757/
export const CYCLING_RULES = {
  hardRecoveryHours: 48,
  enduranceRecoveryHours: 24,
  reassessmentHours: 72,
  sprintMinutes: 1,
  neuromuscularMinutes: .5,
  thresholdMinutes: 10,
  vo2Minutes: 5,
  cumulativeLoad48: 900,
} as const;

const HOUR = 3_600_000;
export const isCycling = (type: string) => /骑行|骑车|自行车|单车|cycling|\bbike\b|\bride\b/i.test(type);
export type CyclingSession = {
  type: string; start: number; end: number; duration: number; rpe: number | null;
  power: Array<number | null>; hr: Array<number | null>;
  sprint: boolean; hardTag: boolean;
};

// The exported dates have no offset. Use a consistent wall-clock timeline,
// just like the existing strength importer (do not mix with browser timezone).
export function assessmentTime(date: string, at = "") {
  const value = at.startsWith(date) ? at : `${date} 09:00`;
  return wallTime(value);
}
export function wallTime(value: string) {
  const normalized = value.trim().replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(normalized)) return NaN;
  const stamp = Date.parse(`${normalized}Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().startsWith(normalized) ? stamp : NaN;
}

function parseZones(text: string, duration: number) {
  const power: Array<number | null> = Array(8).fill(null);
  const hr: Array<number | null> = Array(6).fill(null);
  const headers = [...text.matchAll(/(Power\s+Zones?(?:\s+Distribution)?|HR\s+Zones?(?:\s+Distribution)?|Heart Rate\s+Zones?(?:\s+Distribution)?|功率区间|心率区间)\s*[:：]/gi)];
  const barePower = /\bZ\s*[67]\s*[:：]/i.test(text);
  for (const match of text.matchAll(/(?:\b(Power|HR|Heart Rate)\s+)?\b(Zone|Z)\s*([0-7])\s*[:：]\s*(-?\d+(?:\.\d+)?)\s*%/gi)) {
    const header = headers.filter(item => item.index! < match.index!).at(-1)?.[1];
    const kind = match[1] ?? header ?? (match[2].toLowerCase() === "z" && barePower ? "Power" : "HR");
    const target = /Power|功率/i.test(kind) ? power : hr;
    const zone = Number(match[3]), pct = Number(match[4]);
    if (zone >= target.length || (target === power && zone === 0)) continue;
    target[zone] = pct >= 0 && pct <= 100 ? duration * pct / 100 : null;
  }
  // Reject impossible distributions instead of manufacturing high-zone exposure.
  for (const zones of [power, hr]) {
    const total = zones.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    if (total > duration * 1.05) zones.fill(null);
  }
  return { power, hr };
}

export function parseCyclingSession(workout: { type: string; timestamp: number; duration: number; rpe: number | null }, text: string): CyclingSession | null {
  if (!isCycling(workout.type) || !Number.isFinite(workout.timestamp) || !(workout.duration > 0)) return null;
  const tag = (/Workout Tag\s*:\s*([\s\S]*)/i.exec(text)?.[1] ?? "")
    .replace(/(?:没有|未做|不做|不含|无|非|without|no)\s*[^,，;；。\n]{0,12}(?:冲刺|sprints?|高强度|HIIT)/gi, "");
  return {
    type: workout.type, start: workout.timestamp, end: workout.timestamp + workout.duration * 60_000,
    duration: workout.duration, rpe: workout.rpe !== null && workout.rpe >= 0 && workout.rpe <= 10 ? workout.rpe : null,
    ...parseZones(text, workout.duration),
    sprint: /冲刺|sprint|wingate|高扭矩|低踏频.{0,8}(?:高阻|力量|间歇)|大齿比.{0,8}间歇/i.test(tag),
    hardTag: /HIIT|高强度间歇|无氧间歇|阈值间歇/i.test(tag),
  };
}

export function readCyclingHistory(raw: string): CyclingSession[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    const valid = value.every((item: CyclingSession) => item && typeof item.type === "string" && isCycling(item.type)
      && Number.isFinite(item.start) && Number.isFinite(item.end) && Number.isFinite(item.duration) && item.duration > 0
      && Math.abs(item.end - item.start - item.duration * 60_000) < 1
      && (item.rpe === null || Number.isFinite(item.rpe) && item.rpe >= 0 && item.rpe <= 10)
      && [item.power, item.hr].every(zones => Array.isArray(zones) && zones.every(n => n === null || Number.isFinite(n) && n >= 0 && n <= item.duration))
      && item.power.length === 8 && item.hr.length === 6 && typeof item.sprint === "boolean" && typeof item.hardTag === "boolean");
    return valid ? value as CyclingSession[] : null;
  } catch { return null; }
}

const knownSum = (values: Array<number | null>) => values.some(x => x !== null) ? values.reduce<number>((sum, x) => sum + (x ?? 0), 0) : null;
const complete = (values: Array<number | null>, duration: number) => values.every(x => x !== null) && (knownSum(values) ?? 0) >= duration * .95;

export function classifyCycling(session: CyclingSession) {
  const { power, hr, duration, rpe } = session;
  const powerHigh = knownSum(power.slice(4)), powerSprint = knownSum(power.slice(6));
  const hrHigh = knownSum(hr.slice(4));
  const powerComplete = complete(power.slice(1), duration);
  const load = rpe === null ? null : duration * rpe;
  const sprint = session.sprint || (powerSprint ?? 0) >= CYCLING_RULES.sprintMinutes || (power[7] ?? 0) >= CYCLING_RULES.neuromuscularMinutes;
  const reasons: string[] = [];
  if (session.sprint) reasons.push("训练标签：冲刺/高扭矩");
  if ((powerSprint ?? 0) >= CYCLING_RULES.sprintMinutes || (power[7] ?? 0) >= CYCLING_RULES.neuromuscularMinutes) reasons.push(`功率Z6–7累计${powerSprint?.toFixed(1)}分钟`);
  if ((powerHigh ?? 0) >= CYCLING_RULES.thresholdMinutes || (knownSum(power.slice(5)) ?? 0) >= CYCLING_RULES.vo2Minutes) reasons.push(`功率Z4–7累计${powerHigh?.toFixed(1)}分钟`);
  // Heart-rate zones are a fallback stress signal, never "anaerobic power zones".
  if (!powerComplete && (hrHigh ?? 0) >= 10) reasons.push(`心率Z4–5累计${hrHigh?.toFixed(1)}分钟（估计）`);
  if (rpe !== null && rpe >= 7) reasons.push(`整节RPE ${rpe}`);
  if (session.hardTag) reasons.push("训练标签：高强度间歇");
  const hard = sprint || reasons.length > 0;
  const endurance = !hard && (load ?? 0) >= 600;
  const unknown = !hard && !endurance && rpe === null && !powerComplete && !complete(hr, duration);
  return { load, powerHigh, powerSprint, hrHigh, unknown,
    kind: sprint ? "sprint" : hard ? "hard" : endurance ? "endurance" : unknown ? "unknown" : "ordinary",
    label: sprint ? "冲刺/高扭矩" : hard ? "高强度骑行" : endurance ? "高量耐力骑行" : unknown ? "强度资料不足" : "普通耐力骑行",
    windowHours: hard ? CYCLING_RULES.hardRecoveryHours : endurance ? CYCLING_RULES.enduranceRecoveryHours : 0,
    reason: reasons.join("；") || (endurance ? `时长×RPE=${load?.toFixed(0)} AU` : unknown ? "缺少RPE和完整强度区间" : "未触发局部恢复限制"),
  };
}

export function assessCycling(history: CyclingSession[] | null, at: number, manual?: { kind: string; end: number }) {
  const unique = new Map<string, CyclingSession>();
  for (const ride of history ?? []) {
    // Dedupe duplicate entries; an easier subsequent ride never erases an earlier hard ride.
    if (ride.end <= at && at - ride.end < 7 * 24 * HOUR) unique.set(`${ride.start}:${ride.duration}`, ride);
  }
  const sessions = [...unique.values()].sort((a, b) => b.end - a.end).map(ride => ({ ...ride, ...classifyCycling(ride), ageHours: (at - ride.end) / HOUR }));
  const recent = sessions.filter(ride => ride.ageHours < 48);
  const loads = recent.filter(ride => ride.load !== null);
  const totalKnownLoad48 = loads.reduce((sum, ride) => sum + ride.load!, 0);
  const recentSubstantial = loads.find(ride => ride.load! >= 150 && ride.ageHours < 24);
  const accumulated = totalKnownLoad48 >= CYCLING_RULES.cumulativeLoad48 && recentSubstantial;
  const windows = sessions.filter(ride => ride.windowHours > ride.ageHours).map(ride => ({
    until: ride.end + ride.windowHours * HOUR,
    reason: `${ride.label}：${ride.reason}；结束后${ride.windowHours}小时内暂缓腿力量与强骑`,
  }));
  if (accumulated) windows.push({ until: recentSubstantial.end + 24 * HOUR, reason: `48小时多次骑行已知负荷${totalKnownLoad48.toFixed(0)} AU，避免继续叠加腿部负荷` });
  const manualValid = manual && ["hard", "sprint"].includes(manual.kind) && Number.isFinite(manual.end) && manual.end <= at;
  if (manualValid && at - manual.end < 48 * HOUR) windows.push({ until: manual.end + 48 * HOUR, reason: "手动补充高强度/冲刺：结束后48小时暂缓腿力量与强骑（不重复计入负荷）" });
  windows.sort((a, b) => b.until - a.until);
  const reassess = sessions.some(ride => ride.windowHours === 48 && ride.ageHours >= 48 && ride.ageHours < CYCLING_RULES.reassessmentHours)
    || !!(manualValid && at - manual.end >= 48 * HOUR && at - manual.end < CYCLING_RULES.reassessmentHours * HOUR);
  const incomplete = history === null || recent.some(ride => ride.unknown);
  return {
    sessions, blocked: windows.length > 0, reason: windows[0]?.reason ?? "", reassess, incomplete,
    remainingHours: windows.length ? (windows[0].until - at) / HOUR : 0,
    load48: history === null ? null : totalKnownLoad48,
    load7: history === null ? null : sessions.reduce((sum, ride) => sum + (ride.load ?? 0), 0),
    missingRpe: sessions.filter(ride => ride.rpe === null).length,
    minutes7: history === null ? null : sessions.reduce((sum, ride) => sum + ride.duration, 0),
  };
}
