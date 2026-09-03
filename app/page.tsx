"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Brain, CheckCircle2, ClipboardPaste, Download, Dumbbell, Gauge, HeartPulse, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  date: string; hrv: string; hrvBaseline: string; hrv3d: string; hrv7avg: string; hrv7sd: string;
  sleep: string; timeInBed: string; rhr: string; rhrBaseline: string; atl: string; ctl: string;
  atlYesterday: string; atl3d: string; monotony: string; strain: string; density: string;
  strengthFrequency: string; workoutCount: string; workoutMinutes: string; workoutLoad: string; aerobicMinutes7: string; hardCycling36: string;
  evaluationAt: string; upperSets48: string; lowerSets48: string; pushSets48: string; pullSets48: string; legsSets48: string;
  pushSets7: string; pullSets7: string; legsSets7: string; strengthHistory: string;
  strengthFatigue: "unknown" | "none" | "push" | "pull" | "legs" | "upper" | "lower" | "full";
  fatiguePush: "unknown" | "no" | "yes"; fatiguePull: "unknown" | "no" | "yes"; fatigueLegs: "unknown" | "no" | "yes";
  neural: "unknown" | "normal" | "limited" | "fatigue";
  symptoms: "unknown" | "none" | "mild" | "acute";
  pain: string; painArea: string;
  energy: string; fatigue: string; motivation: string; stress: string;
  upperSoreness: string; lowerSoreness: string; sleepQuality: string; sleep3avg: string;
  warmupRpeDelta: string; warmupPain: string;
  warmupHr: "unknown" | "normal" | "high" | "low";
  movementQuality: "unknown" | "normal" | "reduced";
  warmupEnergy: "unknown" | "better" | "same" | "worse";
  firstSetRir: string;
  preference: "auto" | "strength" | "push" | "pull" | "legs" | "upper" | "lower" | "cycling" | "swimming" | "boxing";
};

type ScoredMetric = { value: number; weight: number };
const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const emptyForm: FormState = {
  date: "", hrv: "", hrvBaseline: "", hrv3d: "", hrv7avg: "", hrv7sd: "",
  sleep: "", timeInBed: "", rhr: "", rhrBaseline: "", atl: "", ctl: "", atlYesterday: "",
  atl3d: "", monotony: "", strain: "", density: "", strengthFrequency: "", workoutCount: "", workoutMinutes: "", workoutLoad: "", aerobicMinutes7: "", hardCycling36: "", evaluationAt: "", upperSets48: "", lowerSets48: "", pushSets48: "", pullSets48: "", legsSets48: "", pushSets7: "", pullSets7: "", legsSets7: "", strengthHistory: "", strengthFatigue: "unknown", fatiguePush: "unknown", fatiguePull: "unknown", fatigueLegs: "unknown", neural: "unknown",
  symptoms: "unknown", pain: "", painArea: "", energy: "", fatigue: "", motivation: "", stress: "",
  upperSoreness: "", lowerSoreness: "", sleepQuality: "", sleep3avg: "", warmupRpeDelta: "", warmupPain: "",
  warmupHr: "unknown", movementQuality: "unknown", warmupEnergy: "unknown", firstSetRir: "", preference: "auto",
};

const numberOrNull = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const weighted = (items: ScoredMetric[]) => {
  const denominator = items.reduce((sum, item) => sum + item.weight, 0);
  if (!denominator) return null;
  return items.reduce((sum, item) => sum + item.value * item.weight, 0) / denominator;
};
const display = (value: number | null, suffix = "", digits = 0) =>
  value === null ? "Unknown" : `${value.toFixed(digits)}${suffix}`;
const scoreHrvRatio = (x: number) => x >= 1.10 ? 95 : x >= .95 ? 85 : x >= .85 ? 70 : x >= .75 ? 55 : 40;
const scoreTrend = (x: number) => x >= 5 ? 95 : x >= -5 ? 85 : x >= -10 ? 70 : x >= -20 ? 55 : 40;
const scoreSleepHours = (x: number) => x >= 8.5 ? 95 : x >= 7 ? 85 : x >= 6 ? 70 : x >= 5 ? 55 : 40;
const scoreEfficiency = (x: number) => x >= 90 ? 85 : x >= 85 ? 70 : x >= 80 ? 55 : 40;
const scoreRhr = (x: number) => x <= -2 ? 95 : x <= 2 ? 85 : x < 3 ? 70 : x < 5 ? 55 : 40;
const scoreForm = (x: number) => x > 15 ? 95 : x > 5 ? 85 : x >= -5 ? 70 : x > -20 ? 55 : 40;
const scoreAcwr = (x: number) => x < .8 ? 70 : x <= 1.3 ? 85 : x < 1.5 ? 55 : 40;
const scoreSpike = (x: number) => x <= 10 ? 85 : x <= 25 ? 70 : 40;

function levelFor(score: number | null) {
  if (score === null) return { level: null, label: "Unknown", tone: "unknown" };
  if (score >= 90) return { level: 5, label: "Prime", tone: "prime" };
  if (score >= 80) return { level: 4, label: "High", tone: "high" };
  if (score >= 70) return { level: 3, label: "Moderate", tone: "moderate" };
  if (score >= 55) return { level: 2, label: "Low", tone: "low" };
  return { level: 1, label: "Poor", tone: "poor" };
}
const metricStatus = (score: number | null) => score === null ? "Unknown" : score >= 90 ? "表现突出" : score >= 80 ? "正常 / 良好" : score >= 70 ? "轻度限制" : score >= 55 ? "明显限制" : "异常 / 高风险";
const toneForScore = (score: number | null) => score === null ? "unknown" : score >= 90 ? "blue" : score >= 80 ? "green" : score >= 70 ? "yellow" : score >= 55 ? "orange" : "red";
const gaugeToneForScore = (score: number | null) => score === null ? "unknown" : score >= 90 ? "prime" : score >= 80 ? "high" : score >= 70 ? "moderate" : score >= 55 ? "low" : "poor";

type StrengthGroup = "push" | "pull" | "legs" | "core";
type StrengthHistoryItem = { name: string; canonicalName?: string; weight: number | null; unit: "kg" | "lbs" | "自重"; reps: number | null; sets: number; group: StrengthGroup; date: string; time: string; timestamp: number; sessionRpe: number; isWarmup?: boolean };
type ImportAudit = { evaluationAt: string; workouts: number; strengthSessions: number; excludedAfterEvaluation: number; exercises: StrengthHistoryItem[]; unparsed: string[] };
type ParsedData = { values: Partial<FormState>; fields: string[]; audit?: ImportAudit };
type PrescribedExercise = { name: string; prescription: string; rpe: string; rir: string; rest: string; source: string; progression: string };

function canonicalExerciseName(value: string) {
  const name = value.replace(/[【】*]/g, "").replace(/（[^）]*）|\([^)]*\)/g, "").replace(/\s+/g, "").trim();
  const aliases: Array<[RegExp, string]> = [
    [/(?:宽握|窄握|对握|拉杆|v-?bar|器械)*坐姿划船|宽握拉杆划船|v-?bar划船|器械划船/i, "坐姿划船"],
    [/(?:窄距|对握|v-?bar|中立握).*下拉/i, "中立握高位下拉"],
    [/(?:宽距|宽握).*下拉/i, "宽握高位下拉"],
    [/上斜.*哑铃.*卧推/i, "上斜哑铃卧推"],
    [/上斜.*史密斯.*卧推/i, "上斜史密斯卧推"],
    [/器械.*推胸|推胸机/i, "器械推胸"],
    [/杠铃.*卧推|卧推.*杠铃/i, "杠铃卧推"],
    [/台阶上步/i, "台阶上步"],
    [/保加利亚.*蹲/i, "保加利亚蹲"],
    [/坐姿.*腿屈伸|器械.*腿屈伸/i, "坐姿腿屈伸"],
    [/腿弯举|腿屈曲/i, "腿弯举"],
    [/悍马机.*臀冲|器械.*臀冲|臀推|臀冲/i, "臀冲"],
    [/俯身飞鸟|反向飞鸟|蝴蝶机.*飞鸟/i, "反向飞鸟"],
    [/绳索.*下压|v-?bar.*下压|直杆.*下压/i, "绳索下压"],
    [/锤式.*弯举/i, "锤式弯举"],
  ];
  return aliases.find(([pattern]) => pattern.test(name))?.[1] ?? name.toLowerCase();
}

function parseDuration(value: string) {
  const cleaned = value.toLowerCase().replace(/小时/g, "h").replace(/分钟|分/g, "m").trim();
  const colon = cleaned.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  if (colon) return Number(colon[1]) + Number(colon[2]) / 60;
  const hours = cleaned.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutes = cleaned.match(/(\d+)\s*m/);
  if (hours || minutes) return Number(hours?.[1] ?? 0) + Number(minutes?.[1] ?? 0) / 60;
  const decimal = cleaned.match(/\d+(?:\.\d+)?/);
  return decimal ? Number(decimal[0]) : null;
}

type DatedValue = { date: string; value: number };

function parseFullExport(source: string): ParsedData | null {
  if (!/Workout list, each line is an entry of workout/i.test(source) || !/ATL\(Fatigue\)/i.test(source)) return null;

  const values: Partial<FormState> = {};
  const fields: string[] = [];
  const save = <K extends keyof FormState>(key: K, label: string, value: FormState[K] | null) => {
    if (value === null || value === undefined || value === "") return;
    values[key] = value;
    if (!fields.includes(label)) fields.push(label);
  };
  const rounded = (value: number, digits = 2) => String(Number(value.toFixed(digits)));
  const mean = (items: number[]) => items.length ? items.reduce((sum, item) => sum + item, 0) / items.length : null;
  const median = (items: number[]) => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const populationSd = (items: number[]) => {
    const average = mean(items);
    if (average === null || !items.length) return null;
    return Math.sqrt(items.reduce((sum, item) => sum + (item - average) ** 2, 0) / items.length);
  };
  const dayStamp = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const section = (startMarker: string, endMarkers: string[]) => {
    const start = source.indexOf(startMarker);
    if (start < 0) return "";
    const ends = endMarkers.map(marker => source.indexOf(marker, start + startMarker.length)).filter(index => index >= 0);
    return source.slice(start + startMarker.length, ends.length ? Math.min(...ends) : source.length);
  };

  const headerDate = /Generated At:\s*(20\d{2}-\d{2}-\d{2})/i.exec(source)?.[1] ?? null;
  const rangeEndDate = /Date Range:\s*20\d{2}-\d{2}-\d{2}\s*-\s*(20\d{2}-\d{2}-\d{2})/i.exec(source)?.[1] ?? null;
  const embeddedDates = [...source.matchAll(/(20\d{2})(?:[-/]|年)(\d{1,2})(?:[-/]|月)(\d{1,2})(?:日)?/g)]
    .map(match => `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`)
    .filter(date => !Number.isNaN(Date.parse(`${date}T00:00:00Z`)))
    .sort();
  const generatedDate = headerDate ?? rangeEndDate ?? embeddedDates.at(-1) ?? today();
  save("date", headerDate || rangeEndDate ? "日期" : "日期（自动推断）", generatedDate);
  const generatedYear = Number(generatedDate.slice(0, 4));
  const generatedMonth = Number(generatedDate.slice(5, 7));
  const expandMonthDay = (monthDay: string) => {
    const [month, day] = monthDay.split("-").map(Number);
    const year = month > generatedMonth + 1 ? generatedYear - 1 : generatedYear;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const latestDate = generatedDate;
  const atOffset = (series: DatedValue[], daysAgo: number) => {
    const target = dayStamp(latestDate) - daysAgo * 86_400_000;
    return series.find(item => dayStamp(item.date) === target)?.value ?? null;
  };
  const recentValues = (series: DatedValue[], days: number) => series
    .filter(item => {
      const age = (dayStamp(latestDate) - dayStamp(item.date)) / 86_400_000;
      return age >= 0 && age < days;
    })
    .sort((a, b) => dayStamp(a.date) - dayStamp(b.date));

  const readLoadSeries = (marker: string, endMarkers: string[], metric: "ATL" | "CTL") => {
    const result: DatedValue[] = [];
    const block = section(marker, endMarkers);
    const pattern = new RegExp(`^Date:\\s*(\\d{2}-\\d{2}),\\s*${metric}:\\s*(-?\\d+(?:\\.\\d+)?)`, "gim");
    for (const match of block.matchAll(pattern)) result.push({ date: expandMonthDay(match[1]), value: Number(match[2]) });
    return result;
  };
  const atlSeries = readLoadSeries("ATL(Fatigue)", ["CTL(Fitness)"], "ATL");
  const ctlSeries = readLoadSeries("CTL(Fitness)", ["Sleep Session Detail:"], "CTL");
  save("atl", "ATL 今日", atOffset(atlSeries, 0) === null ? null : rounded(atOffset(atlSeries, 0)!));
  save("atlYesterday", "ATL 昨日", atOffset(atlSeries, 1) === null ? null : rounded(atOffset(atlSeries, 1)!));
  save("atl3d", "ATL 3日前", atOffset(atlSeries, 3) === null ? null : rounded(atOffset(atlSeries, 3)!));
  save("ctl", "CTL 今日", atOffset(ctlSeries, 0) === null ? null : rounded(atOffset(ctlSeries, 0)!));

  const hrvSeries: DatedValue[] = [];
  const hrvBlock = section("Average HRV Value During Sleep Session:", ["Resting Heart Rate of Each Day:"]);
  for (const match of hrvBlock.matchAll(/^(20\d{2})\/(\d{1,2})\/(\d{1,2})\s+HRV:\s*(-?\d+(?:\.\d+)?)\s*ms/gim)) {
    hrvSeries.push({ date: `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`, value: Number(match[4]) });
  }
  const latestHrv = atOffset(hrvSeries, 0);
  const hrv7 = recentValues(hrvSeries, 7).map(item => item.value);
  const hrv28 = hrvSeries.filter(item => {
    const age = (dayStamp(latestDate) - dayStamp(item.date)) / 86_400_000;
    return age >= 1 && age <= 28;
  }).map(item => item.value);
  save("hrv", "HRV 今日", latestHrv === null ? null : rounded(latestHrv));
  save("hrv3d", "HRV 3日前", atOffset(hrvSeries, 3) === null ? null : rounded(atOffset(hrvSeries, 3)!));
  if (hrv28.length >= 7) save("hrvBaseline", hrv28.length < 14 ? "HRV 短期Baseline" : "HRV 28日基线", rounded(median(hrv28)!));
  save("hrv7avg", "HRV 7日平均", mean(hrv7) === null ? null : rounded(mean(hrv7)!));
  save("hrv7sd", "HRV 标准差", populationSd(hrv7) === null ? null : rounded(populationSd(hrv7)!));

  const rhrSeries: DatedValue[] = [];
  const rhrBlock = section("Resting Heart Rate of Each Day:", []);
  for (const match of rhrBlock.matchAll(/^(20\d{2})\/(\d{1,2})\/(\d{1,2}):\s*(-?\d+(?:\.\d+)?)\s*bpm/gim)) {
    rhrSeries.push({ date: `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`, value: Number(match[4]) });
  }
  const latestRhr = atOffset(rhrSeries, 0);
  const rhr7 = rhrSeries.filter(item => {
    const age = (dayStamp(latestDate) - dayStamp(item.date)) / 86_400_000;
    return age >= 1 && age <= 7;
  }).map(item => item.value);
  save("rhr", "RHR 今日", latestRhr === null ? null : rounded(latestRhr));
  if (rhr7.length >= 5) save("rhrBaseline", "RHR 7日参考", rounded(mean(rhr7)!));

  const sleepBlock = section("Sleep Session Detail:", ["Average HRV Value During Sleep Session:"]);
  const sleepPattern = /(20\d{2})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(20\d{2})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*\nTotal:\s*([^\n]+)\nCore:\s*([^\n]+)\nDeep:\s*([^\n]+)\nREM:\s*([^\n]+)\nWakeUp:\s*([^\n]+)/g;
  const sleepSessions = [...sleepBlock.matchAll(sleepPattern)].map(match => {
    const endDate = `${match[7]}-${match[8].padStart(2, "0")}-${match[9].padStart(2, "0")}`;
    const endTime = `${match[10].padStart(2, "0")}:${match[11].padStart(2, "0")}`;
    return {
      endDate,
      endTime,
      timestamp: Date.UTC(Number(match[7]), Number(match[8]) - 1, Number(match[9]), Number(match[10]), Number(match[11]), Number(match[12] ?? 0)),
      timeInBed: parseDuration(match[13]),
      sleep: [match[14], match[15], match[16]].map(parseDuration).reduce<number>((sum, item) => sum + (item ?? 0), 0),
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
  const latestSleep = sleepSessions.filter(session => session.endDate === latestDate).sort((a, b) => b.sleep - a.sleep)[0];
  const evaluationTimestamp = latestSleep?.timestamp ?? dayStamp(latestDate) + 9 * 3_600_000;
  const evaluationAt = latestSleep ? `${latestSleep.endDate} ${latestSleep.endTime}` : `${latestDate} 09:00`;
  save("evaluationAt", "训练前评估时点", evaluationAt);
  if (latestSleep) {
    save("sleep", "实际睡眠", rounded(latestSleep.sleep));
    save("timeInBed", "卧床时间", latestSleep.timeInBed === null ? null : rounded(latestSleep.timeInBed));
  }
  const recentSleep = sleepSessions.filter(session => {
    const age = (dayStamp(latestDate) - dayStamp(session.endDate)) / 86_400_000;
    return age >= 0 && age < 3;
  }).map(session => session.sleep);
  if (recentSleep.length) save("sleep3avg", "近3日平均睡眠", rounded(mean(recentSleep)!));

  const workoutBlock = section("Workout list, each line is an entry of workout", ["ATL(Fatigue)"]);
  type ParsedWorkout = { date: string; time: string; timestamp: number; type: string; duration: number; rpe: number; highZonePct: number; detail: string };
  const workouts: ParsedWorkout[] = [];
  const workoutEntries = workoutBlock.match(/^Type:[\s\S]*?(?=^Type:|(?![\s\S]))/gim) ?? [];
  for (const entry of workoutEntries) {
    const match = /^Type:\s*([^,\n]+),\s*Date:\s*(\d{2}-\d{2})\s+(\d{2}):(\d{2}),\s*Duration:\s*(\d+(?:\.\d+)?)\s*mins,[^\n]*?RPE:\s*(\d+(?:\.\d+)?)/im.exec(entry);
    if (!match) continue;
    const date = expandMonthDay(match[2]);
    const time = `${match[3]}:${match[4]}`;
    const [year, month, day] = date.split("-").map(Number);
    const detail = /Workout Tag:\s*([\s\S]*)/i.exec(entry)?.[1].trim() ?? "";
    const zone4 = Number(/Zone 4:\s*(\d+(?:\.\d+)?)%/i.exec(entry)?.[1] ?? 0);
    const zone5 = Number(/Zone 5:\s*(\d+(?:\.\d+)?)%/i.exec(entry)?.[1] ?? 0);
    workouts.push({ type: match[1].trim(), date, time, timestamp: Date.UTC(year, month - 1, day, Number(match[3]), Number(match[4])), duration: Number(match[5]), rpe: Number(match[6]), highZonePct: zone4 + zone5, detail });
  }
  const eligibleWorkouts = workouts.filter(workout => workout.timestamp <= evaluationTimestamp);
  const hardCycling36 = eligibleWorkouts.filter(workout => /骑行/.test(workout.type) && evaluationTimestamp - workout.timestamp >= 0 && evaluationTimestamp - workout.timestamp <= 36 * 3_600_000 && (workout.rpe >= 7 || workout.highZonePct >= 10));
  save("hardCycling36", "36小时高强度骑行", rounded(hardCycling36.length, 0));
  const recentWorkouts = eligibleWorkouts.filter(workout => {
    const age = (dayStamp(latestDate) - dayStamp(workout.date)) / 86_400_000;
    return age >= 1 && age <= 7;
  });
  if (recentWorkouts.length) {
    const totalMinutes = recentWorkouts.reduce((sum, workout) => sum + workout.duration, 0);
    const totalLoad = recentWorkouts.reduce((sum, workout) => sum + workout.duration * workout.rpe, 0);
    save("workoutCount", "7日训练次数", rounded(recentWorkouts.length, 0));
    save("workoutMinutes", "7日训练时长", rounded(totalMinutes, 0));
    save("workoutLoad", "7日训练负荷", rounded(totalLoad));
    save("strengthFrequency", "Strength Frequency", rounded(recentWorkouts.filter(workout => workout.type.includes("力量")).length, 0));
    save("aerobicMinutes7", "7日有氧与专项时长", rounded(recentWorkouts.filter(workout => /骑行|游泳|划船|爬楼梯|椭圆机|步行|拳击|高强度间歇/.test(workout.type)).reduce((sum, workout) => sum + workout.duration, 0), 0));
    save("density", "Density", rounded(recentWorkouts.length / 7));
    const dailyLoads = Array.from({ length: 7 }, (_, index) => recentWorkouts
      .filter(workout => dayStamp(workout.date) === dayStamp(latestDate) - (index + 1) * 86_400_000)
      .reduce((sum, workout) => sum + workout.duration * workout.rpe, 0));
    const averageLoad = mean(dailyLoads);
    const loadSd = populationSd(dailyLoads);
    if (averageLoad !== null && loadSd !== null && loadSd > 0) {
      const monotony = averageLoad / loadSd;
      save("monotony", "Monotony", rounded(monotony));
      save("strain", "Strain", rounded(dailyLoads.reduce((sum, load) => sum + load, 0) * monotony));
    }
  }
  const pushPattern = /卧推|推胸|推举|肩推|臂屈伸|下压|侧平举|上斜.*推|胸飞鸟/i;
  const pullPattern = /划船|下拉|引体|弯举|面拉|肩外旋|反向飞鸟|俯身飞鸟|农夫行走/i;
  const legsPattern = /深蹲|腿弯举|腿屈伸|臀冲|硬拉|保加利亚|箭步蹲|台阶上步|髋外展|髋内收|提踵|静蹲|螃蟹行走|西班牙蹲/i;
  const corePattern = /pallof|抬腿|仰卧起坐|死虫|平板|侧卷腹|卷腹/i;
  const groupFor = (text: string): StrengthGroup | null => legsPattern.test(text) ? "legs" : pushPattern.test(text) ? "push" : pullPattern.test(text) ? "pull" : corePattern.test(text) ? "core" : null;
  const explicitSets = (line: string) => {
    const direct = [...line.matchAll(/(?:×|x)\s*(\d+)\s*组|(?:^|\D)(\d+)\s*组/gi)].map(match => Number(match[1] ?? match[2]));
    if (direct.length) return Math.max(...direct);
    const conventional = /(?:kg|lbs|自重)\s*(\d+)\s*(?:×|x)\s*(\d+)/i.exec(line);
    if (conventional) return Number(conventional[1]);
    const multipliers = line.match(/(?:×|x)/g)?.length ?? 0;
    const trailing = multipliers >= 2 ? /(?:×|x)\s*(\d+)\s*(?:\/侧)?\s*$/.exec(line) : null;
    return trailing ? Number(trailing[1]) : null;
  };
  const countSets = (detail: string, target: StrengthGroup) => {
    let total = 0;
    let currentGroup: StrengthGroup | null = null;
    for (const rawLine of detail.split("\n")) {
      const line = rawLine.replace(/\*\*/g, "").replace(/^\s*(?:\*|•|-|\d+[.)、])\s*/, "").trim();
      if (!line) continue;
      currentGroup = groupFor(line) ?? currentGroup;
      if (/热身/.test(line) && !/正式/.test(line)) continue;
      const sets = explicitSets(line);
      if (currentGroup === target && sets !== null) total += sets;
    }
    return total;
  };
  const strengthHistory: StrengthHistoryItem[] = [];
  const unparsedStrengthLines: string[] = [];
  for (const workout of eligibleWorkouts.filter(item => item.type.includes("力量"))) {
    let currentName = "";
    let currentGroup: StrengthGroup | null = null;
    const sessionItems = new Map<string, StrengthHistoryItem>();
    const candidateNames = new Set<string>();
    for (const rawLine of workout.detail.split("\n")) {
      const line = rawLine.replace(/\*\*/g, "").replace(/^\s*(?:\*|•|-|\d+[.)、])\s*/, "").trim();
      if (!line) continue;
      if (pushPattern.test(line) && pullPattern.test(line)) {
        unparsedStrengthLines.push(`${workout.date} 复合动作行：${line.slice(0, 42)}`);
        continue;
      }
      const detectedGroup = groupFor(line);
      const nameSource = line.replace(/^动作\s*\d+\s*[：:]\s*/, "");
      const inlineName = nameSource.split(/[：:]/)[0].replace(/【|】/g, "").split(/(?=\d+(?:\.\d+)?\s*(?:kg|lbs))/i)[0].trim();
      if (detectedGroup && inlineName.length >= 2 && inlineName.length <= 32 && !/^(?:热身|正式组|训练备注|动作难度)/.test(inlineName)) {
        currentName = inlineName;
        currentGroup = detectedGroup;
        candidateNames.add(currentName);
      }
      const unitMatch = [...line.matchAll(/(\d+(?:\.\d+)?)\s*(kg|lbs)/gi)].at(-1);
      const bodyweight = /自重/.test(line);
      const conventional = /(?:kg|lbs|自重)\s*(\d+)\s*(?:×|x)\s*(\d+)/i.exec(line);
      const sets = explicitSets(line) ?? (conventional ? Number(conventional[1]) : null);
      const repsAfterLoad = /(?:kg|lbs|自重)\s*(?:×|x)\s*(\d+)/i.exec(line)?.[1];
      const repsText = /(\d+)\s*次/.exec(line)?.[1];
      const reps = repsAfterLoad ? Number(repsAfterLoad) : conventional ? Number(conventional[2]) : repsText ? Number(repsText) : null;
      if (!currentGroup || !currentName || (!unitMatch && !bodyweight && sets === null && reps === null)) continue;
      const key = `${workout.timestamp}-${currentName}`;
      const previous = sessionItems.get(key);
      sessionItems.set(key, {
        name: currentName,
        canonicalName: canonicalExerciseName(currentName),
        weight: unitMatch ? Number(unitMatch[1]) : bodyweight ? null : previous?.weight ?? null,
        unit: bodyweight ? "自重" : unitMatch?.[2].toLowerCase() === "lbs" ? "lbs" : previous?.unit ?? "kg",
        reps: reps ?? previous?.reps ?? null,
        sets: sets ?? previous?.sets ?? 3,
        group: currentGroup,
        date: workout.date,
        time: workout.time,
        timestamp: workout.timestamp,
        sessionRpe: workout.rpe,
      });
    }
    strengthHistory.push(...sessionItems.values());
    for (const name of candidateNames) if (![...sessionItems.values()].some(item => item.name === name)) unparsedStrengthLines.push(`${workout.date} ${name}`);
  }
  strengthHistory.sort((a, b) => b.timestamp - a.timestamp);
  const strength48 = eligibleWorkouts.filter(workout => workout.type.includes("力量") && evaluationTimestamp - workout.timestamp >= 0 && evaluationTimestamp - workout.timestamp <= 48 * 3_600_000);
  const pushSets48 = strength48.reduce((sum, workout) => sum + countSets(workout.detail, "push"), 0);
  const pullSets48 = strength48.reduce((sum, workout) => sum + countSets(workout.detail, "pull"), 0);
  const legsSets48 = strength48.reduce((sum, workout) => sum + countSets(workout.detail, "legs"), 0);
  const pushSets7 = recentWorkouts.reduce((sum, workout) => sum + countSets(workout.detail, "push"), 0);
  const pullSets7 = recentWorkouts.reduce((sum, workout) => sum + countSets(workout.detail, "pull"), 0);
  const legsSets7 = recentWorkouts.reduce((sum, workout) => sum + countSets(workout.detail, "legs"), 0);
  const upperSets48 = pushSets48 + pullSets48;
  const lowerSets48 = legsSets48;
  save("upperSets48", "48小时上肢正式组", rounded(upperSets48, 0));
  save("lowerSets48", "48小时下肢正式组", rounded(lowerSets48, 0));
  save("pushSets48", "48小时推训练正式组", rounded(pushSets48, 0));
  save("pullSets48", "48小时拉训练正式组", rounded(pullSets48, 0));
  save("legsSets48", "48小时腿训练正式组", rounded(legsSets48, 0));
  save("pushSets7", "7日推训练正式组", rounded(pushSets7, 0));
  save("pullSets7", "7日拉训练正式组", rounded(pullSets7, 0));
  save("legsSets7", "7日腿训练正式组", rounded(legsSets7, 0));
  if (strengthHistory.length) save("strengthHistory", "力量动作与重量", JSON.stringify(strengthHistory.slice(0, 120)));
  const hardStrength = strength48.some(workout => workout.rpe >= 7);
  const groupSetPairs: Array<["push" | "pull" | "legs", number]> = [["push", pushSets48], ["pull", pullSets48], ["legs", legsSets48]];
  const fatiguedGroups = groupSetPairs.filter(([, sets]) => sets >= 8).map(([group]) => group);
  const hardGroups = groupSetPairs.filter(([group]) => hardStrength && strength48.some(workout => workout.rpe >= 7 && countSets(workout.detail, group) > 0)).map(([group]) => group);
  const fatigueGroups = new Set([...fatiguedGroups, ...hardGroups]);
  save("fatiguePush", "48小时推疲劳", fatigueGroups.has("push") ? "yes" : "no");
  save("fatiguePull", "48小时拉疲劳", fatigueGroups.has("pull") ? "yes" : "no");
  save("fatigueLegs", "48小时腿疲劳", fatigueGroups.has("legs") ? "yes" : "no");
  let fatigueRegion: FormState["strengthFatigue"] = "none";
  if (fatiguedGroups.length === 3) fatigueRegion = "full";
  else if (fatiguedGroups.includes("push") && fatiguedGroups.includes("pull")) fatigueRegion = "upper";
  else if (fatiguedGroups.length >= 2) fatigueRegion = "full";
  else if (fatiguedGroups[0]) fatigueRegion = fatiguedGroups[0];
  if (hardStrength && fatigueRegion === "none") fatigueRegion = [...groupSetPairs].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "full";
  save("strengthFatigue", "48小时力量疲劳", fatigueRegion);

  return { values, fields, audit: { evaluationAt, workouts: workouts.length, strengthSessions: eligibleWorkouts.filter(item => item.type.includes("力量")).length, excludedAfterEvaluation: workouts.filter(item => item.timestamp > evaluationTimestamp).length, exercises: strengthHistory.slice(0, 24), unparsed: [...new Set(unparsedStrengthLines)].slice(0, 8) } };
}

export function parsePastedData(source: string): ParsedData {
  const fullExport = parseFullExport(source);
  if (fullExport) return fullExport;
  const text = source
    .replace(/\r/g, "")
    .replace(/[＝]/g, "=")
    .replace(/[：]/g, ":")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .split("\n")
    .map((line) => line
      .replace(/\*\*|__/g, "")
      .replace(/^\s*(?:[|>#*+•·-]|\d+[.)、])\s*/, "")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean)
    .join("\n");
  const values: Partial<FormState> = {};
  const fields: string[] = [];
  const save = <K extends keyof FormState>(key: K, label: string, value: FormState[K] | null) => {
    if (value === null || value === undefined || value === "") return;
    values[key] = value;
    if (!fields.includes(label)) fields.push(label);
  };
  const number = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  };
  const lineValue = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  };

  save("date", "日期", lineValue([
    /^(?:Generated At|起床日|数据日期|日期|Date)\s*[:=]\s*(20\d{2}[-/]\d{1,2}[-/]\d{1,2})/im,
  ])?.replaceAll("/", "-") ?? null);
  save("hrvBaseline", "HRV 28日基线", number([
    /^HRV[^\n]*(?:28\s*日|28[- ]?day)[^\n]*(?:中位|baseline|基线)[^\d-]*(-?\d+(?:\.\d+)?)/im,
    /^HRV\s*(?:28日中位基线|28日基线|Baseline|基线)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
    /^Baseline(?:\s*\([^)]*(?:中位|median)[^)]*\))?\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*ms/im,
  ]));
  save("hrv3d", "HRV 3日前", number([
    /^HRV\s*(?:3日前|三日前|3\s*days?\s*ago)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("hrv7avg", "HRV 7日平均", number([
    /^HRV[^\n]*(?:7\s*日|7[- ]?day)[^\n]*(?:平均|avg|average)[^\d-]*(-?\d+(?:\.\d+)?)/im,
    /^HRV\s*(?:7日平均|7D Avg)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
    /^7日平均\s*(?:\/\s*STDEV\.P)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("hrv7sd", "HRV 标准差", number([
    /^HRV[^\n]*(?:STDEV\.P|SD|标准差)[^\d-]*(-?\d+(?:\.\d+)?)/im,
    /^(?:STDEV\.P|HRV SD|HRV 标准差)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
    /^7日平均\s*\/\s*STDEV\.P\s*[:=]?\s*-?\d+(?:\.\d+)?\s*\/\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("hrv", "HRV 今日", number([
    /^(?:今日\s*)?HRV(?:\s*(?:今日|Today|Current|值))?\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*ms/im,
    /^(?:今日|Today)\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*ms/im,
  ]));

  const sleepRaw = lineValue([
    /^(?:实际睡眠|睡眠时长|Sleep Duration|Total Sleep|Sleep)\s*[:=]?\s*([^\n]+)/im,
  ]);
  const bedRaw = lineValue([
    /^(?:卧床时间|在床时间|Time in Bed|Bed Time)\s*[:=]?\s*([^\n]+)/im,
  ]);
  const sleepHours = sleepRaw ? parseDuration(sleepRaw) : null;
  const bedHours = bedRaw ? parseDuration(bedRaw) : null;
  save("sleep", "实际睡眠", sleepHours === null ? null : String(Number(sleepHours.toFixed(2))));
  save("timeInBed", "卧床时间", bedHours === null ? null : String(Number(bedHours.toFixed(2))));

  save("rhrBaseline", "RHR 7日参考", number([
    /^RHR[^\n]*(?:7\s*日|7[- ]?day)[^\n]*(?:参考|平均|reference|avg)[^\d-]*(-?\d+(?:\.\d+)?)/im,
    /^(?:RHR Reference|RHR 7日参考|RHR 基线)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
    /^Reference\s*(?:\([^)]*(?:7日|7[- ]?day)[^)]*\))?\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*bpm/im,
  ]));
  save("rhr", "RHR 今日", number([
    /^(?:今日\s*)?RHR(?:\s*(?:今日|Today|Current|值))?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
    /^(?:静息心率|今日静息心率)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("atlYesterday", "ATL 昨日", number([
    /^ATL\s*(?:昨日|昨天|Yesterday)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("atl3d", "ATL 3日前", number([
    /^ATL\s*(?:3日前|三日前|3\s*days?\s*ago)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("atl", "ATL 今日", number([
    /^(?:今日\s*)?ATL(?:\s*(?:今日|Today|Current|值))?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("ctl", "CTL 今日", number([
    /^(?:今日\s*)?CTL(?:\s*(?:今日|Today|Current|值))?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("monotony", "Monotony", number([
    /^Monotony(?:\s*\([^\n]*\)|\s*近7日)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("strain", "Strain", number([
    /^Strain(?:\s*\([^\n]*\)|\s*近7日)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("density", "Density", number([
    /^Density(?:\s*\([^\n]*\)|\s*近7日)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/im,
  ]));
  save("pain", "疼痛评分", number([
    /^(?:疼痛评分|Pain Score|Pain)\s*[:=]?\s*(\d+(?:\.\d+)?)/im,
  ]));
  save("energy", "精力", number([/^(?:今日)?精力\s*[:=]?\s*(\d+(?:\.\d+)?)/im, /^Energy\s*[:=]?\s*(\d+(?:\.\d+)?)/im]));
  save("fatigue", "总体疲劳", number([/^(?:今日)?(?:总体)?疲劳\s*[:=]?\s*(\d+(?:\.\d+)?)/im, /^Fatigue\s*[:=]?\s*(\d+(?:\.\d+)?)/im]));
  save("motivation", "训练意愿", number([/^(?:训练意愿|Motivation)\s*[:=]?\s*(\d+(?:\.\d+)?)/im]));
  save("stress", "压力", number([/^(?:压力|Stress)\s*[:=]?\s*(\d+(?:\.\d+)?)/im]));
  save("upperSoreness", "上肢酸痛", number([/^(?:上肢酸痛|Upper Soreness)\s*[:=]?\s*(\d+(?:\.\d+)?)/im]));
  save("lowerSoreness", "下肢酸痛", number([/^(?:下肢酸痛|Lower Soreness)\s*[:=]?\s*(\d+(?:\.\d+)?)/im]));
  save("sleepQuality", "主观睡眠质量", number([/^(?:主观)?睡眠质量\s*[:=]?\s*(\d+(?:\.\d+)?)/im, /^Sleep Quality\s*[:=]?\s*(\d+(?:\.\d+)?)/im]));
  save("sleep3avg", "近3日平均睡眠", number([/^(?:近3日平均睡眠|3[- ]?day Sleep Avg)\s*[:=]?\s*(\d+(?:\.\d+)?)/im]));
  const painArea = lineValue([/^(?:疼痛部位|局部不适|Pain Area)\s*[:=]?\s*([^\n]+)/im]);
  if (painArea && !/^(?:无|none|no)$/i.test(painArea)) save("painArea", "疼痛部位", painArea);

  const fatigueLine = lineValue([/^Strength Fatigue(?:[ \t]*\([^)]*(?:48\s*小时|48h)[^)]*\)|[ \t]*48h)?[ \t]*(?:[:=][ \t]*)?((?:Full Body|Upper|Lower|Push|Pull|Legs|None|全身|上肢|下肢|推|拉|腿|无)[^\n]*)/im]);
  if (fatigueLine) {
    if (/full|全身/i.test(fatigueLine)) {
      save("strengthFatigue", "48小时力量疲劳", "full"); save("fatiguePush", "48小时推疲劳", "yes"); save("fatiguePull", "48小时拉疲劳", "yes"); save("fatigueLegs", "48小时腿疲劳", "yes");
    } else if (/upper|上肢/i.test(fatigueLine)) {
      save("strengthFatigue", "48小时力量疲劳", "upper"); save("fatiguePush", "48小时推疲劳", "yes"); save("fatiguePull", "48小时拉疲劳", "yes"); save("fatigueLegs", "48小时腿疲劳", "no");
    } else if (/lower|下肢|legs|腿/i.test(fatigueLine)) {
      save("strengthFatigue", "48小时力量疲劳", "lower"); save("fatiguePush", "48小时推疲劳", "no"); save("fatiguePull", "48小时拉疲劳", "no"); save("fatigueLegs", "48小时腿疲劳", "yes");
    } else if (/push|推/i.test(fatigueLine)) {
      save("strengthFatigue", "48小时力量疲劳", "push"); save("fatiguePush", "48小时推疲劳", "yes"); save("fatiguePull", "48小时拉疲劳", "no"); save("fatigueLegs", "48小时腿疲劳", "no");
    } else if (/pull|拉/i.test(fatigueLine)) {
      save("strengthFatigue", "48小时力量疲劳", "pull"); save("fatiguePush", "48小时推疲劳", "no"); save("fatiguePull", "48小时拉疲劳", "yes"); save("fatigueLegs", "48小时腿疲劳", "no");
    } else if (/none|no|无/i.test(fatigueLine)) {
      save("strengthFatigue", "48小时力量疲劳", "none"); save("fatiguePush", "48小时推疲劳", "no"); save("fatiguePull", "48小时拉疲劳", "no"); save("fatigueLegs", "48小时腿疲劳", "no");
    }
  }
  const upperFatigue = /^Upper\s*[:=]?\s*(Yes|No|是|否)/im.exec(text)?.[1];
  const lowerFatigue = /^Lower\s*[:=]?\s*(Yes|No|是|否)/im.exec(text)?.[1];
  const fullFatigue = /^Full Body\s*[:=]?\s*(Yes|No|是|否)/im.exec(text)?.[1];
  if (upperFatigue || lowerFatigue || fullFatigue) {
    const yes = (value?: string) => /yes|是/i.test(value ?? "");
    const upperYes = yes(upperFatigue), lowerYes = yes(lowerFatigue), fullYes = yes(fullFatigue);
    save("fatiguePush", "48小时推疲劳", fullYes || upperYes ? "yes" : "no");
    save("fatiguePull", "48小时拉疲劳", fullYes || upperYes ? "yes" : "no");
    save("fatigueLegs", "48小时腿疲劳", fullYes || lowerYes ? "yes" : "no");
    if (fullYes || (upperYes && lowerYes)) save("strengthFatigue", "48小时力量疲劳", "full");
    else if (upperYes) save("strengthFatigue", "48小时力量疲劳", "upper");
    else if (lowerYes) save("strengthFatigue", "48小时力量疲劳", "lower");
    else save("strengthFatigue", "48小时力量疲劳", "none");
  }
  const neuralLine = lineValue([/^(?:Neural Readiness|Neural Ready|Neural|CNS Fatigue)\s*[:=]?\s*([^\n]+)/im]);
  if (neuralLine) {
    if (/fatigue|yes|high|是|疲劳/i.test(neuralLine)) save("neural", "Neural / CNS", "fatigue");
    else if (/limited|受限/i.test(neuralLine)) save("neural", "Neural / CNS", "limited");
    else if (/normal|ready|no|正常|否/i.test(neuralLine)) save("neural", "Neural / CNS", "normal");
  }
  const symptomLine = lineValue([/^(?:疾病症状|急性症状|Illness|Symptoms?)\s*[:=]\s*([^\n]+)/im]);
  if (symptomLine) {
    if (/acute|明显|急性|发热|fever/i.test(symptomLine)) save("symptoms", "疾病症状", "acute");
    else if (/mild|轻微|轻度/i.test(symptomLine)) save("symptoms", "疾病症状", "mild");
    else if (/none|no|无/i.test(symptomLine)) save("symptoms", "疾病症状", "none");
  }
  const naturalPainMatches = [...text.matchAll(/^([^\n]{0,28}?(?:肩|膝|踝|髋|腰|腿|腹股沟)[^\n]{0,30}?)\s*\([^)]*(?:疼痛|程度)?\s*(\d+(?:\.\d+)?)\s*\/\s*10[^)]*\)/gim)];
  if (naturalPainMatches.length) {
    const highestPain = Math.max(...naturalPainMatches.map((match) => Number(match[2])));
    const areas = naturalPainMatches.map((match) => {
      const area = match[1].match(/(?:左|右)?(?:肩膀?|膝|踝|髋|腰部?|大腿|小腿|腹股沟)/)?.[0];
      return area ?? "";
    }).filter(Boolean);
    if (!values.pain) save("pain", "疼痛评分", String(highestPain));
    if (!values.painArea && areas.length) save("painArea", "疼痛部位", [...new Set(areas)].join("、"));
  }

  if (!values.hrv && values.hrvBaseline) {
    const ratio = number([/^HRV Ratio\s*[:=]?\s*(\d+(?:\.\d+)?)/im]);
    if (ratio) {
      const derived = Number(values.hrvBaseline) * Number(ratio);
      save("hrv", "HRV 今日(由Ratio反推)", String(Number(derived.toFixed(2))));
    }
  }
  return { values, fields };
}

function Field({ label, value, onChange, unit, step = "0.01" }: {
  label: string; value: string; onChange: (value: string) => void; unit?: string; step?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input">
        <Input type="number" inputMode="decimal" step={step} value={value}
          onChange={(event) => onChange(event.target.value)} placeholder="—" aria-label={label} />
        {unit ? <small>{unit}</small> : null}
      </div>
    </label>
  );
}

function GaugeDial({ value, label, eyebrow, status, confidence, compact = false, featured = false }: {
  value: number | null; label: string; eyebrow: string; status: string; confidence: string; compact?: boolean; featured?: boolean;
}) {
  const tickValues = Array.from({ length: 17 }, (_, index) => index * 6.25);
  const progress = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={`gauge-dial ${compact ? "compact" : ""} ${featured ? "featured" : ""} ${gaugeToneForScore(value)}`}>
      <div className="gauge-visual">
        <svg viewBox="0 0 320 190" role="img" aria-label={`${label} ${value === null ? "Unknown" : Math.round(value)}`}>
          <path className="gauge-track" pathLength="100" d="M30 160 A130 130 0 0 1 290 160" />
          <path className="gauge-color" pathLength="100" d="M30 160 A130 130 0 0 1 290 160" style={{ strokeDasharray: `${progress} 100` }} />
          <g className="gauge-ticks" aria-hidden="true">
            {tickValues.map((tick) => {
              const radians = (180 - tick * 1.8) * Math.PI / 180;
              const isMajor = tick % 25 === 0;
              const innerRadius = isMajor ? 99 : 108;
              const outerRadius = 115;
              return <line key={tick}
                className={isMajor ? "major" : "minor"}
                x1={160 + innerRadius * Math.cos(radians)} y1={160 - innerRadius * Math.sin(radians)}
                x2={160 + outerRadius * Math.cos(radians)} y2={160 - outerRadius * Math.sin(radians)} />;
            })}
            <text x="18" y="181">0</text><text x="62" y="67">25</text><text x="160" y="22">50</text><text x="258" y="67">75</text><text x="302" y="181">100</text>
          </g>
        </svg>
        <strong className="gauge-value">{value === null ? "—" : Math.round(value)}</strong>
      </div>
      <div className="gauge-copy"><span>{label}</span><small>{eyebrow}</small><em>{status}</em><b>可信度：{confidence}</b></div>
    </div>
  );
}

function DashboardPanel({ icon, title, children, wide = false }: { icon: React.ReactNode; title: string; children: React.ReactNode; wide?: boolean }) {
  return <section className={`dash-panel ${wide ? "wide" : ""}`}><header>{icon}<h2>{title}</h2></header><div>{children}</div></section>;
}

function DashboardRow({ label, value, score, note }: { label: string; value: string; score: number | null; note?: string }) {
  return <div className="dash-row"><div><span>{label}</span>{note ? <small>{note}</small> : null}</div><strong>{value}</strong><i className={toneForScore(score)} aria-label={metricStatus(score)} /></div>;
}

function SegmentMeter({ value }: { value: number | null }) {
  return <div className="segment-meter" aria-label={value === null ? "Unknown" : `${Math.round(value)} / 100`}><span/><span/><span/><span/><span/><b style={{ left: `${Math.max(2, Math.min(98, value ?? 2))}%` }} /></div>;
}

export default function Home() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [hydrated, setHydrated] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pasteStatus, setPasteStatus] = useState<{ kind: "success" | "error" | "info"; message: string } | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [lastImportFields, setLastImportFields] = useState<string[]>([]);
  const [importAudit, setImportAudit] = useState<ImportAudit | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const pasteChangeTimer = useRef<number | null>(null);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("heracles-daily-v1");
        if (saved) {
          const restored = JSON.parse(saved) as Partial<FormState>;
          if (restored.preference === "upper" || restored.preference === "lower") restored.preference = "auto";
          if (restored.strengthFatigue === "lower") restored.strengthFatigue = "legs";
          if (!restored.fatiguePush || !restored.fatiguePull || !restored.fatigueLegs) {
            const legacy = restored.strengthFatigue ?? "unknown";
            restored.fatiguePush = legacy === "unknown" ? "unknown" : ["push", "upper", "full"].includes(legacy) ? "yes" : "no";
            restored.fatiguePull = legacy === "unknown" ? "unknown" : ["pull", "upper", "full"].includes(legacy) ? "yes" : "no";
            restored.fatigueLegs = legacy === "unknown" ? "unknown" : ["legs", "lower", "full"].includes(legacy) ? "yes" : "no";
          }
          setForm({ ...emptyForm, ...restored, date: today() });
        } else {
          setForm(current => ({ ...current, date: today() }));
        }
        window.localStorage.removeItem("heracles-daily-history-v1");
      } catch { /* ignore malformed local draft */ }
      setHydrated(true);
    }, 0);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    return () => window.clearTimeout(hydrationTimer);
  }, []);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem("heracles-daily-v1", JSON.stringify(form));
  }, [form, hydrated]);

  const result = useMemo(() => {
    const hrv = numberOrNull(form.hrv), hrvBaseline = numberOrNull(form.hrvBaseline);
    const hrv3d = numberOrNull(form.hrv3d), hrv7avg = numberOrNull(form.hrv7avg), hrv7sd = numberOrNull(form.hrv7sd);
    const sleep = numberOrNull(form.sleep), timeInBed = numberOrNull(form.timeInBed);
    const rhr = numberOrNull(form.rhr), rhrBaseline = numberOrNull(form.rhrBaseline);
    const atl = numberOrNull(form.atl), ctl = numberOrNull(form.ctl);
    const atlYesterday = numberOrNull(form.atlYesterday), atl3d = numberOrNull(form.atl3d);
    const monotony = numberOrNull(form.monotony), density = numberOrNull(form.density);
    const pushSets48 = numberOrNull(form.pushSets48) ?? 0, pullSets48 = numberOrNull(form.pullSets48) ?? 0, legsSets48 = numberOrNull(form.legsSets48) ?? numberOrNull(form.lowerSets48) ?? 0;
    const pushSets7 = numberOrNull(form.pushSets7) ?? 0, pullSets7 = numberOrNull(form.pullSets7) ?? 0, legsSets7 = numberOrNull(form.legsSets7) ?? 0;
    const aerobicMinutes7 = numberOrNull(form.aerobicMinutes7) ?? 0;
    const hardCycling36 = (numberOrNull(form.hardCycling36) ?? 0) > 0;
    let strengthHistory: StrengthHistoryItem[] = [];
    try {
      const savedHistory = form.strengthHistory ? JSON.parse(form.strengthHistory) as Array<StrengthHistoryItem & { region?: "upper" | "lower" }> : [];
      strengthHistory = savedHistory.map(item => ({ ...item, canonicalName: item.canonicalName ?? canonicalExerciseName(item.name), group: item.group ?? (item.region === "lower" ? "legs" : /卧推|推胸|推举|下压|臂屈伸/.test(item.name) ? "push" : "pull"), time: item.time ?? "00:00", timestamp: item.timestamp ?? Date.parse(`${item.date}T00:00:00Z`), sessionRpe: item.sessionRpe ?? 6, isWarmup: item.isWarmup ?? false }));
    } catch { strengthHistory = []; }
    const pain = numberOrNull(form.pain);
    const energy = numberOrNull(form.energy), fatigue = numberOrNull(form.fatigue), motivation = numberOrNull(form.motivation), stress = numberOrNull(form.stress);
    const upperSoreness = numberOrNull(form.upperSoreness), lowerSoreness = numberOrNull(form.lowerSoreness), sleepQuality = numberOrNull(form.sleepQuality);
    const sleep3avg = numberOrNull(form.sleep3avg), warmupRpeDelta = numberOrNull(form.warmupRpeDelta), warmupPain = numberOrNull(form.warmupPain), firstSetRir = numberOrNull(form.firstSetRir);

    const hrvRatio = hrv !== null && hrvBaseline ? hrv / hrvBaseline : null;
    const hrvZ = hrv !== null && hrv7avg !== null && hrv7sd ? (hrv - hrv7avg) / hrv7sd : null;
    const hrvTrend = hrv !== null && hrv3d !== null && hrvBaseline ? ((hrv - hrv3d) / hrvBaseline) * 100 : null;
    const hrvRatioScore = hrvRatio === null ? null : scoreHrvRatio(hrvRatio);
    const hrvTrendScore = hrvTrend === null ? null : scoreTrend(hrvTrend);
    const hrvScore = weighted([
      ...(hrvRatioScore === null ? [] : [{ value: hrvRatioScore, weight: .7 }]),
      ...(hrvTrendScore === null ? [] : [{ value: hrvTrendScore, weight: .3 }]),
    ]);
    const sleepEfficiency = sleep !== null && timeInBed ? Math.min(100, sleep / timeInBed * 100) : null;
    const sleepDurationScore = sleep === null ? null : scoreSleepHours(sleep);
    const sleepEfficiencyScore = sleepEfficiency === null ? null : scoreEfficiency(sleepEfficiency);
    const sleepScore = weighted([
      ...(sleepDurationScore === null ? [] : [{ value: sleepDurationScore, weight: .8 }]),
      ...(sleepEfficiencyScore === null ? [] : [{ value: sleepEfficiencyScore, weight: .2 }]),
    ]);
    const sleepDebt3d = sleep3avg === null ? null : Math.max(0, (8 - sleep3avg) * 3);
    const rhrDelta = rhr !== null && rhrBaseline !== null ? rhr - rhrBaseline : null;
    const rhrScore = rhrDelta === null ? null : scoreRhr(rhrDelta);
    const recoveryParts = [hrvScore, sleepScore, rhrScore].filter(value => value !== null).length;
    const recovery = recoveryParts < 2 ? null : weighted([
      ...(hrvScore === null ? [] : [{ value: hrvScore, weight: .4 }]),
      ...(sleepScore === null ? [] : [{ value: sleepScore, weight: .35 }]),
      ...(rhrScore === null ? [] : [{ value: rhrScore, weight: .25 }]),
    ]);

    const formValue = ctl !== null && atl !== null ? ctl - atl : null;
    const acwr = atl !== null && ctl ? atl / ctl : null;
    const atlSpike = atl !== null && atlYesterday ? (atl - atlYesterday) / atlYesterday * 100 : null;
    const fatigueMomentum = atl !== null && atl3d ? (atl - atl3d) / atl3d * 100 : null;
    const formScore = formValue === null ? null : scoreForm(formValue);
    const acwrScore = acwr === null ? null : scoreAcwr(acwr);
    const atlSpikeScore = atlSpike === null ? null : scoreSpike(atlSpike);
    // ACWR stays visible as context, but no longer contributes to the score.
    const load = weighted([
      ...(formScore === null ? [] : [{ value: formScore, weight: .7 }]),
      ...(atlSpikeScore === null ? [] : [{ value: atlSpikeScore, weight: .3 }]),
    ]);
    const monotonyScore = monotony === null ? null : monotony < 1.8 ? 85 : monotony < 2.3 ? 70 : 40;
    const densityScore = density === null ? null : density <= 1.0 ? 85 : density < 1.2 ? 70 : 40;
    const structure = weighted([
      ...(monotonyScore === null ? [] : [{ value: monotonyScore, weight: .6 }]),
      ...(densityScore === null ? [] : [{ value: densityScore, weight: .4 }]),
    ]);

    let readiness = recovery === null || (load === null && structure === null) ? null : weighted([
      ...(recovery === null ? [] : [{ value: recovery, weight: .5 }]),
      ...(load === null ? [] : [{ value: load, weight: .3 }]),
      ...(structure === null ? [] : [{ value: structure, weight: .2 }]),
    ]);
    const subjectiveScore = weighted([
      ...(energy === null ? [] : [{ value: Math.max(0, Math.min(100, energy * 20)), weight: 1 }]),
      ...(motivation === null ? [] : [{ value: Math.max(0, Math.min(100, motivation * 20)), weight: 1 }]),
      ...(fatigue === null ? [] : [{ value: Math.max(0, Math.min(100, (6 - fatigue) * 20)), weight: 1 }]),
      ...(stress === null ? [] : [{ value: Math.max(0, Math.min(100, (6 - stress) * 20)), weight: 1 }]),
      ...(sleepQuality === null ? [] : [{ value: Math.max(0, Math.min(100, sleepQuality * 20)), weight: 1 }]),
    ]);
    if (readiness !== null && subjectiveScore !== null) {
      // Subjective status moderates the decision without duplicating the physiological recovery block.
      readiness = Math.max(0, Math.min(100, readiness + Math.max(-10, Math.min(8, (subjectiveScore - 70) * .25))));
    }
    const limits: string[] = [];
    const neuralTriggers = [hrvRatio !== null && hrvRatio < .9, hrvZ !== null && hrvZ < -1, rhrDelta !== null && rhrDelta >= 3].filter(Boolean).length;
    const neuralKnownInputs = [hrvRatio !== null, hrvZ !== null, rhrDelta !== null].filter(Boolean).length;
    const neuralStatus: "ready" | "limited" | "unknown" = form.neural === "limited" || form.neural === "fatigue" || neuralTriggers > 0
      ? "limited"
      : form.neural === "normal" || (hrvRatio !== null && rhrDelta !== null && hrvRatio >= .9 && rhrDelta <= 2 && (hrvZ === null || hrvZ >= -1))
        ? "ready"
        : "unknown";
    const neuralLimited = neuralStatus === "limited";
    const neuralReady = neuralStatus === "ready";
    const neuralPressure = neuralTriggers >= 2 ? "High" : neuralTriggers === 1 ? "Moderate" : neuralKnownInputs >= 2 ? "Low" : "Unknown";
    const cnsFatigue = neuralTriggers >= 2 ? "Yes" : neuralKnownInputs === 3 ? "No" : "Unknown";
    if (readiness !== null && (form.symptoms === "acute" || (pain !== null && pain > 3))) {
      readiness = Math.min(readiness, 69.99); limits.push("疼痛＞3/10或明显症状：训练准备度最高 Level 2");
    }
    if (readiness !== null && neuralLimited) {
      readiness = Math.min(readiness, 79.99); limits.push("Neural Limited：最高 Level 3，禁止极限力量、冲刺、HIIT和高强度拳击");
    }
    const evaluationTimestamp = Date.parse(`${(form.evaluationAt || `${form.date} 09:00`).replace(" ", "T")}Z`);
    const recentStrengthExposure = (group: StrengthGroup, hours: number) => strengthHistory.some(item => !item.isWarmup && item.group === group && evaluationTimestamp - item.timestamp >= 0 && evaluationTimestamp - item.timestamp <= hours * 3_600_000);
    const pushCooldown = pushSets48 > 0 || recentStrengthExposure("push", 48);
    const pullCooldown = pullSets48 > 0 || recentStrengthExposure("pull", 48);
    const legsCooldown = legsSets48 > 0 || recentStrengthExposure("legs", 48);
    const legsStrength36 = recentStrengthExposure("legs", 36);
    const pushFatigued = pushSets48 >= 8 || form.fatiguePush === "yes";
    const pullFatigued = pullSets48 >= 8 || form.fatiguePull === "yes";
    const legsFatigued = legsSets48 >= 8 || form.fatigueLegs === "yes";
    const fatiguedLabels = [pushFatigued ? "推" : "", pullFatigued ? "拉" : "", legsFatigued ? "腿" : ""].filter(Boolean);
    if (fatiguedLabels.length) limits.push(`48小时局部力量疲劳：${fatiguedLabels.join("＋")}；保留其他无冲突部位`);
    const cooldownLabels = [pushCooldown ? "推" : "", pullCooldown ? "拉" : "", legsCooldown ? "腿" : ""].filter(Boolean);
    if (cooldownLabels.length) limits.push(`同部位力量刺激未满48小时：${cooldownLabels.join("＋")}；今天不重复安排同部位`);
    if (legsStrength36) limits.push("腿部力量训练后36小时：骑行仅限轻松Zone 1–2，不安排节奏、阈值或冲刺");
    if (hardCycling36) limits.push("高强度骑行后36小时：不安排腿力量或腿部高强度训练");
    const warmupComplete = warmupRpeDelta !== null || warmupPain !== null || form.warmupHr !== "unknown" || form.movementQuality !== "unknown" || form.warmupEnergy !== "unknown";
    const warmupStop = (warmupPain !== null && warmupPain > 3) || form.movementQuality === "reduced";
    const warmupDowngrade = (warmupRpeDelta !== null && warmupRpeDelta >= 2) || form.warmupHr === "high" || form.warmupEnergy === "worse";
    if (readiness !== null && warmupStop) {
      readiness = Math.min(readiness, 54.99); limits.push("热身反馈出现疼痛＞3/10或动作质量下降：终止相关训练");
    } else if (readiness !== null && warmupDowngrade) {
      readiness = Math.min(readiness, 69.99); limits.push("热身反馈异常：今日训练必须降档");
    }
    const readinessLevel = levelFor(readiness);
    const painActive = pain !== null && pain > 0;
    const pushPainConflict = painActive && /肩|肘|腕|胸|上肢/.test(form.painArea);
    const pullPainConflict = painActive && /肩|肘|腕|背|上肢/.test(form.painArea);
    const legsPainConflict = painActive && /膝|踝|髋|腿|下肢|腹股沟|腰/.test(form.painArea);
    const conflictPush = pushFatigued || pushCooldown;
    const conflictPull = pullFatigued || pullCooldown;
    const conflictLegs = legsFatigued || legsCooldown || hardCycling36;
    const groupInfo = {
      push: { label: "推", weekly: pushSets7, conflict: conflictPush, pain: pushPainConflict },
      pull: { label: "拉", weekly: pullSets7, conflict: conflictPull, pain: pullPainConflict },
      legs: { label: "腿", weekly: legsSets7, conflict: conflictLegs, pain: legsPainConflict },
    };
    const groupOrder = ["push", "pull", "legs"] as const;
    const latestGroupTime = (group: keyof typeof groupInfo) => strengthHistory.find(item => item.group === group)?.timestamp ?? 0;
    const chooseStrengthTarget = () => groupOrder
      .filter(group => !groupInfo[group].conflict && !groupInfo[group].pain)
      .sort((a, b) => groupInfo[a].weekly - groupInfo[b].weekly || latestGroupTime(a) - latestGroupTime(b))[0] ?? null;

    const strengthPrescription = (group: keyof typeof groupInfo): PrescribedExercise[] => {
      const blocked = (name: string) => pushPainConflict && /卧推|推胸|推举|侧平举|飞鸟|双杠|臂屈伸|下压/.test(name)
        || pullPainConflict && /划船|下拉|引体|弯举|飞鸟|面拉|农夫/.test(name)
        || legsPainConflict && /深蹲|硬拉|腿屈伸|保加利亚|箭步|台阶|静蹲|臀冲/.test(name)
        || /腰/.test(form.painArea) && /硬拉|深蹲|俯身/.test(name);
      const fallback = (name: string, reps: number): StrengthHistoryItem => ({ name, canonicalName: canonicalExerciseName(name), weight: null, unit: "kg", reps, sets: 3, group, date: "", time: "", timestamp: 0, sessionRpe: 6 });
      const fallbacks: Record<keyof typeof groupInfo, StrengthHistoryItem[]> = {
        push: [fallback("器械推胸", 10), fallback("上斜哑铃卧推", 8), fallback("绳索下压", 12), fallback("侧平举", 15)],
        pull: [fallback("器械划船", 10), fallback("对握高位下拉", 10), fallback("反向飞鸟", 15), fallback("锤式弯举", 10)],
        legs: [fallback("腿弯举", 10), fallback("臀冲", 8), fallback("哑铃台阶上步", 10), fallback("提踵", 15)],
      };
      const candidates = strengthHistory.filter((item, index, list) => item.group === group && !item.isWarmup && !blocked(item.name) && list.findIndex(other => other.group === group && !other.isWarmup && (other.canonicalName ?? canonicalExerciseName(other.name)) === (item.canonicalName ?? canonicalExerciseName(item.name))) === index);
      const selected = [...candidates, ...fallbacks[group].filter(item => !candidates.some(candidate => (candidate.canonicalName ?? canonicalExerciseName(candidate.name)) === item.canonicalName) && !blocked(item.name))].slice(0, 4);
      const targetRpe = readinessLevel.level !== null && readinessLevel.level >= 4 ? "6–7" : readinessLevel.level === 3 ? "5–6" : "3–4";
      const targetRir = readinessLevel.level !== null && readinessLevel.level >= 4 ? "3–4" : readinessLevel.level === 3 ? "4–5" : "5+";
      return selected.map((item, index) => {
        const canonicalName = item.canonicalName ?? canonicalExerciseName(item.name);
        const exposures = strengthHistory.filter(entry => !entry.isWarmup && (entry.canonicalName ?? canonicalExerciseName(entry.name)) === canonicalName && entry.unit === item.unit).slice(0, 3);
        const latest = exposures[0] ?? item;
        const reps = Math.max(6, Math.min(15, latest.reps ?? item.reps ?? 10));
        const volumeSets = readinessLevel.level === 2 ? 2 : readinessLevel.level === 3 ? 3 : groupInfo[group].weekly >= 12 ? 2 : groupInfo[group].weekly < 8 && index === 0 ? 4 : 3;
        const sets = Math.max(2, Math.min(4, volumeSets));
        const step = latest.unit === "lbs" ? 5 : group === "legs" ? 5 : 2.5;
        let targetWeight = latest.weight;
        let progression = exposures.length ? "先按最近正式重量完成首组，用动作级RIR校准；整节Session RPE不用于自动加重" : "无可靠历史重量：先用目标RPE/RIR建立工作重量";
        if (latest.weight !== null && readinessLevel.level === 3) {
          targetWeight = Math.max(step, Math.round(latest.weight * .9 / step) * step);
          progression = "今日准备度Moderate：参考重量下调约10%";
        } else if (latest.weight !== null && readinessLevel.level === 2) {
          targetWeight = Math.max(step, Math.round(latest.weight * .7 / step) * step);
          progression = "轻量技术日：参考重量下调约30%";
        }
        if (index === 0 && latest.weight !== null && firstSetRir !== null) {
          if (firstSetRir <= 2) {
            targetWeight = Math.max(step, Math.round(latest.weight * .925 / step) * step);
            progression = "首个正式组RIR≤2：后续组减重约5%–10%，不追加强度";
          } else if (firstSetRir >= 4 && readinessLevel.level !== null && readinessLevel.level >= 4) {
            targetWeight = latest.weight + step;
            progression = `首个正式组RIR≥4且动作稳定：后续组可试加${step}${latest.unit}`;
          } else {
            targetWeight = readinessLevel.level === 3 ? Math.max(step, Math.round(latest.weight * .9 / step) * step) : latest.weight;
            progression = "首个正式组RIR为3：后续组维持重量与动作质量";
          }
        }
        const load = latest.unit === "自重" ? "自重" : targetWeight !== null ? `${targetWeight}${latest.unit}` : "按目标RPE选择重量";
        const historyText = exposures.length ? exposures.map(entry => `${entry.date.slice(5)} ${entry.weight === null ? entry.unit : `${entry.weight}${entry.unit}`}×${entry.reps ?? "?"}（整节RPE${entry.sessionRpe}）`).join(" · ") : "无可靠历史重量，按RPE/RIR建立基准";
        return { name: item.name, prescription: `${load} · ${sets}×${reps}`, rpe: targetRpe, rir: targetRir, rest: reps <= 8 ? "150秒" : "90–120秒", source: `近3次：${historyText}`, progression };
      });
    };

    const choosePlan = () => {
      const empty = [] as PrescribedExercise[];
      if (readiness === null) return { title: "暂不生成训练处方", detail: "至少录入一组恢复数据后再决策；缺失项不会被默认正常。", dose: "补齐 HRV / 睡眠 / RHR 中的可用数据", exercises: empty, targetGroup: null as keyof typeof groupInfo | null };
      if (form.symptoms === "acute" || (pain !== null && pain > 3)) return { title: "恢复训练或完全休息", detail: "不安排相关部位训练。若症状持续、加重或出现胸痛、明显眩晕等情况，及时就医。", dose: "仅轻松活动 10–20 分钟（无症状加重时）", exercises: empty, targetGroup: null };
      if (readinessLevel.level === 1) return { title: "主动恢复", detail: "步行、灵活性和呼吸练习；全程保持轻松，不追求训练量。", dose: "20–30 分钟｜RPE 1–2", exercises: empty, targetGroup: null };
      let target: FormState["preference"] = form.preference;
      if (target === "strength") target = chooseStrengthTarget() ?? "cycling";
      if (target === "upper") target = ["push", "pull"].filter(group => !groupInfo[group as "push" | "pull"].conflict && !groupInfo[group as "push" | "pull"].pain).sort((a, b) => groupInfo[a as "push" | "pull"].weekly - groupInfo[b as "push" | "pull"].weekly)[0] as "push" | "pull" ?? "cycling";
      if (target === "lower") target = "legs";
      if (target === "auto") {
        const strengthTarget = chooseStrengthTarget();
        const lowestStrengthDose = Math.min(pushSets7, pullSets7, legsSets7);
        target = strengthTarget && lowestStrengthDose <= 6 ? strengthTarget : aerobicMinutes7 < 120 ? "cycling" : strengthTarget ?? "cycling";
      }
      if ((target === "push" || target === "pull" || target === "legs") && (groupInfo[target].conflict || groupInfo[target].pain)) target = chooseStrengthTarget() ?? "cycling";
      if (target === "boxing" && ((painActive && /肩|肘|腕/.test(form.painArea)) || neuralLimited)) target = "cycling";
      const moderate = readinessLevel.level === 3;
      const lowTechnique = readinessLevel.level === 2;
      const cyclingCooldown = legsStrength36 || hardCycling36;
      const strengthPlan = (group: keyof typeof groupInfo) => ({
        title: lowTechnique ? `轻量${groupInfo[group].label}技术训练` : `${groupInfo[group].label}力量训练`,
        detail: `7日${groupInfo[group].label}训练${groupInfo[group].weekly}组；按最近3次正式记录调节重量，避开精确48小时疲劳与疼痛冲突。`,
        dose: lowTechnique ? "25–35 分钟｜RPE 3–4" : moderate ? "40–50 分钟｜RPE 5–6" : "50–65 分钟｜RPE 6–7",
        exercises: strengthPrescription(group), targetGroup: group,
      });
      if (lowTechnique && (target === "cycling" || target === "swimming" || target === "boxing")) return { title: "低强度骑行 Zone 2", detail: "当前没有可安全安排的力量部位，采用可交谈强度恢复。", dose: "30–40 分钟｜RPE 3", exercises: empty, targetGroup: null };
      return {
        push: strengthPlan("push"), pull: strengthPlan("pull"), legs: strengthPlan("legs"),
        cycling: { title: moderate || cyclingCooldown ? "低强度骑行 Zone 1–2" : "骑行有氧质量课", detail: cyclingCooldown ? (legsStrength36 ? "昨日腿部力量刺激仍在冷却：只做恢复性骑行，不安排节奏、阈值或冲刺。" : "近期高强度骑行仍在冷却：今天只做轻松转腿，不叠加腿部高强度。") : moderate ? "保持可交谈强度，不安排阈值或冲刺。" : "稳定有氧为主，中段加入3×6分钟节奏段，组间轻松骑3分钟。", dose: cyclingCooldown ? "25–40 分钟｜RPE 2–3" : moderate ? "35–45 分钟｜RPE 3–4" : "55–70 分钟｜RPE 5–6", exercises: empty, targetGroup: null },
        swimming: { title: "技术型游泳", detail: "以划水效率和轻松连续游为主；肩部不适时改为骑行。", dose: moderate ? "30–40 分钟｜RPE 3–4" : "45–60 分钟｜RPE 5–6", exercises: empty, targetGroup: null },
        boxing: { title: "拳击技术训练", detail: "步法、距离和技术组合为主；避免全力击打与高神经压力对抗。", dose: moderate ? "35–45 分钟｜RPE 4" : "50–60 分钟｜RPE 5–6", exercises: empty, targetGroup: null },
        auto: { title: "低强度骑行 Zone 2", detail: "保持可交谈强度。", dose: "35–45 分钟｜RPE 3–4", exercises: empty, targetGroup: null },
        upper: strengthPlan("pull"), lower: strengthPlan("legs"),
      }[target];
    };
    const recoveryInputs = [hrvScore, sleepScore, rhrScore].filter(x => x !== null).length;
    const loadInputs = [formScore, atlSpikeScore].filter(x => x !== null).length;
    const structureInputs = [monotonyScore, densityScore].filter(x => x !== null).length;
    const subjectiveInputs = [energy, fatigue, motivation, stress, upperSoreness, lowerSoreness, sleepQuality].filter(x => x !== null).length;
    const subjectiveMissing = pain === null || form.symptoms === "unknown" || subjectiveInputs < 5;
    const completeness = Math.round((recoveryInputs + loadInputs + structureInputs + subjectiveInputs / 7 + (pain === null || form.symptoms === "unknown" ? 0 : 1)) / 9 * 100);
    const completenessLabel = recovery === null ? "Low" : recoveryInputs === 3 && loadInputs === 2 && structureInputs === 2 && !subjectiveMissing ? "High" : "Moderate";
    const hrvCv = hrv7avg !== null && hrv7sd !== null && hrv7avg ? hrv7sd / hrv7avg * 100 : null;
    const strengthFrequency = numberOrNull(form.strengthFrequency);
    const strengthFrequencyStatus = strengthFrequency === null ? "Unknown" : strengthFrequency <= 1 ? "频率偏低" : strengthFrequency <= 4 ? "合理" : strengthFrequency === 5 ? "偏高" : "过高";
    const fatigueStateLabel = (value: FormState["fatiguePush"]) => value === "yes" ? "疲劳" : value === "no" ? "可用" : "未知";
    const fatigueSummary = `推${fatigueStateLabel(form.fatiguePush)} · 拉${fatigueStateLabel(form.fatiguePull)} · 腿${fatigueStateLabel(form.fatigueLegs)}`;
    const fatigueKnown = [form.fatiguePush, form.fatiguePull, form.fatigueLegs].filter(value => value !== "unknown").length;
    const fatigueScore = fatigueKnown === 0 ? null : fatiguedLabels.length === 3 ? 40 : fatiguedLabels.length ? 70 : fatigueKnown === 3 ? 85 : null;
    const strengthScoreFor = (group: keyof typeof groupInfo) => readiness === null ? null : Math.max(0, Math.min(100,
      readiness
      - (groupInfo[group].conflict ? 18 : 0)
      - (groupInfo[group].pain ? (pain !== null && pain > 3 ? 30 : 12) : 0)
      - (((group === "legs" ? lowerSoreness : upperSoreness) ?? 0) >= 7 ? 16 : ((group === "legs" ? lowerSoreness : upperSoreness) ?? 0) >= 4 ? 8 : 0)
      - (neuralLimited ? 12 : 0)
      - (warmupDowngrade ? 12 : 0)
    ));
    const strengthGroupScores = { push: strengthScoreFor("push"), pull: strengthScoreFor("pull"), legs: strengthScoreFor("legs") };
    const availableStrengthScores = groupOrder.filter(group => !groupInfo[group].pain).map(group => strengthGroupScores[group]).filter((score): score is number => score !== null);
    const strengthScore = availableStrengthScores.length ? Math.max(...availableStrengthScores) : null;
    const aerobicScore = readiness === null ? null : Math.max(0, Math.min(100,
      readiness
      - (neuralLimited ? 16 : 0)
      - (recovery !== null && recovery < 70 ? 10 : 0)
      - (form.symptoms === "acute" ? 28 : form.symptoms === "mild" ? 8 : 0)
      - (warmupDowngrade ? 12 : 0)
    ));
    const strengthReadiness = strengthScore === null ? "Unavailable" : levelFor(strengthScore).label;
    const aerobicReadiness = aerobicScore === null ? "Unavailable" : levelFor(aerobicScore).label;
    const positives: string[] = [];
    if (sleepScore !== null && sleepScore >= 80) positives.push(`睡眠 ${sleep?.toFixed(2)}h，效率 ${sleepEfficiency?.toFixed(2)}%`);
    if (formScore !== null && formScore >= 80) positives.push(`Form ${formValue?.toFixed(2)}，疲劳已充分释放`);
    if (monotonyScore !== null && monotonyScore >= 80) positives.push(`Monotony ${monotony?.toFixed(2)}，训练变化合理`);
    const limitations = [...limits];
    if (hrvScore !== null && hrvScore < 70) limitations.push(`HRV 明显受限：Ratio ${hrvRatio?.toFixed(2)}，Trend ${hrvTrend?.toFixed(2)}%`);
    if (rhrScore !== null && rhrScore < 70) limitations.push(`RHR 高于个人参考 ${rhrDelta?.toFixed(2)} bpm`);
    if (pain === null) limitations.push("今日疼痛未填写，建议性质为有条件成立");
    if (form.symptoms === "unknown") limitations.push("疾病症状未填写，不能默认正常");
    if (subjectiveScore !== null && subjectiveScore < 55) limitations.push(`主观状态偏低：晨检 ${subjectiveScore.toFixed(0)}/100`);
    const suggestionType = subjectiveMissing || neuralStatus === "unknown" ? "有条件成立" : "确定";
    const decision = readinessLevel.level === null ? "等待数据" : readinessLevel.level >= 4 ? "正常训练" : readinessLevel.level === 3 ? "降量训练" : readinessLevel.level === 2 ? "恢复训练" : "完全休息";
    const uniqueLimitations = [...new Set(limitations)];
    const actionState = readinessLevel.level === null ? "WAIT" : readinessLevel.level >= 4 ? "TRAIN" : readinessLevel.level === 3 ? "MODIFY" : "RECOVER";
    const keyLimiter = uniqueLimitations[0] ?? (fatiguedLabels.length ? `48h 局部力量疲劳：${fatiguedLabels.join("＋")}` : "暂无显著限制因素");
    const dataWarnings: string[] = [];
    if (sleep !== null && timeInBed !== null && sleep > timeInBed + .05) dataWarnings.push("睡眠时长大于卧床时间，请检查原始数据");
    if (pain !== null && (pain < 0 || pain > 10)) dataWarnings.push("疼痛评分应在 0–10 之间");
    if (atl !== null && atl < 0 || ctl !== null && ctl < 0) dataWarnings.push("ATL / CTL 不应为负值");
    if (neuralStatus === "unknown") dataWarnings.push("神经状态资料不足：保留 Unknown，不扣分也不封顶");
    const chosenPlan = choosePlan();
    const preferenceLabels: Record<FormState["preference"], string> = { auto: "按规则推荐", strength: "力量优先", push: "推力量", pull: "拉力量", legs: "腿力量", upper: "上肢力量", lower: "下肢力量", cycling: "有氧优先", swimming: "游泳", boxing: "拳击" };
    const recommendationReason = form.preference !== "auto"
      ? `已优先考虑「${preferenceLabels[form.preference]}」；疼痛、疾病症状、神经限制和48小时局部疲劳仍可自动改写项目。`
      : chosenPlan.targetGroup
        ? `自动选择${groupInfo[chosenPlan.targetGroup].label}力量：该部位7日有效训练量为${groupInfo[chosenPlan.targetGroup].weekly}组，且当前没有明确疼痛或48小时疲劳冲突。`
        : chosenPlan.title.includes("骑行")
          ? `自动比较恢复、专项准备度与7日训练结构后选择骑行；当前记录的7日有氧/专项剂量为${aerobicMinutes7}分钟。`
          : `根据今日恢复、专项准备度、疼痛与局部疲劳，选择当前冲突最少的项目。`;
    const recoveryConfidence = recoveryInputs === 3 && sleep3avg !== null ? "高" : recoveryInputs >= 2 ? "中" : "低";
    const strengthConfidence = recovery !== null && pain !== null && upperSoreness !== null && lowerSoreness !== null && [form.fatiguePush, form.fatiguePull, form.fatigueLegs].every(value => value !== "unknown") && strengthHistory.length > 0
      ? (warmupComplete ? "高" : "中") : "低";
    const aerobicConfidence = recovery !== null && pain !== null && form.symptoms !== "unknown"
      ? (warmupComplete && form.warmupHr !== "unknown" ? "高" : "中") : "低";
    return { hrvRatio, hrvRatioScore, hrvZ, hrvTrend, hrvTrendScore, hrvCv, hrvScore, sleepEfficiency, sleepDurationScore, sleepEfficiencyScore, sleepScore,
      sleepDebt3d, subjectiveScore, warmupComplete, warmupStop, warmupDowngrade, recoveryConfidence, strengthConfidence, aerobicConfidence,
      rhrDelta, rhrScore, recovery, formValue, formScore, acwr, acwrScore, atlSpike, atlSpikeScore, fatigueMomentum, load, monotonyScore, densityScore, structure,
      readiness, readinessLevel, completeness, completenessLabel, limits, neuralReady, neuralLimited, neuralStatus, neuralPressure, neuralTriggers, neuralKnownInputs, cnsFatigue, fatiguedLabels, fatigueSummary, fatigueScore, strengthFrequencyStatus, strengthScore, strengthGroupScores, aerobicScore, strengthReadiness,
      aerobicReadiness, positives: positives.slice(0, 3), limitations: uniqueLimitations.slice(0, 3), allLimitations: uniqueLimitations, suggestionType, decision, actionState, keyLimiter, dataWarnings, recommendationReason, plan: chosenPlan };
  }, [form]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({ ...current, [key]: value }));
  const reset = () => { setForm({ ...emptyForm, date: today() }); setImportNotice(null); setLastImportFields([]); setImportAudit(null); setAuditOpen(false); window.localStorage.removeItem("heracles-daily-v1"); };
  const applyTextData = (source: string) => {
    if (!source.trim()) {
      setPasteStatus({ kind: "error", message: "请先粘贴报告或数据。" });
      return;
    }
    const parsed = parsePastedData(source);
    if (!parsed.fields.length) {
      setImportNotice(null);
      setImportAudit(null);
      setPasteOpen(true);
      setPasteStatus({ kind: "error", message: "没有识别到字段。请粘贴包含 HRV、RHR、ATL、CTL、睡眠等字段的文字报告；如果是截图，请先提取成文字。" });
      return;
    }
    const resetUnknownSubjectives = /Workout list, each line is an entry of workout/i.test(source)
      ? { neural: "unknown" as const, symptoms: "unknown" as const, pain: "", painArea: "", energy: "", fatigue: "", motivation: "", stress: "", upperSoreness: "", lowerSoreness: "", sleepQuality: "", warmupRpeDelta: "", warmupPain: "", warmupHr: "unknown" as const, movementQuality: "unknown" as const, warmupEnergy: "unknown" as const, firstSetRir: "", aerobicMinutes7: "", hardCycling36: "", evaluationAt: "", upperSets48: "", lowerSets48: "", pushSets48: "", pullSets48: "", legsSets48: "", pushSets7: "", pullSets7: "", legsSets7: "", strengthHistory: "", strengthFatigue: "unknown" as const, fatiguePush: "unknown" as const, fatiguePull: "unknown" as const, fatigueLegs: "unknown" as const }
      : {};
    setForm(current => ({ ...current, ...resetUnknownSubjectives, ...parsed.values }));
    const importedDate = parsed.values.date ? `（${parsed.values.date}）` : "";
    setImportNotice(`识别完成${importedDate}：已填入 ${parsed.fields.length} 项，准备度已更新。`);
    setLastImportFields(parsed.fields);
    setImportAudit(parsed.audit ?? null);
    setAuditOpen(false);
    setPasteStatus(null);
    setPastedText("");
    setPasteOpen(false);
    window.setTimeout(() => document.getElementById("training-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const queueTextImport = (source: string) => {
    if (!source.trim()) {
      setPasteStatus({ kind: "error", message: "请先粘贴报告或数据。" });
      return;
    }
    setPastedText("");
    setPasteStatus(null);
    setPasteOpen(false);
    setImportNotice("已收到数据，正在识别…");
    window.setTimeout(() => applyTextData(source), 40);
  };
  const handlePasteChange = (source: string) => {
    setPastedText(source);
    setPasteStatus(null);
    if (pasteChangeTimer.current !== null) window.clearTimeout(pasteChangeTimer.current);
    if (source.length > 400 && /(?:HRV|ATL\(Fatigue\)|Sleep Session Detail|Resting Heart Rate)/i.test(source)) {
      setPasteStatus({ kind: "info", message: "检测到整段报告，正在自动识别…" });
      pasteChangeTimer.current = window.setTimeout(() => queueTextImport(source), 260);
    }
  };
  const readClipboard = async () => {
    try {
      const clipboard = await navigator.clipboard.readText();
      if (!clipboard.trim()) {
        setPasteStatus({ kind: "info", message: "剪贴板是空的。也可以长按下方文本框手动粘贴。" });
        return;
      }
      queueTextImport(clipboard);
    } catch {
      setPasteStatus({ kind: "info", message: "浏览器未允许读取剪贴板，请长按下方文本框选择“粘贴”。粘贴后会自动识别。" });
    }
  };
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboard = event.clipboardData.getData("text");
    if (!clipboard.trim()) return;
    event.preventDefault();
    queueTextImport(clipboard);
  };
  const applyPastedData = () => applyTextData(pastedText);

  const updateAuditExercise = (index: number, patch: Partial<StrengthHistoryItem>) => {
    if (!importAudit?.exercises[index]) return;
    const previous = importAudit.exercises[index];
    const next = { ...previous, ...patch };
    if (patch.name !== undefined) next.canonicalName = canonicalExerciseName(patch.name);
    setForm(currentForm => {
        let history: StrengthHistoryItem[] = [];
        try { history = JSON.parse(currentForm.strengthHistory || "[]") as StrengthHistoryItem[]; } catch { history = []; }
        let replaced = false;
        const nextHistory = history.map(item => {
          if (!replaced && item.timestamp === previous.timestamp && item.name === previous.name) {
            replaced = true;
            return next;
          }
          return item;
        });
        const nextForm = { ...currentForm, strengthHistory: JSON.stringify(nextHistory) };
        const evaluationTimestamp = Date.parse(`${(currentForm.evaluationAt || `${currentForm.date} 09:00`).replace(" ", "T")}Z`);
        const latestDay = Date.parse(`${currentForm.date}T00:00:00Z`);
        const in48h = (item: StrengthHistoryItem) => Number.isFinite(evaluationTimestamp) && evaluationTimestamp - item.timestamp >= 0 && evaluationTimestamp - item.timestamp <= 48 * 3_600_000;
        const in7d = (item: StrengthHistoryItem) => {
          const itemDay = Date.parse(`${item.date}T00:00:00Z`);
          const age = (latestDay - itemDay) / 86_400_000;
          return Number.isFinite(age) && age >= 1 && age <= 7;
        };
        const doseKeys = {
          push: { h48: "pushSets48", d7: "pushSets7" },
          pull: { h48: "pullSets48", d7: "pullSets7" },
          legs: { h48: "legsSets48", d7: "legsSets7" },
        } as const;
        const adjust = (group: StrengthGroup, window: "h48" | "d7", delta: number) => {
          if (group === "core") return;
          const key = doseKeys[group][window];
          nextForm[key] = String(Math.max(0, (numberOrNull(nextForm[key]) ?? 0) + delta));
        };
        if (!previous.isWarmup) {
          if (in48h(previous)) adjust(previous.group, "h48", -previous.sets);
          if (in7d(previous)) adjust(previous.group, "d7", -previous.sets);
        }
        if (!next.isWarmup) {
          if (in48h(next)) adjust(next.group, "h48", next.sets);
          if (in7d(next)) adjust(next.group, "d7", next.sets);
        }
        nextForm.upperSets48 = String((numberOrNull(nextForm.pushSets48) ?? 0) + (numberOrNull(nextForm.pullSets48) ?? 0));
        nextForm.lowerSets48 = nextForm.legsSets48;
        nextForm.fatiguePush = (numberOrNull(nextForm.pushSets48) ?? 0) >= 8 ? "yes" : "no";
        nextForm.fatiguePull = (numberOrNull(nextForm.pullSets48) ?? 0) >= 8 ? "yes" : "no";
        nextForm.fatigueLegs = (numberOrNull(nextForm.legsSets48) ?? 0) >= 8 ? "yes" : "no";
      return nextForm;
    });
    const exercises = [...importAudit.exercises];
    exercises[index] = next;
    setImportAudit({ ...importAudit, exercises });
  };
  const confirmAudit = () => {
    setAuditOpen(false);
    setImportNotice("力量记录已确认：修正后的动作与正式组已用于准备度和训练处方。");
    window.setTimeout(() => document.getElementById("training-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const exportPng = () => {
    const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <rect width="1080" height="1920" fill="#f3f5f4"/><rect x="54" y="54" width="972" height="1812" rx="44" fill="#fff"/>
    <text x="96" y="130" font-family="Arial,PingFang SC,sans-serif" font-size="24" font-weight="700" letter-spacing="5" fill="#718078">HERACLES DAILY</text>
    <text x="96" y="188" font-family="Arial,PingFang SC,sans-serif" font-size="30" font-weight="700" fill="#13231a">每日恢复与训练准备度</text>
    <text x="96" y="236" font-family="Arial,PingFang SC,sans-serif" font-size="22" fill="#718078">${esc(form.date)} · 数据完整度 ${result.completeness}%</text>
    <rect x="96" y="324" width="888" height="300" rx="34" fill="#0b1f2e"/>
    <text x="136" y="390" font-family="Arial" font-size="22" font-weight="700" letter-spacing="4" fill="#7edfa5">TODAY</text>
    <text x="136" y="485" font-family="Arial" font-size="72" font-weight="800" fill="#ffffff">${result.actionState}</text>
    <text x="136" y="540" font-family="Arial,PingFang SC,sans-serif" font-size="28" font-weight="700" fill="#7edfa5">${esc(result.decision)}</text>
    <foreignObject x="520" y="378" width="410" height="165"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,PingFang SC,sans-serif;font-size:23px;line-height:1.5;color:#d7e3ea"><b style="color:#ffbd67">KEY LIMITER</b><br/>${esc(result.keyLimiter)}</div></foreignObject>
    <rect x="96" y="680" width="888" height="228" rx="30" fill="#f5f7f6"/>
    <text x="136" y="750" font-family="Arial" font-size="22" fill="#718078">RECOVERY</text><text x="136" y="842" font-family="Arial" font-size="66" font-weight="800" fill="#122319">${result.recovery === null ? "—" : Math.round(result.recovery)}</text>
    <text x="420" y="750" font-family="Arial" font-size="22" fill="#718078">STRENGTH</text><text x="420" y="842" font-family="Arial" font-size="66" font-weight="800" fill="#122319">${result.strengthScore === null ? "—" : Math.round(result.strengthScore)}</text>
    <text x="704" y="750" font-family="Arial" font-size="22" fill="#718078">AEROBIC</text><text x="704" y="842" font-family="Arial" font-size="66" font-weight="800" fill="#122319">${result.aerobicScore === null ? "—" : Math.round(result.aerobicScore)}</text>
    <rect x="96" y="960" width="888" height="490" rx="34" fill="#13231a"/><text x="140" y="1034" font-family="Arial" font-size="24" font-weight="700" letter-spacing="4" fill="#82e9ad">TODAY'S DECISION</text>
    <text x="140" y="1112" font-family="Arial,PingFang SC,sans-serif" font-size="46" font-weight="800" fill="#fff">${esc(result.plan.title)}</text>
    <text x="140" y="1172" font-family="Arial,PingFang SC,sans-serif" font-size="27" font-weight="700" fill="#82e9ad">${esc(result.plan.dose)}</text>
    <foreignObject x="140" y="1220" width="800" height="180"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,PingFang SC,sans-serif;font-size:28px;line-height:1.7;color:#d5ddd8">${esc(result.plan.detail)}</div></foreignObject>
    <text x="96" y="1540" font-family="Arial,PingFang SC,sans-serif" font-size="25" font-weight="700" fill="#13231a">关键指标</text>
    <text x="96" y="1600" font-family="Arial" font-size="23" fill="#718078">HRV Ratio ${display(result.hrvRatio, "", 2)} · Sleep Efficiency ${display(result.sleepEfficiency, "%", 1)}</text>
    <text x="96" y="1650" font-family="Arial" font-size="23" fill="#718078">RHR Δ ${display(result.rhrDelta, " bpm", 1)} · ACWR ${display(result.acwr, "", 2)}</text>
    <text x="96" y="1700" font-family="Arial" font-size="23" fill="#718078">Form ${display(result.formValue, "", 1)} · ATL Spike ${display(result.atlSpike, "%", 1)}</text>
    <text x="96" y="1790" font-family="Arial,PingFang SC,sans-serif" font-size="20" fill="#9aa69f">热身 10–15 分钟后必须二次判定。仅用于训练决策支持。</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1920;
      const context = canvas.getContext("2d"); if (!context) return; context.drawImage(image, 0, 0);
      canvas.toBlob(png => { if (!png) return; const link = document.createElement("a"); link.href = URL.createObjectURL(png); link.download = `HERACLES-DAILY-${form.date}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }, "image/png");
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">H</span><span><b>HERACLES DAILY</b><small>LOCAL RULE ENGINE</small></span></div>
        <div className="header-actions">
          <Button variant="outline" onClick={reset}><RotateCcw /> 清空</Button>
          <Button onClick={exportPng} className="export-button"><Download /> 导出报告</Button>
        </div>
      </header>

      <Dialog open={pasteOpen} onOpenChange={(open) => { setPasteOpen(open); if (!open) setPasteStatus(null); }}>
        <section className="paste-callout" aria-label="整段数据快速录入">
          <div><span className="section-kicker">本机规则引擎</span><h2>粘贴数据，直接生成今日训练</h2><p>无需 AI、登录或服务器；全部判断按固定规则在当前浏览器完成。</p></div>
          <DialogTrigger asChild><Button className="paste-trigger"><ClipboardPaste /> 粘贴数据</Button></DialogTrigger>
        </section>
        <DialogContent className="paste-dialog">
          <DialogHeader>
            <DialogTitle>粘贴今日数据</DialogTitle>
            <DialogDescription>把整段报告直接贴进来。网页只解析能识别的字段，并在本机按固定规则计算。</DialogDescription>
          </DialogHeader>
          <div className="paste-tools">
            <Button variant="outline" onClick={readClipboard}><ClipboardPaste /> 读取并自动识别</Button>
            <span>或长按文本框选择“粘贴”，无需再点按钮</span>
          </div>
          <Textarea value={pastedText} onPaste={handlePaste} onChange={(event) => handlePasteChange(event.target.value)}
            className="paste-textarea" placeholder={"例如：\nHRV 今日: 35 ms\nHRV 28日中位基线: 32 ms\n实际睡眠: 6h 45m\nRHR 今日: 54 bpm\nATL 今日: 202.3\nCTL 今日: 289.2"} />
          {pasteStatus ? <div className={`paste-status ${pasteStatus.kind}`}>{pasteStatus.kind === "success" ? <CheckCircle2 /> : <ShieldAlert />}<span>{pasteStatus.message}</span></div> : null}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">完成</Button></DialogClose>
            <Button onClick={applyPastedData}><CheckCircle2 /> 识别并计算</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importNotice ?
        <section className="import-confirmation" role="status" aria-live="polite">
          <CheckCircle2 />
          <div className="import-summary"><strong>{importNotice}</strong><span>系统只计算识别成功的数据；缺失项继续保持 Unknown。</span>
            {lastImportFields.length ? <details className="import-fields-details"><summary>查看已识别的 {lastImportFields.length} 项数据</summary><div className="recognition-chips">{lastImportFields.slice(0, 14).map(field => <span key={field}>✓ {field}</span>)}{lastImportFields.length > 14 ? <span>+{lastImportFields.length - 14} 项</span> : null}</div></details> : null}
            <div className="recognition-missing">
              {!form.hrv || !form.hrvBaseline ? <span>⚠ HRV 基线不完整</span> : null}
              {!form.sleep || !form.timeInBed ? <span>⚠ 睡眠不完整</span> : null}
              {!form.rhr || !form.rhrBaseline ? <span>⚠ RHR 参考不完整</span> : null}
              {!form.atl || !form.ctl ? <span>⚠ ATL / CTL 不完整</span> : null}
              {form.pain === "" || form.symptoms === "unknown" || form.neural === "unknown" ? <span>⚠ 主观状态待补充</span> : null}
            </div>
          </div>
        </section>
      : null}

      {importAudit ? <details className="recognition-audit" open={auditOpen} onToggle={event => setAuditOpen(event.currentTarget.open)}>
        <summary><div><span className="section-kicker">可选核对</span><strong>训练记录识别</strong><small>{importAudit.exercises.length} 个力量动作 · {importAudit.unparsed.length} 项需核对</small></div><span>{auditOpen ? "收起" : "展开"}</span></summary>
        <div className="audit-stat-grid">
          <div><span>评估时点</span><strong>{importAudit.evaluationAt}</strong><small>以主要睡眠结束时刻为训练前边界</small></div>
          <div><span>训练记录</span><strong>{importAudit.workouts}次</strong><small>力量 {importAudit.strengthSessions} 次 · 评估后排除 {importAudit.excludedAfterEvaluation} 次</small></div>
          <div><span>动作记录</span><strong>{importAudit.exercises.length}条</strong><small>保留最近3次用于重量建议</small></div>
        </div>
        <div className="audit-exercise-list">
          {importAudit.exercises.length ? importAudit.exercises.slice(0, 12).map((exercise, index) => <article className={exercise.isWarmup ? "is-warmup" : ""} key={`${exercise.timestamp}-${index}`}>
            <Select value={exercise.group} onValueChange={value => updateAuditExercise(index, { group: value as StrengthGroup })}><SelectTrigger className="audit-group" aria-label={`${exercise.name}动作分类`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="push">推</SelectItem><SelectItem value="pull">拉</SelectItem><SelectItem value="legs">腿</SelectItem><SelectItem value="core">核心</SelectItem></SelectContent></Select>
            <div className="audit-name"><Input value={exercise.name} onChange={event => updateAuditExercise(index, { name: event.target.value })} aria-label="动作名称"/><small>{exercise.date.slice(5)} {exercise.time} · 归一为 {exercise.canonicalName ?? canonicalExerciseName(exercise.name)}</small></div>
            <div className="audit-values">
              <label><span>重量</span><Input type="number" inputMode="decimal" value={exercise.weight ?? ""} onChange={event => updateAuditExercise(index, { weight: event.target.value === "" ? null : Number(event.target.value) })}/></label>
              <Select value={exercise.unit} onValueChange={value => updateAuditExercise(index, { unit: value as StrengthHistoryItem["unit"], ...(value === "自重" ? { weight: null } : {}) })}><SelectTrigger aria-label="重量单位"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="lbs">lbs</SelectItem><SelectItem value="自重">自重</SelectItem></SelectContent></Select>
              <label><span>组</span><Input type="number" inputMode="numeric" value={exercise.sets} onChange={event => updateAuditExercise(index, { sets: Math.max(0, Number(event.target.value) || 0) })}/></label>
              <label><span>次</span><Input type="number" inputMode="numeric" value={exercise.reps ?? ""} onChange={event => updateAuditExercise(index, { reps: event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0) })}/></label>
            </div>
            <button type="button" className={`warmup-toggle ${exercise.isWarmup ? "active" : ""}`} onClick={() => updateAuditExercise(index, { isWarmup: !exercise.isWarmup })}>{exercise.isWarmup ? "已排除：热身组" : "正式组"}</button>
          </article>) : <p>没有识别到包含重量、次数或组数的力量动作。</p>}
        </div>
        {importAudit.unparsed.length ? <div className="audit-unparsed"><ShieldAlert/><div><strong>需要人工核对</strong><p>{importAudit.unparsed.join(" · ")}</p></div></div> : <div className="audit-ok"><CheckCircle2/>未发现明显未识别的力量动作标题</div>}
        <div className="audit-actions"><span>修改会立即重算局部正式组，并同步后面的力量处方。</span><Button type="button" onClick={confirmAudit}><CheckCircle2/>确认并查看仪表盘</Button></div>
      </details> : null}

      <section id="training-dashboard" className="status-dashboard" aria-label="训练状态仪表盘">
        <header className="dashboard-title"><div><span>HERACLES DAILY</span><h1>今日准备度</h1></div><time>{form.date}</time></header>
        <div className="core-score-grid">
          <GaugeDial compact featured value={result.recovery} label="生理恢复" eyebrow="RECOVERY" status={result.recovery === null ? "Unknown" : metricStatus(result.recovery)} confidence={result.recoveryConfidence} />
          <GaugeDial compact value={result.strengthScore} label="最佳可用力量" eyebrow="STRENGTH" status={result.strengthReadiness} confidence={result.strengthConfidence} />
          <GaugeDial compact value={result.aerobicScore} label="有氧准备度" eyebrow="AEROBIC" status={result.aerobicReadiness} confidence={result.aerobicConfidence} />
        </div>
        <div className={`decision-bar ${result.actionState.toLowerCase()}`}>
          <div><span>今日建议</span><strong>{result.decision}</strong><em>{result.plan.title} · {result.plan.dose}</em></div>
          <div className="key-limiter"><ShieldAlert /><span>关键限制</span><strong>{result.keyLimiter}</strong></div>
        </div>
        {result.dataWarnings.length ? <div className="data-warning"><ShieldAlert />{result.dataWarnings.map(item => <span key={item}>{item}</span>)}</div> : null}

        <details className="dashboard-details">
          <summary><div><span>DEEP DIVE</span><strong>查看详细指标</strong></div><small>Recovery {result.recovery === null ? "—" : Math.round(result.recovery)} · Load {result.load === null ? "—" : Math.round(result.load)} · Structure {result.structure === null ? "—" : Math.round(result.structure)}</small></summary>
        <div className="dashboard-panels">
          <DashboardPanel icon={<HeartPulse />} title="RECOVERY SYSTEM">
            <DashboardRow label="HRV ratio" value={display(result.hrvRatio, "", 2)} score={result.hrvRatioScore} note={`${form.hrv || "—"} / ${form.hrvBaseline || "—"} ms`} />
            <DashboardRow label="HRV trend" value={display(result.hrvTrend, "%", 2)} score={result.hrvTrendScore} note="相对3日前" />
            <DashboardRow label="HRV variability" value={display(result.hrvCv, "%", 2)} score={result.hrvScore} note="7日 CV" />
            <DashboardRow label="Sleep duration" value={form.sleep ? `${form.sleep} h` : "Unknown"} score={result.sleepScore} note={`效率 ${display(result.sleepEfficiency, "%", 1)}`} />
            <DashboardRow label="3日睡眠债" value={display(result.sleepDebt3d, " h", 1)} score={result.sleepDebt3d === null ? null : result.sleepDebt3d <= 1 ? 85 : result.sleepDebt3d <= 3 ? 70 : 55} note={`3日均值 ${form.sleep3avg || "—"} h`} />
            <DashboardRow label="RHR delta" value={display(result.rhrDelta, " bpm", 1)} score={result.rhrScore} note={`${form.rhr || "—"} / ${form.rhrBaseline || "—"} bpm`} />
          </DashboardPanel>

          <DashboardPanel icon={<Brain />} title="NEURAL SYSTEM">
            <DashboardRow label="HRV Z-score" value={display(result.hrvZ, "", 2)} score={result.hrvZ === null ? null : result.hrvZ >= 1 ? 95 : result.hrvZ >= -1 ? 85 : result.hrvZ >= -1.5 ? 70 : 55} />
            <SegmentMeter value={result.hrvZ === null ? null : Math.max(0, Math.min(100, (result.hrvZ + 3) / 6 * 100))} />
            <DashboardRow label="Neural readiness" value={result.neuralStatus === "ready" ? "Ready" : result.neuralStatus === "limited" ? "Limited" : "Unknown"} score={result.neuralStatus === "ready" ? 85 : result.neuralStatus === "limited" ? 55 : null} note={`Pressure ${result.neuralPressure} · ${result.neuralTriggers}/${result.neuralKnownInputs}项可用`} />
            <SegmentMeter value={result.neuralStatus === "ready" ? 85 : result.neuralStatus === "limited" ? 55 : null} />
            <DashboardRow label="CNS fatigue" value={result.cnsFatigue} score={result.cnsFatigue === "Yes" ? 40 : result.cnsFatigue === "No" ? 85 : null} note="缺失时保持Unknown，不自动限制" />
            <SegmentMeter value={result.cnsFatigue === "Yes" ? 40 : result.cnsFatigue === "No" ? 85 : null} />
          </DashboardPanel>

          <DashboardPanel icon={<Dumbbell />} title="TRAINING LOAD">
            <DashboardRow label="ATL" value={form.atl || "Unknown"} score={result.load} />
            <DashboardRow label="CTL" value={form.ctl || "Unknown"} score={result.load} />
            <DashboardRow label="Form" value={display(result.formValue, "", 2)} score={result.formScore} />
            <DashboardRow label="ACWR reference" value={display(result.acwr, "", 2)} score={null} note="仅作趋势参考 · 不参与评分" />
            <DashboardRow label="ATL spike" value={display(result.atlSpike, "%", 2)} score={result.atlSpikeScore} />
            <DashboardRow label="Fatigue momentum" value={display(result.fatigueMomentum, "%", 2)} score={result.fatigueMomentum === null ? null : result.fatigueMomentum > 10 ? 40 : result.fatigueMomentum < -10 ? 85 : 70} />
          </DashboardPanel>

          <DashboardPanel icon={<Gauge />} title="TRAINING STRUCTURE">
            <DashboardRow label="Monotony" value={form.monotony || "Unknown"} score={result.monotonyScore} />
            <SegmentMeter value={result.monotonyScore} />
            <DashboardRow label="Strength fatigue" value={result.fatigueSummary} score={result.fatigueScore} note={`48h 推 ${form.pushSets48 || "—"} · 拉 ${form.pullSets48 || "—"} · 腿 ${form.legsSets48 || "—"}组`} />
            <SegmentMeter value={result.fatigueScore} />
            <DashboardRow label="7日力量剂量" value={`推${form.pushSets7 || "—"} · 拉${form.pullSets7 || "—"} · 腿${form.legsSets7 || "—"}`} score={result.structure} note="有效正式组 · 用于选择今日刺激" />
            <DashboardRow label="部位准备度" value={`推${result.strengthGroupScores.push === null ? "—" : Math.round(result.strengthGroupScores.push)} · 拉${result.strengthGroupScores.pull === null ? "—" : Math.round(result.strengthGroupScores.pull)} · 腿${result.strengthGroupScores.legs === null ? "—" : Math.round(result.strengthGroupScores.legs)}`} score={result.strengthScore} note="主仪表显示无疼痛、无冲突部位的最高值" />
            <DashboardRow label="Training density" value={form.density || "Unknown"} score={result.densityScore} />
            <SegmentMeter value={result.densityScore} />
            <DashboardRow label="7日训练" value={`${form.workoutCount || "—"}次 · ${form.workoutMinutes || "—"}min`} score={result.structure} note={`有氧/专项 ${form.aerobicMinutes7 || "—"}min · 总负荷 ${form.workoutLoad || "Unknown"}`} />
          </DashboardPanel>

        </div>
        </details>
        <p className="dashboard-note">评估时点 {form.evaluationAt || `${form.date} 训练前`}　｜　数据完整度 {result.completenessLabel} · {result.completeness}%　｜　{result.suggestionType}　｜　力量与有氧分数为专项模型估算，ACWR不参与评分；不代表 WHOOP、Garmin 官方算法或医学诊断。</p>
      </section>

      <details className="quick-subjective compact-details" aria-label="今日主观状态晨检">
        <summary><div><span>MORNING CHECK</span><h2>30秒晨间体感</h2></div><strong>{result.subjectiveScore === null ? "待填写" : `${Math.round(result.subjectiveScore)}/100`}</strong></summary>
        <div className="compact-details-body"><p className="compact-help">1最低，5最高；疲劳、压力和酸痛则5代表最严重。</p>
        <div className="subjective-scale-grid">
          <ScaleField label="精力" value={form.energy} onChange={v => update("energy", v)} />
          <ScaleField label="总体疲劳" value={form.fatigue} onChange={v => update("fatigue", v)} />
          <ScaleField label="训练意愿" value={form.motivation} onChange={v => update("motivation", v)} />
          <ScaleField label="心理压力" value={form.stress} onChange={v => update("stress", v)} />
          <ScaleField label="睡眠质量" value={form.sleepQuality} onChange={v => update("sleepQuality", v)} />
          <ScaleField label="上肢酸痛" value={form.upperSoreness} onChange={v => update("upperSoreness", v)} />
          <ScaleField label="下肢酸痛" value={form.lowerSoreness} onChange={v => update("lowerSoreness", v)} />
        </div>
        <div className="subjective-safety-grid">
          <Field label="疼痛评分" value={form.pain} onChange={v => update("pain", v)} unit="/10" step="1" />
          <label className="field"><span>疼痛 / 不适位置</span><Input value={form.painArea} onChange={e => update("painArea", e.target.value)} placeholder="如：右肩、左膝" /></label>
          <SelectField label="疾病症状" value={form.symptoms} onChange={v => update("symptoms", v as FormState["symptoms"])} options={[["unknown","Unknown"],["none","无"],["mild","轻微症状"],["acute","急性 / 明显症状"]]} />
        </div>
        <div className="subjective-summary"><span>晨检状态</span><strong>{result.subjectiveScore === null ? "待填写" : `${Math.round(result.subjectiveScore)}/100`}</strong><em>用于校正训练决策，不重复计入生理恢复。</em></div>
        </div>
      </details>

      <details className="secondary-details compact-details">
        <summary><div><span>DECISION FACTORS</span><h2>查看加分与限制</h2></div><strong>{result.limitations.length ? `${result.limitations.length} 项限制` : "暂无明显限制"}</strong></summary>
      <section className="factor-grid">
        <article className="factor-card positive"><h2><CheckCircle2 /> 主要加分项</h2>{result.positives.length ? result.positives.map(item => <p key={item}>{item}</p>) : <p>暂无明显加分项</p>}</article>
        <article className="factor-card warning"><h2><ShieldAlert /> 主要限制因素</h2>{result.limitations.length ? result.limitations.map(item => <p key={item}>{item}</p>) : <p>暂无明显限制</p>}</article>
      </section>
      </details>

      <ReportSection icon={<Dumbbell />} title="今天练什么" subtitle={`${result.decision} · ${result.suggestionType}`}>
        <div className="training-intent"><div><strong>训练方向</strong><small>规则仍会优先处理疼痛、症状和局部冷却。</small></div><div role="group" aria-label="今日训练方向">{([["auto","按规则"],["strength","力量"],["cycling","有氧"]] as const).map(([value,label]) => <Button key={value} type="button" variant="outline" className={form.preference === value ? "active" : ""} onClick={() => update("preference", value)}>{label}</Button>)}</div></div>
        <article className={`plan-summary ${result.actionState.toLowerCase()}`}>
          <div><span>{result.decision}</span><h3>{result.plan.title}</h3><p>{result.plan.detail}</p></div>
          <strong>{result.plan.dose}</strong>
        </article>
        <div className="plan-safety"><ShieldAlert/><div><span>关键限制</span><strong>{result.keyLimiter}</strong><small>避免：{result.neuralLimited ? "高强度与极限输出" : form.painArea ? `${form.painArea} 疼痛动作` : "无计划极限测试"}</small></div></div>
        <details className="recommendation-reason"><summary>查看推荐依据</summary><p>{result.recommendationReason}</p></details>
        <div className="session-plan merged-plan"><h3>{result.plan.targetGroup ? "力量处方" : "执行步骤"}</h3>
          {result.plan.title.includes("骑行") ? <ol><li>热身：10–15 分钟轻松骑，RPE 2–3。</li><li>主训练：连续 Zone 2，保持可完整对话；仅当今日建议为正常训练时，加入 3×6 分钟节奏段，组间轻松骑 3 分钟。</li><li>总时长：{result.plan.dose.split("｜")[0]}；全程不冲刺、不力竭。</li><li>放松：8–10 分钟逐步降低踏频和心率。</li></ol>
            : result.plan.targetGroup ? <>
              <ol><li>热身：10–15分钟动态活动，每个首个复合动作完成2–4组递增热身。</li><li>下面重量来自你最近一次可识别记录，并已按今日准备度降载；若设备或动作口径不同，以目标RPE和RIR为准。</li></ol>
              <div className="rir-calibration"><div><span>首个正式组校准</span><strong>{form.firstSetRir === "" ? "完成第一组后填写 RIR" : `RIR ${form.firstSetRir}${form.firstSetRir === "5" ? "+" : ""} · 处方已更新`}</strong><small>整节训练RPE只作参考，不再触发自动加重。</small></div><div role="group" aria-label="首个正式组RIR">{[0,1,2,3,4,5].map(value => <button key={value} type="button" className={form.firstSetRir === String(value) ? "active" : ""} onClick={() => update("firstSetRir", form.firstSetRir === String(value) ? "" : String(value))}>{value === 5 ? "5+" : value}</button>)}</div></div>
              <div className="strength-prescription">
                {result.plan.exercises.map((exercise, index) => <article key={`${exercise.name}-${index}`}><span>{String(index + 1).padStart(2,"0")}</span><div><strong>{exercise.name}</strong></div><b>{exercise.prescription}</b><em>RPE {exercise.rpe} · RIR {exercise.rir} · 休息 {exercise.rest}</em></article>)}
              </div>
              <details className="progression-details"><summary>查看重量历史与进阶依据</summary><div>{result.plan.exercises.map((exercise, index) => <article key={`${exercise.name}-basis-${index}`}><strong>{exercise.name}</strong><small>{exercise.source}</small><p>{exercise.progression}</p></article>)}</div></details>
              <p className="strength-rule">当首个正式组RPE高出目标≥2、疼痛增加或动作代偿时：重量再降10%–15%；疼痛＞3/10立即停止相关动作。</p>
            </>
            : result.plan.title.includes("游泳") ? <ol><li>热身：300–500m 轻松游＋技术划水，RPE 2–3。</li><li>主训练：以技术效率和连续有氧为主；肩部出现疼痛、无力或动作代偿时立即降量或结束。</li><li>按 {result.plan.dose} 执行，不安排全力冲刺或高乳酸组。</li><li>放松：200–300m 轻松游，结束后复查肩部感觉。</li></ol>
            : result.plan.title.includes("拳击") ? <ol><li>热身：10–15 分钟步法、影子拳和关节动态活动。</li><li>主训练：距离、步法、组合技术和轻强度靶练为主，避免全力击打和高强度对抗。</li><li>按 {result.plan.dose} 执行；肩、肘、腕或神经疲劳信号升高时立即降档。</li><li>结束前用 5–8 分钟低强度技术动作恢复呼吸和节奏。</li></ol>
            : <ol><li>先静息检查症状；胸痛、异常气短、头晕、神经症状或明显关节痛时完全休息并考虑就医。</li><li>仅在症状不加重时进行轻松步行、呼吸和灵活性练习。</li><li>全程 RPE 1–2，不追求时长、训练量或热量消耗。</li><li>任何不适增加立即终止。</li></ol>}
        </div>
      </ReportSection>

      <details className="warmup-check">
        <summary><div><Activity /><h2>热身后再确认</h2></div><span className={`warmup-result ${result.warmupStop ? "stop" : result.warmupDowngrade ? "down" : result.warmupComplete ? "go" : "wait"}`}>{result.warmupStop ? "终止相关训练" : result.warmupDowngrade ? "建议降档" : result.warmupComplete ? "可以继续" : "训练前填写"}</span></summary>
        <div className="warmup-body"><div className="warmup-input-grid">
          <Field label="RPE高出预计" value={form.warmupRpeDelta} onChange={v => update("warmupRpeDelta", v)} unit="级" step="1" />
          <Field label="热身后疼痛" value={form.warmupPain} onChange={v => update("warmupPain", v)} unit="/10" step="1" />
          <SelectField label="心率反应" value={form.warmupHr} onChange={v => update("warmupHr", v as FormState["warmupHr"])} options={[["unknown","未评估"],["normal","正常"],["high","异常偏高"],["low","异常偏低"]]} />
          <SelectField label="动作质量" value={form.movementQuality} onChange={v => update("movementQuality", v as FormState["movementQuality"])} options={[["unknown","未评估"],["normal","正常"],["reduced","下降 / 代偿"]]} />
          <SelectField label="热身后精力" value={form.warmupEnergy} onChange={v => update("warmupEnergy", v as FormState["warmupEnergy"])} options={[["unknown","未评估"],["better","改善"],["same","稳定"],["worse","明显变差"]]} />
        </div>
        <div className="warmup-rules"><p><strong>继续：</strong>心率和动作正常、疼痛稳定、RPE符合预计。</p><p><strong>降档：</strong>RPE高出≥2级、心率异常或精力明显下降。</p><p><strong>终止：</strong>疼痛＞3/10、持续增加或出现明显代偿。</p></div>
        </div>
      </details>

      <details className="advanced-workspace">
        <summary><div><span className="section-kicker">ADVANCED</span><strong>手动输入与计算审计</strong><small>自动识别不完整时再展开</small></div><span>展开</span></summary>
      <section className="workspace-grid">
        <div className="input-column">
          <div className="workspace-heading"><div><span className="section-kicker">INPUT</span><h2>今日数据</h2></div><label className="date-field">起床日<Input type="date" value={form.date} onChange={e => update("date", e.target.value)} /></label></div>
          <InputCard icon={<HeartPulse />} title="恢复指标" subtitle="HRV · 睡眠 · 静息心率">
            <Field label="HRV 今日" value={form.hrv} onChange={v => update("hrv", v)} unit="ms" />
            <Field label="HRV 28日中位基线" value={form.hrvBaseline} onChange={v => update("hrvBaseline", v)} unit="ms" />
            <Field label="HRV 3日前" value={form.hrv3d} onChange={v => update("hrv3d", v)} unit="ms" />
            <Field label="HRV 7日平均" value={form.hrv7avg} onChange={v => update("hrv7avg", v)} unit="ms" />
            <Field label="HRV 7日标准差" value={form.hrv7sd} onChange={v => update("hrv7sd", v)} unit="ms" />
            <Field label="实际睡眠" value={form.sleep} onChange={v => update("sleep", v)} unit="h" />
            <Field label="卧床时间" value={form.timeInBed} onChange={v => update("timeInBed", v)} unit="h" />
            <Field label="近3日平均睡眠" value={form.sleep3avg} onChange={v => update("sleep3avg", v)} unit="h" />
            <Field label="RHR 今日" value={form.rhr} onChange={v => update("rhr", v)} unit="bpm" />
            <Field label="RHR 7日参考" value={form.rhrBaseline} onChange={v => update("rhrBaseline", v)} unit="bpm" />
          </InputCard>
          <InputCard icon={<Gauge />} title="训练负荷" subtitle="ATL · CTL · 趋势">
            <Field label="ATL 今日" value={form.atl} onChange={v => update("atl", v)} /><Field label="CTL 今日" value={form.ctl} onChange={v => update("ctl", v)} />
            <Field label="ATL 昨日" value={form.atlYesterday} onChange={v => update("atlYesterday", v)} /><Field label="ATL 3日前" value={form.atl3d} onChange={v => update("atl3d", v)} />
          </InputCard>
          <InputCard icon={<Dumbbell />} title="结构与局部疲劳" subtitle="近7日 · 48小时">
            <Field label="Monotony 近7日" value={form.monotony} onChange={v => update("monotony", v)} /><Field label="Strain 近7日" value={form.strain} onChange={v => update("strain", v)} />
            <Field label="Density 近7日" value={form.density} onChange={v => update("density", v)} />
            <Field label="Strength Frequency" value={form.strengthFrequency} onChange={v => update("strengthFrequency", v)} /><Field label="7日训练次数" value={form.workoutCount} onChange={v => update("workoutCount", v)} />
            <Field label="7日有氧/专项分钟" value={form.aerobicMinutes7} onChange={v => update("aerobicMinutes7", v)} unit="min" />
            <Field label="36h高强度骑行次数" value={form.hardCycling36} onChange={v => update("hardCycling36", v)} unit="次" step="1" />
            <Field label="48h推正式组" value={form.pushSets48} onChange={v => update("pushSets48", v)} /><Field label="48h拉正式组" value={form.pullSets48} onChange={v => update("pullSets48", v)} /><Field label="48h腿正式组" value={form.legsSets48} onChange={v => update("legsSets48", v)} />
            <Field label="7日推正式组" value={form.pushSets7} onChange={v => update("pushSets7", v)} /><Field label="7日拉正式组" value={form.pullSets7} onChange={v => update("pullSets7", v)} /><Field label="7日腿正式组" value={form.legsSets7} onChange={v => update("legsSets7", v)} />
            <SelectField label="48h推疲劳" value={form.fatiguePush} onChange={v => update("fatiguePush", v as FormState["fatiguePush"])} options={[["unknown","Unknown"],["no","可训练"],["yes","疲劳 / 回避"]]} />
            <SelectField label="48h拉疲劳" value={form.fatiguePull} onChange={v => update("fatiguePull", v as FormState["fatiguePull"])} options={[["unknown","Unknown"],["no","可训练"],["yes","疲劳 / 回避"]]} />
            <SelectField label="48h腿疲劳" value={form.fatigueLegs} onChange={v => update("fatigueLegs", v as FormState["fatigueLegs"])} options={[["unknown","Unknown"],["no","可训练"],["yes","疲劳 / 回避"]]} />
          </InputCard>
          <InputCard icon={<Brain />} title="主观状态与硬规则" subtitle="神经 · 症状 · 疼痛">
            <SelectField label="Neural / CNS" value={form.neural} onChange={v => update("neural", v as FormState["neural"])} options={[["unknown","Unknown"],["normal","Normal"],["limited","Neural Limited"],["fatigue","CNS Fatigue"]]} />
            <SelectField label="疾病症状" value={form.symptoms} onChange={v => update("symptoms", v as FormState["symptoms"])} options={[["unknown","Unknown"],["none","无"],["mild","轻微症状"],["acute","急性 / 明显症状"]]} />
            <Field label="疼痛评分" value={form.pain} onChange={v => update("pain", v)} unit="/10" step="1" />
            <label className="field"><span>疼痛 / 局部不适</span><Input value={form.painArea} onChange={e => update("painArea", e.target.value)} placeholder="如：右肩、左膝" /></label>
            <SelectField wide label="今日候选方向" value={form.preference} onChange={v => update("preference", v as FormState["preference"])} options={[["auto","按规则推荐"],["strength","力量优先"],["push","推力量"],["pull","拉力量"],["legs","腿力量"],["cycling","骑行 / 有氧优先"],["swimming","游泳"],["boxing","拳击"]]} />
          </InputCard>
        </div>

        <aside className="analysis-column">
          <div className="workspace-heading"><div><span className="section-kicker">AUDIT</span><h2>计算明细</h2></div></div>
          <article className="analysis-card"><h3>恢复 Recovery</h3>
            <Metric label="HRV Ratio" value={display(result.hrvRatio, "", 2)} note="今日 ÷ 28日中位基线" /><Metric label="HRV Trend" value={display(result.hrvTrend, "%", 1)} note="相对3日前" />
            <Metric label="HRV Z-score" value={display(result.hrvZ, "", 2)} note="相对7日均值与标准差" /><Metric label="Sleep Efficiency" value={display(result.sleepEfficiency, "%", 1)} note="睡眠 ÷ 卧床" />
            <Metric label="RHR Delta" value={display(result.rhrDelta, " bpm", 1)} note="今日 − 7日参考" /><div className="formula">Recovery = HRV 40% + Sleep 35% + RHR 25%</div>
          </article>
          <article className="analysis-card"><h3>负荷 Load</h3>
            <Metric label="Form" value={display(result.formValue, "", 1)} note="CTL − ATL" /><Metric label="ACWR参考" value={display(result.acwr, "", 2)} note="仅展示，不参与评分" />
            <Metric label="ATL Spike" value={display(result.atlSpike, "%", 1)} note="相对昨日" /><Metric label="Fatigue Momentum" value={display(result.fatigueMomentum, "%", 1)} note="相对3日前" />
            <div className="formula">Load = Form 70% + ATL Spike 30% · Readiness = Recovery 50% + Load 30% + Structure 20%</div>
          </article>
          <article className="analysis-card methodology"><h3>计算口径</h3><p>缺失值不默认正常，也不由其他指标替代；剩余可用权重自动归一化。</p><p>所有原始计算保留完整精度，界面显示保留两位；综合评分显示整数。</p><p>综合分数是基于预设阈值分档的模型估算，不替代医疗诊断。</p></article>
        </aside>
      </section>
      </details>
      <footer><span>HERACLES DAILY · v4.7</span><span>纯前端规则引擎 · 数据仅保存在当前浏览器</span></footer>
    </main>
  );
}

function InputCard({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return <details className="input-card" open><summary>{icon}<div><strong>{title}</strong><span>{subtitle}</span></div></summary><div className="field-grid">{children}</div></details>;
}
function ReportSection({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="report-section"><header><div>{icon}<h2>{title}</h2></div><p>{subtitle}</p></header>{children}</section>;
}
function SelectField({ label, value, onChange, options, wide = false }: { label: string; value: string; onChange: (v:string)=>void; options: string[][]; wide?: boolean }) {
  return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></label>;
}
function ScaleField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div className="scale-field"><span>{label}</span><div role="group" aria-label={`${label} 1到5分`}>{[1,2,3,4,5].map(score => <button key={score} type="button" className={value === String(score) ? "active" : ""} onClick={() => onChange(String(score))} aria-pressed={value === String(score)}>{score}</button>)}</div></div>;
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric-row"><div><strong>{label}</strong><span>{note}</span></div><b>{value}</b></div>;
}
