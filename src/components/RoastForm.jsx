import { useState, useEffect, useMemo } from "react";
import {
  Card,
  Select,
  Button,
  Table,
  DatePicker,
  InputNumber,
  Space,
  Typography,
  Tooltip,
  Modal,
} from "antd";
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  PHASES,
  toSeconds,
  fmtTime,
  nextStepSeconds,
  standardScheduleSeconds,
  roastNumbers,
} from "../utils/roast";

const { Text } = Typography;

const POWER = ["100%", "75%", "50%", "25%"];

const COLOUR_LEVELS = [
  "Light",
  "Medium Light",
  "Medium",
  "Medium Dark",
  "Burninated",
  "Incinerated",
];

const TEMPLATE_STANDARD = "standard";
const TEMPLATE_BLANK = "blank";

function formatTime(minutes, seconds) {
  if (minutes == null && seconds == null) return "";
  const m = minutes ?? 0;
  const s = seconds ?? 0;
  return `${m}:${String(s).padStart(2, "0")}`;
}

let keySeq = 0;
function makeRow(totalSec, extra = {}) {
  return {
    key: `${Date.now()}-${keySeq++}`,
    minutes: Math.floor(totalSec / 60),
    seconds: totalSec % 60,
    phase: null,
    temp: null, // wall temp (field name kept as `temp` for backward compatibility)
    exhaustTemp: null,
    power: null,
    drum: null,
    // Template rows you never touch are left out when the roast is saved
    prefilled: true,
    ...extra,
  };
}

// Standard schedule: 0:00 (Charge), every minute to 5:00, then every 30 s to 13:00
function standardRows() {
  return standardScheduleSeconds().map((sec) =>
    makeRow(sec, sec === 0 ? { phase: "Charge" } : {})
  );
}

// Re-use a previous roast's timings, phases, power and drum, but not its temps
function rowsFromRoast(roast) {
  const sorted = [...(roast.entries || [])].sort(
    (a, b) => toSeconds(a) - toSeconds(b)
  );
  const rows = sorted.map((e) =>
    makeRow(toSeconds(e), {
      phase: e.phase ?? null,
      power: e.power ?? null,
      drum: e.drum ?? null,
    })
  );
  // Every roast starts at 0:00 so the starting point can be logged
  if (!rows.length || toSeconds(rows[0]) > 0) {
    rows.unshift(makeRow(0, { phase: "Charge" }));
  }
  return rows;
}

const hasReading = (r) => r.temp != null || r.exhaustTemp != null;
const isUnusedTemplateRow = (r) => r.prefilled && !hasReading(r);

export default function RoastForm({ beans, preSelectBeanId, onSave, onCancel }) {
  const [beanId, setBeanId] = useState(preSelectBeanId || null);
  const [date, setDate] = useState(dayjs());
  const [batchWeightIn, setBatchWeightIn] = useState(null);
  const [batchWeightOut, setBatchWeightOut] = useState(null);
  const [colourLevel, setColourLevel] = useState(null);
  const [template, setTemplate] = useState(TEMPLATE_STANDARD);
  const [entries, setEntries] = useState(() => standardRows());

  // Sync pre-selected bean when prop changes (fixes U4)
  useEffect(() => {
    if (preSelectBeanId) setBeanId(preSelectBeanId);
  }, [preSelectBeanId]);

  // ── Template options: standard schedule, blank, or any previous roast ──────
  const templateOptions = useMemo(() => {
    const groups = [
      {
        label: "Templates",
        options: [
          { value: TEMPLATE_STANDARD, label: "Standard: every minute to 5:00, then every 30 s to 13:00" },
          { value: TEMPLATE_BLANK, label: "Blank (no steps)" },
        ],
      },
    ];
    // Previous roasts, the selected bean first, newest roast first
    const ordered = [...beans].sort((a, b) =>
      a.id === beanId ? -1 : b.id === beanId ? 1 : 0
    );
    for (const bean of ordered) {
      if (!bean.roasts?.length) continue;
      const numbers = roastNumbers(bean);
      const roasts = [...bean.roasts].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      groups.push({
        label: `Copy plan from ${bean.title}`,
        options: roasts.map((r) => ({
          value: `roast:${bean.id}:${r.id}`,
          label: `${bean.title} · Roast #${numbers.get(r.id)} · ${dayjs(r.date).format("D MMM YYYY")}${
            r.rating ? ` · ${"★".repeat(Math.round(r.rating))}` : ""
          }`,
        })),
      });
    }
    return groups;
  }, [beans, beanId]);

  const applyTemplate = (value) => {
    const apply = () => {
      setTemplate(value);
      if (value === TEMPLATE_STANDARD) return setEntries(standardRows());
      if (value === TEMPLATE_BLANK) return setEntries([]);
      const [, bId, rId] = value.split(":");
      const bean = beans.find((b) => String(b.id) === bId);
      const roast = bean?.roasts.find((r) => String(r.id) === rId);
      if (!roast) return;
      setEntries(rowsFromRoast(roast));
      if (roast.batchWeightIn != null) setBatchWeightIn(roast.batchWeightIn);
    };

    // Don't silently throw away anything already typed into the step table
    if (entries.some((r) => !isUnusedTemplateRow(r))) {
      Modal.confirm({
        title: "Replace the current steps?",
        content: "What you've entered in the step table will be cleared.",
        okText: "Replace",
        cancelText: "Keep my steps",
        onOk: apply,
      });
    } else {
      apply();
    }
  };

  // New steps follow the same rhythm: +1 min until 5:00, then +30 s
  const addRow = () => {
    setEntries((prev) => {
      const lastSec = prev.length
        ? Math.max(...prev.map((r) => toSeconds(r)))
        : null;
      return [...prev, makeRow(nextStepSeconds(lastSec), { prefilled: false })];
    });
  };

  const updateEntry = (key, field, value) => {
    setEntries((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, [field]: value, prefilled: false } : r
      )
    );
  };

  const removeRow = (key) => {
    setEntries((prev) => prev.filter((r) => r.key !== key));
  };

  // Copy power, drum & phase from the previous row in a single state update
  const copyPreviousRow = (targetKey, prevRow) => {
    setEntries((prev) =>
      prev.map((row) =>
        row.key === targetKey
          ? {
              ...row,
              power: prevRow.power,
              drum: prevRow.drum,
              phase: prevRow.phase,
              prefilled: false,
            }
          : row
      )
    );
  };

  const keptEntries = entries.filter((r) => !isUnusedTemplateRow(r));
  const skippedCount = entries.length - keptEntries.length;

  const handleSave = () => {
    if (!beanId) return;
    const processedEntries = [...keptEntries]
      .sort((a, b) => toSeconds(a) - toSeconds(b))
      .map(({ prefilled, ...row }) => ({
        ...row,
        timeDisplay: formatTime(row.minutes, row.seconds),
      }));
    onSave(beanId, {
      date: date.format("YYYY-MM-DD"),
      batchWeightIn,
      batchWeightOut,
      colourLevel,
      entries: processedEntries,
    });
  };

  const weightLoss =
    batchWeightIn && batchWeightOut && batchWeightIn > 0
      ? ((1 - batchWeightOut / batchWeightIn) * 100).toFixed(1)
      : null;

  const columns = [
    // ── Magic wand: copy previous row's power/drum/phase ──────────────────────
    {
      title: "",
      width: 36,
      render: (_, r, index) => {
        if (index === 0) return null;
        return (
          <Tooltip title="Copy power, drum & phase from the row above">
            <Button
              type="text"
              size="small"
              icon={<ThunderboltOutlined style={{ color: "#722ed1" }} />}
              onClick={() => copyPreviousRow(r.key, entries[index - 1])}
            />
          </Tooltip>
        );
      },
    },

    // ── Time ──────────────────────────────────────────────────────────────────
    {
      title: "Min",
      width: 72,
      render: (_, r) => (
        <InputNumber
          min={0}
          style={{ width: 60 }}
          value={r.minutes}
          onChange={(v) => updateEntry(r.key, "minutes", v)}
          placeholder="0"
        />
      ),
    },
    {
      title: "Sec",
      width: 72,
      render: (_, r) => (
        <InputNumber
          min={0}
          max={59}
          style={{ width: 60 }}
          value={r.seconds}
          onChange={(v) => updateEntry(r.key, "seconds", v)}
          placeholder="0"
        />
      ),
    },

    // ── Phase ─────────────────────────────────────────────────────────────────
    {
      title: "Phase",
      render: (_, r) => (
        <Select
          style={{ width: 190 }}
          value={r.phase}
          options={PHASES.map((p) => ({ label: p, value: p }))}
          onChange={(v) => updateEntry(r.key, "phase", v ?? null)}
          placeholder="Select phase"
          allowClear
        />
      ),
    },

    // ── Wall Temp (stored as `temp`) ──────────────────────────────────────────
    {
      title: "Wall (°C)",
      width: 110,
      render: (_, r) => (
        <InputNumber
          style={{ width: 90 }}
          value={r.temp}
          onChange={(v) => updateEntry(r.key, "temp", v)}
          placeholder="e.g. 180"
        />
      ),
    },

    // ── Exhaust Temp ──────────────────────────────────────────────────────────
    {
      title: "Exhaust (°C)",
      width: 120,
      render: (_, r) => (
        <InputNumber
          style={{ width: 100 }}
          value={r.exhaustTemp}
          onChange={(v) => updateEntry(r.key, "exhaustTemp", v)}
          placeholder="e.g. 160"
        />
      ),
    },

    // ── Power ─────────────────────────────────────────────────────────────────
    {
      title: "Power",
      width: 110,
      render: (_, r) => (
        <Select
          style={{ width: 100 }}
          value={r.power}
          options={POWER.map((p) => ({ label: p, value: p }))}
          onChange={(v) => updateEntry(r.key, "power", v)}
        />
      ),
    },

    // ── Drum ──────────────────────────────────────────────────────────────────
    {
      title: "Drum",
      width: 140,
      render: (_, r) => (
        <Select
          style={{ width: 130 }}
          value={r.drum}
          options={[
            { label: "Fast", value: "fast" },
            { label: "Slow", value: "slow" },
          ]}
          onChange={(v) => updateEntry(r.key, "drum", v)}
        />
      ),
    },

    // ── Delete ────────────────────────────────────────────────────────────────
    {
      title: "",
      width: 40,
      render: (_, r) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeRow(r.key)}
        />
      ),
    },
  ];

  const lastKeptSec = keptEntries.length
    ? Math.max(...keptEntries.map((r) => toSeconds(r)))
    : null;

  return (
    <Card title="New Roast Log">
      {/* Bean + date */}
      <Space wrap style={{ marginBottom: 16 }}>
        <div>
          <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Bean *
          </Text>
          <Select
            placeholder="Select bean"
            style={{ width: 260 }}
            value={beanId}
            onChange={setBeanId}
            options={beans.map((b) => ({ value: b.id, label: b.title }))}
            status={!beanId ? "warning" : ""}
            showSearch
            optionFilterProp="label"
          />
        </div>

        <div>
          <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Roast date
          </Text>
          <DatePicker value={date} onChange={(d) => setDate(d || dayjs())} format="D MMM YYYY" />
        </div>
      </Space>

      {/* Batch details */}
      <Space wrap style={{ marginBottom: 20 }}>
        <div>
          <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Batch weight in
          </Text>
          <InputNumber
            addonAfter="g"
            style={{ width: 160 }}
            value={batchWeightIn}
            onChange={setBatchWeightIn}
            placeholder="e.g. 250"
            min={0}
          />
        </div>

        <div>
          <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Batch weight out
          </Text>
          <InputNumber
            addonAfter="g"
            style={{ width: 160 }}
            value={batchWeightOut}
            onChange={setBatchWeightOut}
            placeholder="e.g. 210"
            min={0}
          />
        </div>

        {weightLoss !== null && (
          <div style={{ paddingTop: 22 }}>
            <Text type="secondary">Weight loss: </Text>
            <Text strong>{weightLoss}%</Text>
          </div>
        )}

        <div>
          <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Colour level
          </Text>
          <Select
            placeholder="Select colour"
            style={{ width: 180 }}
            value={colourLevel}
            onChange={setColourLevel}
            options={COLOUR_LEVELS.map((c) => ({ label: c, value: c }))}
          />
        </div>
      </Space>

      {/* Template */}
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
          Start from
        </Text>
        <Space wrap>
          <Select
            style={{ width: 440, maxWidth: "100%" }}
            value={template}
            onChange={applyTemplate}
            options={templateOptions}
            showSearch
            optionFilterProp="label"
          />
          <Button icon={<PlusOutlined />} onClick={addRow}>
            Add Step
          </Button>
        </Space>
        <Text type="secondary" style={{ display: "block", marginTop: 6, fontSize: 12 }}>
          Copying a previous roast brings across its times, phases, power, drum and batch
          weight in, but not its temperatures. Faded rows are template rows you haven't
          filled in yet; they're left out when you save.
        </Text>
      </div>

      <Table
        columns={columns}
        dataSource={entries}
        pagination={false}
        size="small"
        style={{ marginBottom: 12 }}
        locale={{ emptyText: "No steps yet — click Add Step." }}
        scroll={{ x: "max-content" }}
        onRow={(r) => ({
          style: isUnusedTemplateRow(r) ? { opacity: 0.55 } : undefined,
        })}
      />

      <div style={{ marginBottom: 20 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {keptEntries.length} step{keptEntries.length !== 1 ? "s" : ""} will be saved
          {lastKeptSec != null && `, up to ${fmtTime(lastKeptSec)}`}
          {skippedCount > 0 &&
            ` · ${skippedCount} unused template row${skippedCount !== 1 ? "s" : ""} will be skipped`}
        </Text>
      </div>

      {/* Actions */}
      <Space>
        <Button
          type="primary"
          onClick={handleSave}
          disabled={!beanId}
          title={!beanId ? "Please select a bean first" : ""}
        >
          Save Roast
        </Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
      </Space>

      {!beanId && (
        <div style={{ marginTop: 8 }}>
          <Text type="warning">Please select a bean before saving.</Text>
        </div>
      )}
    </Card>
  );
}
