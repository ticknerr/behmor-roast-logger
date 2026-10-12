// Shared roast helpers used by the log, the roast form, the all-roasts table
// and the comparison view.
//
// Note on naming: the stored entry field `temp` is the roaster's WALL
// temperature (it was labelled "Bean Temp" in older versions). The field name
// is kept as `temp` so existing data and backups load unchanged.

export const PHASES = [
  "Charge",
  "Drying",
  "Yellowing",
  "Maillard Reaction",
  "First Crack Start",
  "First Crack Rolling",
  "Development",
  "Drop",
];

// Phase colours — progress through the roast journey
export const PHASE_COLORS = {
  "Charge":              "rgba(107, 114, 128, 0.88)", // cool grey
  "Drying":              "rgba(251, 191,  36, 0.88)", // warm yellow
  "Yellowing":           "rgba(245, 158,  11, 0.88)", // amber
  "Maillard Reaction":   "rgba(234,  88,  12, 0.88)", // deep orange
  "First Crack Start":   "rgba(220,  38,  38, 0.88)", // red
  "First Crack Rolling": "rgba(185,  28,  28, 0.88)", // dark red
  "Development":         "rgba(124,  58, 237, 0.88)", // purple
  "Drop":                "rgba( 55,  65,  81, 0.88)", // near-black charcoal
};
export const PHASE_COLOR_FALLBACK = "rgba(156, 163, 175, 0.88)";

// Colour level → Ant Design tag colour (covers old and current level names)
export const COLOUR_TAG = {
  Light: "gold",
  "Medium Light": "orange",
  Medium: "volcano",
  "Medium Dark": "magenta",
  Dark: "red",
  Espresso: "black",
  Burninated: "red",
  Incinerated: "black",
};

// ── Time helpers ──────────────────────────────────────────────────────────────

// Old entries can have null minutes/seconds; null is treated as 0.
export function toSeconds(entry) {
  return (entry.minutes ?? 0) * 60 + (entry.seconds ?? 0);
}

export function fmtTime(totalSeconds) {
  if (totalSeconds == null) return "—";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parsePower(power) {
  if (!power) return null;
  const n = parseInt(power, 10);
  return isNaN(n) ? null : n;
}

export function parseDrum(drum) {
  if (!drum) return null;
  return drum === "fast" ? 1 : 0.5;
}

// ── Roast template ────────────────────────────────────────────────────────────
// Log every minute from 0:00 to 5:00, then every 30 seconds. The template runs
// to 13:00, but you can keep adding steps past that.

export const TEMPLATE_END_SEC = 13 * 60;
export const FINE_INTERVAL_FROM_SEC = 5 * 60;

export function nextStepSeconds(lastSec) {
  if (lastSec == null) return 0;
  return lastSec + (lastSec < FINE_INTERVAL_FROM_SEC ? 60 : 30);
}

export function standardScheduleSeconds() {
  const times = [];
  for (let t = 0; t <= TEMPLATE_END_SEC; t = nextStepSeconds(t)) times.push(t);
  return times;
}

// ── Roast numbering and sorting ───────────────────────────────────────────────

// Roast #1 is the bean's oldest roast. Same-day roasts keep the order they
// were logged in (Array.sort is stable), matching earlier versions.
export function roastNumbers(bean) {
  const chrono = [...(bean.roasts || [])].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  const map = new Map();
  chrono.forEach((r, i) => map.set(r.id, i + 1));
  return map;
}

export function lastRoastDate(bean) {
  const dates = (bean.roasts || []).map((r) => r.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

export function averageRating(bean) {
  const ratings = (bean.roasts || []).map((r) => r.rating).filter((r) => r > 0);
  return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
}

export function compareText(a, b) {
  return (a || "").trim().localeCompare((b || "").trim(), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function compareDate(a, b) {
  return new Date(a || 0) - new Date(b || 0);
}

// ── Roast summary (for the table and comparison) ──────────────────────────────

export function weightLossPct(roast) {
  const { batchWeightIn: wIn, batchWeightOut: wOut } = roast;
  return wIn && wOut && wIn > 0 ? (1 - wOut / wIn) * 100 : null;
}

function firstPhaseSec(sorted, phases) {
  for (const phase of phases) {
    const e = sorted.find((x) => x.phase === phase);
    if (e) return toSeconds(e);
  }
  return null;
}

export function roastSummary(roast) {
  const sorted = [...(roast.entries || [])].sort(
    (a, b) => toSeconds(a) - toSeconds(b)
  );
  const durationSec = sorted.length ? toSeconds(sorted[sorted.length - 1]) : null;
  const firstCrackSec = firstPhaseSec(sorted, ["First Crack Start", "First Crack Rolling"]);
  const dropSec = firstPhaseSec(sorted, ["Drop"]) ?? durationSec;
  const devSec =
    firstCrackSec != null && dropSec != null && dropSec > firstCrackSec
      ? dropSec - firstCrackSec
      : null;
  const walls = sorted.map((e) => e.temp).filter((v) => v != null);
  const exhausts = sorted.map((e) => e.exhaustTemp).filter((v) => v != null);

  return {
    sorted,
    durationSec,
    firstCrackSec,
    dropSec,
    devSec,
    devRatio: devSec != null && dropSec ? (devSec / dropSec) * 100 : null,
    maxWall: walls.length ? Math.max(...walls) : null,
    maxExhaust: exhausts.length ? Math.max(...exhausts) : null,
    weightLoss: weightLossPct(roast),
  };
}

// Every roast across every bean, flattened with its bean and roast number.
export function allRoasts(beans) {
  return beans.flatMap((bean) => {
    const numbers = roastNumbers(bean);
    return (bean.roasts || []).map((roast) => ({
      key: roastKey(bean.id, roast.id),
      bean,
      roast,
      number: numbers.get(roast.id),
    }));
  });
}

export function roastKey(beanId, roastId) {
  return `${beanId}:${roastId}`;
}

export function findRoast(beans, key) {
  if (!key) return null;
  return allRoasts(beans).find((r) => r.key === key) || null;
}
