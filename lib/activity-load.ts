import { isCycling } from "./cycling";

export type LocalGroup = "push" | "pull" | "legs";
export type ActivitySession = { type: string; start: number; end: number; duration: number; rpe: number | null; detail: string };
const HOUR = 3_600_000;
export const ACTIVITY_RULES = { hardRpe: 7, hardMinimumMinutes: 10, highVolumeAu: 600, cumulativeAu48: 900, hardHours: 48, volumeHours: 24 } as const;

// These are conservative scheduling rules, not strength-set equivalents.
export function activityGroups(type: string, detail = ""): LocalGroup[] {
  if (isCycling(type) || /力量|strength|weight training/i.test(type)) return [];
  if (/划船|赛艇|rowing|rower/i.test(type)) return ["pull", "legs"];
  if (/游泳|swim/i.test(type)) return /蛙泳|打腿|蹬腿|breaststroke|kick/i.test(detail) ? ["push", "pull", "legs"] : ["push", "pull"];
  if (/拳击|搏击|boxing|kickbox/i.test(type)) return ["push", "legs"];
  if (/hyrox|hiit|高强度间歇|循环训练|crossfit/i.test(type)) return ["push", "pull", "legs"];
  if (/爬楼|楼梯|登阶|徒步|登山|爬山|跑步|越野|跑山|步行|散步|椭圆机|stair|stepper|hiking|hike|trek|running|\brun\b|walking|\bwalk\b|elliptical/i.test(type)) return ["legs"];
  return [];
}

export function isAerobicActivity(type: string) { return isCycling(type) || activityGroups(type).length > 0; }

export function readActivityHistory(raw: string): ActivitySession[] | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every((x: ActivitySession) => x && typeof x.type === "string" && typeof x.detail === "string"
      && Number.isFinite(x.start) && Number.isFinite(x.end) && Number.isFinite(x.duration) && x.duration > 0
      && Math.abs(x.end - x.start - x.duration * 60_000) < 1
      && (x.rpe === null || Number.isFinite(x.rpe) && x.rpe >= 0 && x.rpe <= 10))) return null;
    return data as ActivitySession[];
  } catch { return null; }
}

export function assessActivityLoad(history: ActivitySession[] | null, at: number) {
  const unique = new Map<string, ActivitySession>();
  for (const session of history ?? []) {
    if (session.end <= at && at - session.end < 7 * 24 * HOUR && activityGroups(session.type).length)
      unique.set(`${session.type}:${session.start}:${session.duration}`, session);
  }
  const sessions = [...unique.values()].sort((a, b) => b.end - a.end).map(session => {
    const load = session.rpe === null ? null : session.duration * session.rpe;
    const tag = session.detail.replace(/(?:无|未做|没有|no|without)\s*(?:冲刺|高强度|HIIT|sprints?)/gi, "");
    const hard = session.duration >= ACTIVITY_RULES.hardMinimumMinutes && ((session.rpe ?? 0) >= ACTIVITY_RULES.hardRpe || /HIIT|高强度间歇|冲刺|sprint/i.test(tag));
    const longHike = /徒步|登山|爬山|hiking|hike|trek/i.test(session.type) && session.duration >= 180;
    const descent = /下山|下坡|downhill|descent/i.test(tag) && session.duration >= 60;
    const volume = (load ?? 0) >= ACTIVITY_RULES.highVolumeAu || longHike || descent;
    const hours = hard ? ACTIVITY_RULES.hardHours : volume ? ACTIVITY_RULES.volumeHours : 0;
    return { ...session, groups: activityGroups(session.type, session.detail), load, hours, ageHours: (at - session.end) / HOUR,
      unknown: session.rpe === null,
      reason: hard ? `高强度${session.rpe === null ? "标签" : ` RPE ${session.rpe}`}` : descent ? "长时间下坡/下山" : longHike ? "长时间徒步/登山" : volume ? `高量 ${load?.toFixed(0)} AU` : "未触发局部限制" };
  });
  const groups = Object.fromEntries((["push", "pull", "legs"] as const).map(group => {
    const related = sessions.filter(session => session.groups.includes(group));
    const recent = related.filter(session => session.ageHours < 48);
    const knownLoad48 = recent.reduce((sum, session) => sum + (session.load ?? 0), 0);
    const windows = related.filter(session => session.hours > session.ageHours).map(session => ({
      until: session.end + session.hours * HOUR, reason: `${session.type}：${session.reason}，结束后${session.hours}小时暂缓相关部位负荷`,
    }));
    const substantial = recent.find(session => (session.load ?? 0) >= 150 && session.ageHours < 24);
    if (knownLoad48 >= ACTIVITY_RULES.cumulativeAu48 && substantial) windows.push({ until: substantial.end + 24 * HOUR, reason: "48小时内多次专项活动累积高负荷" });
    windows.sort((a, b) => b.until - a.until);
    return [group, { blocked: windows.length > 0, remainingHours: windows.length ? (windows[0].until - at) / HOUR : 0,
      reason: windows[0]?.reason ?? "", unknown: recent.some(session => session.unknown),
      reassess: related.some(session => session.hours === 48 && session.ageHours >= 48 && session.ageHours < 72), knownLoad48 }];
  })) as Record<LocalGroup, { blocked: boolean; remainingHours: number; reason: string; unknown: boolean; reassess: boolean; knownLoad48: number }>;
  return { sessions, groups, incomplete: history === null || sessions.some(session => session.ageHours < 48 && session.unknown),
    load7: history === null ? null : sessions.reduce((sum, session) => sum + (session.load ?? 0), 0), missingRpe: sessions.filter(session => session.unknown).length };
}
