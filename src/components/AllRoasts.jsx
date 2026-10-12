import { useState } from "react";
import { Card, Table, Rate, Tag, Space, Segmented, Button, Typography } from "antd";
import { SwapOutlined, SortAscendingOutlined, SortDescendingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  COLOUR_TAG,
  allRoasts,
  roastSummary,
  fmtTime,
  compareText,
  compareDate,
} from "../utils/roast";

const { Text } = Typography;

// Natural direction for each sort; the toggle flips it
const SORTS = {
  date:   { label: "Date",      desc: true,  ascLabel: "Oldest first", descLabel: "Newest first" },
  rating: { label: "Rating",    desc: true,  ascLabel: "Lowest first", descLabel: "Highest first" },
  name:   { label: "Bean name", desc: false, ascLabel: "A–Z",          descLabel: "Z–A" },
};

// Ties always fall back to newest roast first, then bean name
const byDate = (a, b) => compareDate(a.roast.date, b.roast.date) || a.roast.id - b.roast.id;
const SORTERS = {
  date: byDate,
  rating: (a, b) => (a.roast.rating || 0) - (b.roast.rating || 0),
  name: (a, b) => compareText(a.bean.title, b.bean.title),
};

export default function AllRoasts({ beans, onOpenBean, onCompare }) {
  const [sortMode, setSortMode] = useState("date");
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState([]);

  const rows = allRoasts(beans).map((r) => ({ ...r, summary: roastSummary(r.roast) }));
  const sorted = [...rows].sort((a, b) => {
    const cmp = SORTERS[sortMode](a, b);
    if (cmp) return sortDesc ? -cmp : cmp;
    return -byDate(a, b) || compareText(a.bean.title, b.bean.title);
  });

  const columns = [
    {
      title: "Bean",
      key: "bean",
      render: (_, r) => (
        <Button
          type="link"
          style={{ padding: 0, height: "auto", textAlign: "left", whiteSpace: "normal" }}
          onClick={() => onOpenBean(r.bean.id)}
        >
          {r.bean.title}
        </Button>
      ),
    },
    { title: "Roast", key: "num", width: 70, render: (_, r) => `#${r.number}` },
    {
      title: "Date",
      key: "date",
      width: 120,
      render: (_, r) => dayjs(r.roast.date).format("D MMM YYYY"),
    },
    {
      title: "Rating",
      key: "rating",
      width: 150,
      render: (_, r) =>
        r.roast.rating ? (
          <Rate disabled allowHalf value={r.roast.rating} style={{ fontSize: 13 }} />
        ) : (
          <Text type="secondary">Unrated</Text>
        ),
    },
    {
      title: "Colour",
      key: "colour",
      width: 120,
      render: (_, r) =>
        r.roast.colourLevel ? (
          <Tag color={COLOUR_TAG[r.roast.colourLevel] || "default"}>{r.roast.colourLevel}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "First crack",
      key: "fc",
      width: 100,
      render: (_, r) => fmtTime(r.summary.firstCrackSec),
    },
    {
      title: "Total time",
      key: "time",
      width: 100,
      render: (_, r) => fmtTime(r.summary.dropSec),
    },
    {
      title: "Loss",
      key: "loss",
      width: 80,
      render: (_, r) =>
        r.summary.weightLoss != null ? `${r.summary.weightLoss.toFixed(1)}%` : "—",
    },
  ];

  return (
    <Card
      title="All Roasts"
      extra={
        <Space wrap size={8}>
          <Text type="secondary">Sort by</Text>
          <Segmented
            size="small"
            value={sortMode}
            onChange={(v) => {
              setSortMode(v);
              setSortDesc(SORTS[v].desc);
            }}
            options={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }))}
          />
          <Button
            size="small"
            icon={sortDesc ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
            onClick={() => setSortDesc((d) => !d)}
          >
            {sortDesc ? SORTS[sortMode].descLabel : SORTS[sortMode].ascLabel}
          </Button>
        </Space>
      }
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Button
          type="primary"
          icon={<SwapOutlined />}
          disabled={selected.length !== 2}
          onClick={() => onCompare(selected[0], selected[1])}
        >
          Compare selected
        </Button>
        <Text type="secondary">
          {selected.length === 2
            ? "Two roasts selected."
            : `Tick two roasts to compare them (${selected.length} of 2 selected).`}
        </Text>
        {selected.length > 0 && (
          <Button size="small" type="link" onClick={() => setSelected([])}>
            Clear selection
          </Button>
        )}
      </Space>

      <Table
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={sorted}
        pagination={{ pageSize: 25, hideOnSinglePage: true }}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: "No roasts logged yet." }}
        rowSelection={{
          selectedRowKeys: selected,
          hideSelectAll: true,
          onChange: (keys) => setSelected(keys.slice(-2)),
          getCheckboxProps: (r) => ({
            disabled: selected.length >= 2 && !selected.includes(r.key),
          }),
        }}
      />
    </Card>
  );
}
