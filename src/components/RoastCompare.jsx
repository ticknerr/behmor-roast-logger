import { useEffect, useRef, useState } from "react";
import {
  Card,
  Select,
  Space,
  Button,
  Table,
  Rate,
  Tag,
  Typography,
  Segmented,
  Empty,
  Row,
  Col,
} from "antd";
import { SwapOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Chart, registerables } from "chart.js";
import {
  COLOUR_TAG,
  allRoasts,
  findRoast,
  roastSummary,
  toSeconds,
  fmtTime,
  parsePower,
  compareDate,
  compareText,
} from "../utils/roast";

Chart.register(...registerables);

const { Text } = Typography;

const SIDE = {
  A: { colour: "#cf1322", fill: "rgba(207, 19, 34, 0.08)", tag: "red" },
  B: { colour: "#1677ff", fill: "rgba(22, 119, 255, 0.08)", tag: "blue" },
};

// Like fmtTime, but handles negative offsets when aligned on first crack
function fmtOffset(sec) {
  if (sec == null) return "—";
  return sec < 0 ? `-${fmtTime(-sec)}` : fmtTime(sec);
}

function roastLabel(item) {
  return `${item.bean.title} · Roast #${item.number} · ${dayjs(item.roast.date).format("D MMM YYYY")}`;
}

// ── Overlay chart ─────────────────────────────────────────────────────────────

function CompareChart({ a, b, align }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const sides = [
      { id: "A", item: a, summary: roastSummary(a.roast) },
      { id: "B", item: b, summary: roastSummary(b.roast) },
    ].map((s) => ({
      ...s,
      offset: align === "fc" ? s.summary.firstCrackSec ?? 0 : 0,
    }));

    const datasets = [];
    for (const s of sides) {
      const { colour, fill } = SIDE[s.id];
      const pts = (key, map = (v) => v) =>
        s.summary.sorted.map((e) => ({ x: toSeconds(e) - s.offset, y: map(e[key]) ?? null }));

      datasets.push({
        label: `${s.id}: Wall Temp (°C)`,
        data: pts("temp"),
        yAxisID: "yTemp",
        borderColor: colour,
        backgroundColor: fill,
        pointBackgroundColor: colour,
        tension: 0.4,
        pointRadius: 3,
        spanGaps: true,
      });
      if (s.summary.sorted.some((e) => e.exhaustTemp != null)) {
        datasets.push({
          label: `${s.id}: Exhaust (°C)`,
          data: pts("exhaustTemp"),
          yAxisID: "yTemp",
          borderColor: colour,
          backgroundColor: colour,
          borderDash: [5, 3],
          borderWidth: 1.5,
          tension: 0.4,
          pointRadius: 2,
          spanGaps: true,
        });
      }
      datasets.push({
        label: `${s.id}: Power (%)`,
        data: pts("power", parsePower),
        yAxisID: "yPower",
        borderColor: colour,
        backgroundColor: fill,
        fill: true,
        stepped: "before",
        pointRadius: 2,
        spanGaps: true,
      });
    }

    // Dashed vertical marker at each roast's first crack
    const fcPlugin = {
      id: "firstCrackMarkers",
      afterDatasetsDraw(chart) {
        const { ctx, scales, chartArea } = chart;
        ctx.save();
        for (const s of sides) {
          if (s.summary.firstCrackSec == null) continue;
          const x = scales.x.getPixelForValue(s.summary.firstCrackSec - s.offset);
          ctx.strokeStyle = SIDE[s.id].colour;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = SIDE[s.id].colour;
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`${s.id} FC`, x + 4, chartArea.top + (s.id === "A" ? 12 : 26));
        }
        ctx.restore();
      },
    };

    const allX = datasets.flatMap((d) => d.data.map((p) => p.x));
    const minX = Math.min(0, ...allX);
    const maxX = Math.max(...allX, 60);

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      plugins: [fcPlugin],
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: {
          legend: { position: "top", labels: { usePointStyle: true, padding: 14 } },
          tooltip: {
            callbacks: {
              title: ([item]) =>
                `⏱ ${fmtOffset(item.parsed.x)}${align === "fc" ? " from first crack" : ""}`,
              label: (item) => {
                const v = item.parsed.y;
                const unit = item.dataset.yAxisID === "yPower" ? "%" : "°C";
                return `  ${item.dataset.label.replace(/ \(.*\)$/, "")}: ${v != null ? `${v}${unit}` : "—"}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            min: Math.floor(minX / 60) * 60,
            max: Math.ceil(maxX / 60) * 60 + 30,
            title: {
              display: true,
              text: align === "fc" ? "Time from first crack (mm:ss)" : "Time (mm:ss)",
              color: "#888",
            },
            ticks: { callback: (v) => fmtOffset(v), stepSize: 60, maxRotation: 0 },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          yTemp: {
            type: "linear",
            position: "left",
            stack: "compare",
            stackWeight: 3,
            title: { display: true, text: "Temp (°C)", color: "#555" },
            grace: "8%",
            ticks: { stepSize: 20 },
          },
          yPower: {
            type: "linear",
            position: "left",
            stack: "compare",
            stackWeight: 1.2,
            offset: true,
            min: 0,
            max: 100,
            title: { display: true, text: "Power (%)", color: "#555" },
            ticks: { stepSize: 25, callback: (v) => `${v}%` },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
    // Rebuild only when the chosen roasts (or their data) actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.key, b.key, a.roast, b.roast, a.bean.title, align]);

  return (
    <div style={{ position: "relative", width: "100%", height: 520 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ── Side-by-side numbers ──────────────────────────────────────────────────────

function diff(va, vb, fmt) {
  if (va == null || vb == null) return "—";
  const d = vb - va;
  if (Math.abs(d) < 1e-9) return "Same";
  return `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}`;
}

function SummaryTable({ a, b }) {
  const sa = roastSummary(a.roast);
  const sb = roastSummary(b.roast);
  const pct = (v) => `${v.toFixed(1)}%`;
  const deg = (v) => `${Math.round(v * 10) / 10}°C`;
  const grams = (v) => `${Math.round(v * 10) / 10}g`;
  const show = (v, fmt) => (v != null ? fmt(v) : "—");

  const rows = [
    {
      metric: "Rating",
      a: <Rate disabled allowHalf value={a.roast.rating || 0} style={{ fontSize: 13 }} />,
      b: <Rate disabled allowHalf value={b.roast.rating || 0} style={{ fontSize: 13 }} />,
      d: diff(a.roast.rating || null, b.roast.rating || null, (v) => `${v}★`),
    },
    {
      metric: "Colour",
      a: a.roast.colourLevel ? <Tag color={COLOUR_TAG[a.roast.colourLevel]}>{a.roast.colourLevel}</Tag> : "—",
      b: b.roast.colourLevel ? <Tag color={COLOUR_TAG[b.roast.colourLevel]}>{b.roast.colourLevel}</Tag> : "—",
      d: "",
    },
    { metric: "Batch in", a: show(a.roast.batchWeightIn, grams), b: show(b.roast.batchWeightIn, grams), d: diff(a.roast.batchWeightIn, b.roast.batchWeightIn, grams) },
    { metric: "Batch out", a: show(a.roast.batchWeightOut, grams), b: show(b.roast.batchWeightOut, grams), d: diff(a.roast.batchWeightOut, b.roast.batchWeightOut, grams) },
    { metric: "Weight loss", a: show(sa.weightLoss, pct), b: show(sb.weightLoss, pct), d: diff(sa.weightLoss, sb.weightLoss, pct) },
    { metric: "First crack", a: fmtTime(sa.firstCrackSec), b: fmtTime(sb.firstCrackSec), d: diff(sa.firstCrackSec, sb.firstCrackSec, fmtTime) },
    { metric: "Drop / total time", a: fmtTime(sa.dropSec), b: fmtTime(sb.dropSec), d: diff(sa.dropSec, sb.dropSec, fmtTime) },
    { metric: "Development time", a: fmtTime(sa.devSec), b: fmtTime(sb.devSec), d: diff(sa.devSec, sb.devSec, fmtTime) },
    { metric: "Development ratio", a: show(sa.devRatio, pct), b: show(sb.devRatio, pct), d: diff(sa.devRatio, sb.devRatio, pct) },
    { metric: "Peak wall temp", a: show(sa.maxWall, deg), b: show(sb.maxWall, deg), d: diff(sa.maxWall, sb.maxWall, deg) },
    { metric: "Peak exhaust", a: show(sa.maxExhaust, deg), b: show(sb.maxExhaust, deg), d: diff(sa.maxExhaust, sb.maxExhaust, deg) },
    { metric: "Steps logged", a: sa.sorted.length, b: sb.sorted.length, d: diff(sa.sorted.length, sb.sorted.length, String) },
  ].map((r) => ({ ...r, key: r.metric }));

  return (
    <Table
      size="small"
      pagination={false}
      dataSource={rows}
      scroll={{ x: "max-content" }}
      columns={[
        { title: "", dataIndex: "metric", key: "metric", render: (v) => <Text strong>{v}</Text> },
        { title: <Tag color={SIDE.A.tag}>A</Tag>, dataIndex: "a", key: "a" },
        { title: <Tag color={SIDE.B.tag}>B</Tag>, dataIndex: "b", key: "b" },
        { title: "B vs A", dataIndex: "d", key: "d", render: (v) => <Text type="secondary">{v}</Text> },
      ]}
    />
  );
}

function Notes({ item, side }) {
  const comments = item.roast.comments || [];
  return (
    <Card
      size="small"
      title={
        <Space>
          <Tag color={SIDE[side].tag}>{side}</Tag>
          <span>Tasting notes</span>
        </Space>
      }
    >
      {comments.length === 0 ? (
        <Text type="secondary">No notes for this roast.</Text>
      ) : (
        comments.map((c) => (
          <div key={c.id} style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
              {dayjs(c.timestamp).format("D MMM YYYY")}
            </Text>
            <Text>{c.text}</Text>
          </div>
        ))
      )}
    </Card>
  );
}

// ── Main compare view ─────────────────────────────────────────────────────────

export default function RoastCompare({ beans, initialA, initialB }) {
  const [keyA, setKeyA] = useState(initialA || null);
  const [keyB, setKeyB] = useState(initialB || null);
  const [align, setAlign] = useState("start");

  useEffect(() => setKeyA(initialA || null), [initialA]);
  useEffect(() => setKeyB(initialB || null), [initialB]);

  // Options grouped by bean (A–Z), newest roast first within each bean
  const items = allRoasts(beans);
  const byBean = new Map();
  for (const it of items) {
    if (!byBean.has(it.bean.id)) byBean.set(it.bean.id, { bean: it.bean, list: [] });
    byBean.get(it.bean.id).list.push(it);
  }
  const options = [...byBean.values()]
    .sort((x, y) => compareText(x.bean.title, y.bean.title))
    .map(({ bean, list }) => ({
      label: bean.title,
      options: list
        .sort((x, y) => compareDate(y.roast.date, x.roast.date))
        .map((it) => ({
          value: it.key,
          label: `${roastLabel(it)}${it.roast.rating ? ` · ${"★".repeat(Math.round(it.roast.rating))}` : ""}`,
        })),
    }));

  const a = findRoast(beans, keyA);
  const b = findRoast(beans, keyB);

  const picker = (side, value, onChange) => (
    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
      <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
        <Tag color={SIDE[side].tag}>{side}</Tag> Roast
      </Text>
      <Select
        style={{ width: "100%" }}
        placeholder="Choose a roast"
        value={value}
        onChange={onChange}
        options={options}
        showSearch
        optionFilterProp="label"
        allowClear
      />
    </div>
  );

  return (
    <Card title="Compare Roasts">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
        {picker("A", keyA, setKeyA)}
        <Button
          icon={<SwapOutlined />}
          onClick={() => {
            setKeyA(keyB);
            setKeyB(keyA);
          }}
          disabled={!keyA && !keyB}
        >
          Swap
        </Button>
        {picker("B", keyB, setKeyB)}
      </div>

      {!a || !b ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Choose two roasts to compare. Tip: you can also tick two roasts in All Roasts."
        />
      ) : (
        <>
          <Space style={{ marginBottom: 12 }} wrap>
            <Text type="secondary">Line up roasts at</Text>
            <Segmented
              size="small"
              value={align}
              onChange={setAlign}
              options={[
                { label: "Start (0:00)", value: "start" },
                { label: "First crack", value: "fc" },
              ]}
            />
          </Space>

          <CompareChart a={a} b={b} align={align} />

          <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
            <Col xs={24} lg={14}>
              <SummaryTable a={a} b={b} />
            </Col>
            <Col xs={24} lg={10}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Notes item={a} side="A" />
                <Notes item={b} side="B" />
              </Space>
            </Col>
          </Row>
        </>
      )}
    </Card>
  );
}
