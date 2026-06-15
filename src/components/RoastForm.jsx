import { useState, useEffect } from "react";
import { Card, Select, Button, Table, DatePicker, InputNumber, Space, Typography, Tooltip } from "antd";
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

const PHASES = [
  "Charge",
  "Drying",
  "Yellowing",
  "Maillard Reaction",
  "First Crack Start",
  "First Crack Rolling",
  "Development",
  "Drop",
];

const POWER = ["100%", "75%", "50%", "25%"];

const COLOUR_LEVELS = [
  "Light",
  "Medium Light",
  "Medium",
  "Medium Dark",
  "Burninated",
  "Incinerated",
];

function formatTime(minutes, seconds) {
  if (minutes == null && seconds == null) return "";
  const m = minutes ?? 0;
  const s = seconds ?? 0;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RoastForm({ beans, preSelectBeanId, onSave, onCancel }) {
  const [beanId, setBeanId] = useState(preSelectBeanId || null);
  const [date, setDate] = useState(dayjs());
  const [batchWeightIn, setBatchWeightIn] = useState(null);
  const [batchWeightOut, setBatchWeightOut] = useState(null);
  const [colourLevel, setColourLevel] = useState(null);
  const [entries, setEntries] = useState([]);

  // Sync pre-selected bean when prop changes (fixes U4)
  useEffect(() => {
    if (preSelectBeanId) setBeanId(preSelectBeanId);
  }, [preSelectBeanId]);

  const addRow = () => {
    setEntries((prev) => [
      ...prev,
      {
        key: Date.now(),
        // Pre-fill time: minute = step number (1, 2, 3…), seconds = 0
        minutes: prev.length + 1,
        seconds: 0,
        phase: null,
        temp: null,
        exhaustTemp: null,
        power: null,
        drum: null,
      },
    ]);
  };

  const updateEntry = (key, field, value) => {
    setEntries((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
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
          ? { ...row, power: prevRow.power, drum: prevRow.drum, phase: prevRow.phase }
          : row
      )
    );
  };

  const handleSave = () => {
    if (!beanId) return;
    const processedEntries = entries.map((row) => ({
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
          max={60}
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
          onChange={(v) => updateEntry(r.key, "phase", v)}
          placeholder="Select phase"
        />
      ),
    },

    // ── Bean Temp ─────────────────────────────────────────────────────────────
    {
      title: "Temp (°C)",
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
          />
        </div>

        <div>
          <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Roast date
          </Text>
          <DatePicker value={date} onChange={setDate} />
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

        {/* Roast steps */}
        <Button
          icon={<PlusOutlined />}
          onClick={addRow}
          style={{ marginTop: 22 }}
        >
          Add Step
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={entries}
        pagination={false}
        size="small"
        style={{ marginBottom: 20 }}
        locale={{ emptyText: "No steps yet — click Add Step." }}
        scroll={{ x: "max-content" }}
      />

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
