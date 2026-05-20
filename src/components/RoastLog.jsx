import { useState, useEffect, useRef } from "react";
import {
  Collapse,
  Card,
  Rate,
  Input,
  Tag,
  Space,
  Table,
  Button,
  Modal,
  Typography,
  Divider,
  Empty,
} from "antd";
import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  CoffeeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const { Text } = Typography;

// Colour level → Ant Design tag colour
const COLOUR_TAG = {
  Light: "gold",
  "Medium Light": "orange",
  Medium: "volcano",
  "Medium Dark": "magenta",
  Dark: "red",
  Espresso: "black",
};

// ── Phase colours — progress through the roast journey ────────────────────────
const PHASE_COLORS = {
  "Charge":              "rgba(107, 114, 128, 0.88)", // cool grey
  "Drying":              "rgba(251, 191,  36, 0.88)", // warm yellow
  "Yellowing":           "rgba(245, 158,  11, 0.88)", // amber
  "Maillard Reaction":   "rgba(234,  88,  12, 0.88)", // deep orange
  "First Crack Start":   "rgba(220,  38,  38, 0.88)", // red
  "First Crack Rolling": "rgba(185,  28,  28, 0.88)", // dark red
  "Development":         "rgba(124,  58, 237, 0.88)", // purple
  "Drop":                "rgba( 55,  65,  81, 0.88)", // near-black charcoal
};
const PHASE_COLOR_FALLBACK = "rgba(156, 163, 175, 0.88)";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSeconds(entry) {
  return (entry.minutes ?? 0) * 60 + (entry.seconds ?? 0);
}

function fmtTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parsePower(power) {
  if (!power) return null;
  const n = parseInt(power, 10);
  return isNaN(n) ? null : n;
}

function parseDrum(drum) {
  if (!drum) return null;
  return drum === "fast" ? 1 : 0.5;
}

// ── Roast Profile Chart ───────────────────────────────────────────────────────

function RoastProfileChart({ entries }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !entries || entries.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const sorted = [...entries].sort((a, b) => toSeconds(a) - toSeconds(b));
    const firstSec = toSeconds(sorted[0]);
    const maxSec = toSeconds(sorted[sorted.length - 1]);

    // ── Bean temperature dataset ───────────────────────────────────────────────
    const tempData = [];
    if (firstSec > 0) tempData.push({ x: 0, y: 0 });
    for (const e of sorted) {
      tempData.push({ x: toSeconds(e), y: e.temp ?? null });
    }

    // ── Exhaust temperature dataset ───────────────────────────────────────────
    // Gracefully handles old entries that don't have exhaustTemp at all.
    const exhaustTempData = [];
    if (firstSec > 0) exhaustTempData.push({ x: 0, y: null });
    for (const e of sorted) {
      exhaustTempData.push({ x: toSeconds(e), y: e.exhaustTemp != null ? e.exhaustTemp : null });
    }
    // Only render the exhaust dataset if at least one data point exists
    const hasExhaustTemp = sorted.some((e) => e.exhaustTemp != null);

    // ── Power dataset ─────────────────────────────────────────────────────────
    const powerData = sorted.map((e) => ({
      x: toSeconds(e),
      y: parsePower(e.power),
    }));

    // ── Drum dataset ──────────────────────────────────────────────────────────
    const drumData = [];
    if (firstSec > 0) drumData.push({ x: 0, y: null });
    for (const e of sorted) {
      drumData.push({ x: toSeconds(e), y: parseDrum(e.drum) });
    }

    // ── Phase segments ────────────────────────────────────────────────────────
    const phaseSegments = [];
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      if (!entry.phase) continue;
      const start = toSeconds(entry);
      const end = i < sorted.length - 1 ? toSeconds(sorted[i + 1]) : maxSec;
      if (end <= start) continue;

      const last = phaseSegments[phaseSegments.length - 1];
      if (last && last.phase === entry.phase) {
        last.end = end;
      } else {
        phaseSegments.push({ phase: entry.phase, start, end });
      }
    }

    // Unique phases in order of first appearance (for the legend)
    const seenPhases = new Set();
    const uniquePhases = [];
    for (const seg of phaseSegments) {
      if (!seenPhases.has(seg.phase)) {
        seenPhases.add(seg.phase);
        uniquePhases.push(seg.phase);
      }
    }

    // ── Inline plugin: draws the phase Gantt band ─────────────────────────────
    const phasePlugin = {
      id: "phaseTimeline",
      afterDraw(chart) {
        const { ctx, scales } = chart;
        const xScale = scales.x;
        const yPhaseScale = scales.yPhase;
        if (!xScale || !yPhaseScale || phaseSegments.length === 0) return;

        const top    = yPhaseScale.top;
        const bottom = yPhaseScale.bottom;
        const height = bottom - top;
        const left   = xScale.left;
        const right  = xScale.right;

        ctx.save();

        ctx.beginPath();
        ctx.rect(left, top, right - left, height);
        ctx.clip();

        for (const seg of phaseSegments) {
          const x1   = xScale.getPixelForValue(seg.start);
          const x2   = xScale.getPixelForValue(seg.end);
          const segW = x2 - x1;

          ctx.fillStyle = PHASE_COLORS[seg.phase] ?? PHASE_COLOR_FALLBACK;
          ctx.fillRect(x1, top, segW, height);

          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, top);
          ctx.lineTo(x1, bottom);
          ctx.stroke();

          if (segW > 28) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x1 + 2, top, segW - 4, height);
            ctx.clip();

            const fontSize = Math.min(11, Math.max(8, segW / 8));
            ctx.font        = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle   = "rgba(255,255,255,0.95)";
            ctx.textAlign   = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(seg.phase, x1 + segW / 2, top + height / 2);
            ctx.restore();
          }
        }

        ctx.restore();
      },
    };

    // ── Build datasets — exhaust temp only included when data exists ───────────
    const datasets = [
      // ── Bean Temperature — smooth line ───────────────────────────────────────
      {
        type: "line",
        label: "Bean Temp (°C)",
        data: tempData,
        yAxisID: "yTemp",
        order: 1,
        borderColor: "#cf1322",
        backgroundColor: "rgba(207, 19, 34, 0.10)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "#cf1322",
        spanGaps: false,
      },
    ];

    // Only add the exhaust dataset when this roast actually has exhaust data
    if (hasExhaustTemp) {
      datasets.push({
        type: "line",
        label: "Exhaust (°C)",
        data: exhaustTempData,
        yAxisID: "yTemp",      // shares the same temperature axis
        order: 1,
        borderColor: "#08979c",
        backgroundColor: "rgba(8, 151, 156, 0.08)",
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "#08979c",
        borderDash: [5, 3],   // dashed so it's visually distinct from bean temp
        spanGaps: false,
      });
    }

    datasets.push(
      // ── Power — stepped line ──────────────────────────────────────────────────
      {
        type: "line",
        label: "Power (%)",
        data: powerData,
        yAxisID: "yPower",
        order: 2,
        borderColor: "#fa8c16",
        backgroundColor: "rgba(250, 140, 22, 0.10)",
        fill: true,
        stepped: "before",
        tension: 0,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "#fa8c16",
        spanGaps: true,
      },
      // ── Drum — stepped line ───────────────────────────────────────────────────
      {
        type: "line",
        label: "Drum Speed",
        data: drumData,
        yAxisID: "yDrum",
        order: 2,
        borderColor: "#1677ff",
        backgroundColor: "rgba(22, 119, 255, 0.10)",
        fill: true,
        stepped: "before",
        tension: 0,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "#1677ff",
        spanGaps: true,
      }
    );

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      plugins: [phasePlugin],
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },

        plugins: {
          legend: {
            position: "top",
            labels: {
              usePointStyle: true,
              padding: 16,
              font: { size: 12 },
              generateLabels(chart) {
                const datasetItems =
                  Chart.defaults.plugins.legend.labels.generateLabels(chart);

                const phaseItems = uniquePhases.map((phase) => ({
                  text:        phase,
                  fillStyle:   PHASE_COLORS[phase] ?? PHASE_COLOR_FALLBACK,
                  strokeStyle: PHASE_COLORS[phase] ?? PHASE_COLOR_FALLBACK,
                  lineWidth:   0,
                  pointStyle:  "rect",
                  hidden:      false,
                  datasetIndex: -1,
                }));

                return [...phaseItems, ...datasetItems];
              },
            },
            onClick(e, legendItem, legend) {
              if (legendItem.datasetIndex >= 0) {
                Chart.defaults.plugins.legend.onClick(e, legendItem, legend);
              }
            },
          },

          tooltip: {
            callbacks: {
              title: ([item]) => `⏱ ${fmtTime(item.parsed.x)}`,
              label(item) {
                const lbl = item.dataset.label;
                const v   = item.parsed.y;
                if (lbl === "Drum Speed") {
                  if (v == null) return "  Drum: —";
                  return `  Drum: ${v === 1 ? "Fast (D)" : "Slow (P)"}`;
                }
                if (lbl === "Power (%)") {
                  return v != null ? `  Power: ${v}%` : "  Power: —";
                }
                if (lbl === "Exhaust (°C)") {
                  return v != null ? `  Exhaust: ${v}°C` : "  Exhaust: —";
                }
                // Bean Temp
                return v != null ? `  Bean Temp: ${v}°C` : "  Bean Temp: —";
              },
              afterBody(items) {
                if (items.length === 0) return [];
                const tSec = items[0].parsed.x;
                const activeSeg = phaseSegments.find(
                  (s) => tSec >= s.start && tSec < s.end
                );
                return activeSeg ? [`  Phase: ${activeSeg.phase}`] : [];
              },
            },
          },
        },

        scales: {
          x: {
            type: "linear",
            position: "bottom",
            min: 0,
            max: maxSec + 60,
            title: { display: true, text: "Time (mm:ss)", color: "#888" },
            ticks: {
              callback: (v) => fmtTime(v),
              stepSize: 60,
              maxRotation: 0,
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },

          yTemp: {
            type: "linear",
            position: "left",
            stack: "roastProfile",
            stackWeight: 3,
            title: { display: true, text: "Temp (°C)", color: "#cf1322" },
            min: 0,
            grace: "12%",
            border: { color: "rgba(207,19,34,0.20)" },
            grid:   { color: "rgba(207,19,34,0.07)" },
            ticks:  { color: "#cf1322", stepSize: 20 },
          },

          yGap1: {
            type: "linear", position: "left",
            stack: "roastProfile", stackWeight: 0.4,
            display: true,
            title: { display: false }, ticks: { display: false },
            grid:  { display: false }, border: { display: false },
          },

          yPower: {
            type: "linear",
            position: "left",
            stack: "roastProfile",
            stackWeight: 2,
            title: { display: true, text: "Power (%)", color: "#d46b08" },
            min: 0,
            max: 110,
            clip: false,
            border: { color: "rgba(212,107,8,0.20)" },
            grid:   { color: "rgba(212,107,8,0.07)" },
            ticks: {
              color: "#d46b08",
              stepSize: 25,
              callback: (v) => `${v}%`,
            },
          },

          yGap2: {
            type: "linear", position: "left",
            stack: "roastProfile", stackWeight: 0.4,
            display: true,
            title: { display: false }, ticks: { display: false },
            grid:  { display: false }, border: { display: false },
          },

          yDrum: {
            type: "linear",
            position: "left",
            stack: "roastProfile",
            stackWeight: 1,
            title: { display: true, text: "Drum", color: "#1677ff" },
            min: 0,
            max: 1.5,
            border: { color: "rgba(22,119,255,0.20)" },
            grid:   { color: "rgba(22,119,255,0.07)" },
            ticks: {
              color: "#1677ff",
              stepSize: 0.5,
              callback: (v) => {
                const r = Math.round(v * 10) / 10;
                if (r === 1)   return "Fast";
                if (r === 0.5) return "Slow";
                return "";
              },
            },
          },

          yGap0: {
            type: "linear", position: "left",
            stack: "roastProfile", stackWeight: 0.4,
            display: true,
            title: { display: false }, ticks: { display: false },
            grid:  { display: false }, border: { display: false },
          },

          yPhase: {
            type: "linear",
            position: "left",
            stack: "roastProfile",
            stackWeight: 1.2,
            title: { display: true, text: "Phase", color: "#555" },
            min: 0,
            max: 1,
            ticks:  { display: false },
            grid:   { display: false },
            border: { color: "rgba(0,0,0,0.12)" },
          },
        },
      },
    });

    const resizeTimer = setTimeout(() => {
      if (chartRef.current) chartRef.current.resize();
    }, 350);

    return () => {
      clearTimeout(resizeTimer);
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [entries]);

  if (!entries || entries.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No steps recorded for this roast"
        style={{ marginBottom: 16 }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: 640 }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

// ── Step data table (collapsible under the chart) ─────────────────────────────

function RoastStepsTable({ entries }) {
  if (!entries || entries.length === 0) return null;

  // Only show the Exhaust column if any entry actually has exhaust data
  const hasExhaustTemp = entries.some((e) => e.exhaustTemp != null);

  const columns = [
    {
      title: "Time",
      key: "time",
      width: 68,
      render: (_, r) =>
        r.timeDisplay ||
        `${r.minutes ?? 0}:${String(r.seconds ?? 0).padStart(2, "0")}`,
    },
    {
      title: "Phase",
      dataIndex: "phase",
      key: "phase",
      render: (v) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: "Temp",
      dataIndex: "temp",
      key: "temp",
      width: 80,
      render: (v) =>
        v != null ? (
          <Tag color="volcano">{v}°C</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    // Only render Exhaust column when at least one entry has exhaust data
    ...(hasExhaustTemp
      ? [
          {
            title: "Exhaust",
            dataIndex: "exhaustTemp",
            key: "exhaustTemp",
            width: 90,
            render: (v) =>
              v != null ? (
                <Tag color="cyan">{v}°C</Tag>
              ) : (
                <Text type="secondary">—</Text>
              ),
          },
        ]
      : []),
    {
      title: "Power",
      dataIndex: "power",
      key: "power",
      width: 80,
      render: (v) =>
        v ? <Tag color="orange">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Drum",
      dataIndex: "drum",
      key: "drum",
      width: 90,
      render: (v) =>
        v ? (
          <Tag color="blue">{v === "fast" ? "Fast (D)" : "Slow (P)"}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <Table
      dataSource={entries.map((e) => ({ ...e, key: e.key ?? e.id }))}
      columns={columns}
      pagination={false}
      size="small"
      style={{ marginTop: 8 }}
    />
  );
}

// ── Main RoastLog component ───────────────────────────────────────────────────

export default function RoastLog({
  bean,
  onBack,
  onUpdateRating,
  onAddComment,
  onDeleteRoast,
  onNewRoast,
}) {
  const [sortMode, setSortMode] = useState("date");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [expandedSteps, setExpandedSteps] = useState({});

  const sortedRoasts = [...bean.roasts].sort((a, b) => {
    if (sortMode === "rating") return (b.rating || 0) - (a.rating || 0);
    return new Date(b.date) - new Date(a.date);
  });

  const chronoOrder = [...bean.roasts].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  const roastNumber = (r) =>
    chronoOrder.findIndex((x) => x.id === r.id) + 1;

  const confirmDeleteRoast = (roastId) => {
    Modal.confirm({
      title: "Delete this roast?",
      icon: <ExclamationCircleOutlined />,
      content:
        "This will permanently remove this roast log and all its tasting notes.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => onDeleteRoast(bean.id, roastId),
    });
  };

  const submitComment = (roastId) => {
    const text = (commentDrafts[roastId] || "").trim();
    if (!text) return;
    onAddComment(bean.id, roastId, text);
    setCommentDrafts((prev) => ({ ...prev, [roastId]: "" }));
  };

  const collapseItems = sortedRoasts.map((r) => {
    const num = roastNumber(r);
    const comments = r.comments || [];
    const showSteps = expandedSteps[r.id] || false;

    return {
      key: String(r.id),
      label: (
        <Space size={10} wrap>
          <strong>Roast #{num}</strong>
          <Rate disabled allowHalf value={r.rating || 0} style={{ fontSize: 13 }} />
          <Tag>{r.date}</Tag>
          {r.colourLevel && (
            <Tag color={COLOUR_TAG[r.colourLevel] || "default"}>
              {r.colourLevel}
            </Tag>
          )}
          {r.batchWeightIn != null && <Tag>{r.batchWeightIn}g in</Tag>}
        </Space>
      ),
      children: (
        <Card bordered={false} style={{ padding: 0 }}>

          {/* ── Rating ──────────────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ display: "block", marginBottom: 6 }}>Rating</Text>
            <Rate
              value={r.rating || 0}
              allowClear
              onChange={(val) => onUpdateRating(bean.id, r.id, val)}
            />
          </div>

          {/* ── Batch details ────────────────────────────────────── */}
          {(r.batchWeightIn != null || r.batchWeightOut != null || r.colourLevel) && (
            <Space wrap style={{ marginBottom: 20 }}>
              {r.batchWeightIn  != null && <Tag>In: {r.batchWeightIn}g</Tag>}
              {r.batchWeightOut != null && <Tag>Out: {r.batchWeightOut}g</Tag>}
              {r.batchWeightIn && r.batchWeightOut && r.batchWeightIn > 0 && (
                <Tag color="green">
                  Loss: {((1 - r.batchWeightOut / r.batchWeightIn) * 100).toFixed(1)}%
                </Tag>
              )}
              {r.colourLevel && (
                <Tag color={COLOUR_TAG[r.colourLevel] || "default"}>{r.colourLevel}</Tag>
              )}
            </Space>
          )}

          {/* ── Roast Profile Chart ──────────────────────────────── */}
          <Text strong style={{ display: "block", marginBottom: 12 }}>Roast Profile</Text>
          {/* Pass entries with a safe fallback for old data missing exhaustTemp */}
          <RoastProfileChart
            entries={(r.entries || []).map((e) => ({
              exhaustTemp: null,
              ...e,
            }))}
          />

          <div style={{ marginTop: 10, marginBottom: 4 }}>
            <Button
              type="link"
              size="small"
              style={{ paddingLeft: 0, fontSize: 12 }}
              onClick={() =>
                setExpandedSteps((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
              }
            >
              {showSteps ? "▲ Hide step data" : "▼ Show step data"}
            </Button>
          </div>
          {showSteps && (
            <RoastStepsTable
              entries={(r.entries || []).map((e) => ({
                exhaustTemp: null,
                ...e,
              }))}
            />
          )}

          <Divider />

          {/* ── Tasting notes ────────────────────────────────────── */}
          <div>
            <Text strong style={{ display: "block", marginBottom: 12 }}>Tasting Notes</Text>

            {comments.length === 0 && (
              <Text type="secondary" style={{ display: "block", marginBottom: 12, fontSize: 13 }}>
                No notes yet. Add your first tasting note below.
              </Text>
            )}

            {comments.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--ant-color-bg-layout, #f5f5f5)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  marginBottom: 8,
                  borderLeft: "3px solid var(--ant-color-primary, #1677ff)",
                }}
              >
                <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 3 }}>
                  {dayjs(c.timestamp).format("D MMM YYYY [at] h:mm a")}
                </Text>
                <Text style={{ fontSize: 14 }}>{c.text}</Text>
              </div>
            ))}

            <Space.Compact style={{ width: "100%", marginTop: 12 }}>
              <Input
                placeholder="Add a tasting note…"
                value={commentDrafts[r.id] || ""}
                onChange={(e) =>
                  setCommentDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                }
                onPressEnter={() => submitComment(r.id)}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={() => submitComment(r.id)}>
                Add
              </Button>
            </Space.Compact>
          </div>

          <Divider />

          {/* ── Delete roast ─────────────────────────────────────── */}
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDeleteRoast(r.id)}>
            Delete this roast
          </Button>
        </Card>
      ),
    };
  });

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>All Beans</Button>
        <Button type="primary" icon={<CoffeeOutlined />} onClick={onNewRoast}>New Roast</Button>
      </Space>

      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{bean.title}</Typography.Title>
        <Text type="secondary">
          {[bean.country, bean.processing, bean.varietal].filter(Boolean).join(" · ")}
        </Text>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type={sortMode === "date" ? "primary" : "default"}
          size="small"
          onClick={() => setSortMode("date")}
        >
          Sort by Date
        </Button>
        <Button
          type={sortMode === "rating" ? "primary" : "default"}
          size="small"
          onClick={() => setSortMode("rating")}
        >
          Sort by Rating
        </Button>
      </Space>

      {sortedRoasts.length === 0 ? (
        <Card>
          <Empty description="No roasts logged yet." image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={onNewRoast}>
              Log First Roast
            </Button>
          </Empty>
        </Card>
      ) : (
        <Collapse accordion items={collapseItems} />
      )}
    </div>
  );
}
