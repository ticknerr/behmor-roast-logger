import { useState } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  List,
  Modal,
  Tag,
  Rate,
  Space,
  Statistic,
  Typography,
  Segmented,
} from "antd";
import {
  FireOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { lastRoastDate, averageRating, compareText, compareDate } from "../utils/roast";

const { Text } = Typography;

// Natural direction for each sort; the toggle flips it
const SORTS = {
  name:   { label: "Name",          desc: false, ascLabel: "A–Z",          descLabel: "Z–A" },
  date:   { label: "Last roasted",  desc: true,  ascLabel: "Oldest first",  descLabel: "Newest first" },
  rating: { label: "Rating",        desc: true,  ascLabel: "Lowest first",  descLabel: "Highest first" },
};

function sortBeans(beans, mode, desc) {
  return [...beans].sort((a, b) => {
    // Beans with nothing to sort on (never roasted / unrated) always go last
    if (mode === "date") {
      const da = lastRoastDate(a), db = lastRoastDate(b);
      if (!da || !db) return (da ? 0 : 1) - (db ? 0 : 1) || compareText(a.title, b.title);
      const cmp = compareDate(da, db);
      return (desc ? -cmp : cmp) || compareText(a.title, b.title);
    }
    if (mode === "rating") {
      const ra = averageRating(a), rb = averageRating(b);
      if (!ra || !rb) return (ra ? 0 : 1) - (rb ? 0 : 1) || compareText(a.title, b.title);
      const cmp = ra - rb;
      return (desc ? -cmp : cmp) || compareText(a.title, b.title);
    }
    const cmp = compareText(a.title, b.title);
    return desc ? -cmp : cmp;
  });
}

export default function Dashboard({
  data,
  onSelectBean,
  onClearData,
  onEditBean,
  onDeleteBean,
  onNewRoastForBean,
}) {
  const [sortMode, setSortMode] = useState("name");
  const [sortDesc, setSortDesc] = useState(SORTS.name.desc);
  const sortedBeans = sortBeans(data.beans, sortMode, sortDesc);
  const totalBeans = data.beans.length;
  const totalRoasts = data.beans.reduce((a, b) => a + b.roasts.length, 0);
  const allRatings = data.beans
    .flatMap((b) => b.roasts.map((r) => r.rating))
    .filter((r) => r > 0);
  const globalAvgRating =
    allRatings.length
      ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
      : null;

  const confirmClear = () => {
    Modal.confirm({
      title: "Delete ALL data?",
      icon: <ExclamationCircleOutlined />,
      content: "This will permanently wipe all beans and roast logs.",
      okText: "Yes, wipe everything",
      okType: "danger",
      cancelText: "Cancel",
      onOk: onClearData,
    });
  };

  const confirmDeleteBean = (e, bean) => {
    e.stopPropagation();
    Modal.confirm({
      title: `Delete "${bean.title}"?`,
      icon: <ExclamationCircleOutlined />,
      content: `This will permanently remove the bean and all ${bean.roasts.length} roast log${bean.roasts.length !== 1 ? "s" : ""}.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => onDeleteBean(bean.id),
    });
  };

  return (
    <>

      {/* Bean list */}
      <Card
        title="Your Beans"
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
        <List
          dataSource={sortedBeans}
          locale={{ emptyText: "No beans yet — add one from the menu above." }}
          renderItem={(bean) => {
            const lastRoasted = lastRoastDate(bean);
            const avgRating = averageRating(bean);

            return (
              <List.Item
                onClick={() => onSelectBean(bean)}
                style={{ cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#fafafa")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "white")
                }
                actions={[
                  <Button
                    key="roast"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewRoastForBean(bean);
                    }}
                  >
                    Roast
                  </Button>,
                  <Button
                    key="edit"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditBean(bean);
                    }}
                  />,
                  <Button
                    key="delete"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => confirmDeleteBean(e, bean)}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={8} wrap>
                      <strong>{bean.title}</strong>
                      <Tag color="blue">
                        {bean.roasts.length} roast
                        {bean.roasts.length !== 1 ? "s" : ""}
                      </Tag>
                      {avgRating > 0 && (
                        <Rate
                          disabled
                          allowHalf
                          value={avgRating}
                          style={{ fontSize: 12 }}
                        />
                      )}
                    </Space>
                  }
                  description={
                    <Space size={4} split={<Text type="secondary">·</Text>} wrap>
                      {bean.country && <span>{bean.country}</span>}
                      {bean.processing && <span>{bean.processing}</span>}
                      {bean.varietal && <span>{bean.varietal}</span>}
                      {lastRoasted && (
                        <Text type="secondary">
                          Last roasted{" "}
                          {dayjs(lastRoasted).format("D MMM YYYY")}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>
	  
	  {/* Stats row */}
      <Row gutter={16} style={{ marginBottom: 24, marginTop: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Beans" value={totalBeans} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Roasts" value={totalRoasts} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Rating"
              value={globalAvgRating ?? "—"}
              suffix={globalAvgRating ? "/ 5" : ""}
            />
          </Card>
        </Col>
      </Row>
      
      <div style={{ textAlign: "right", marginTop: 20 }}>
        <Button danger icon={<FireOutlined />} onClick={confirmClear}>
          Clear All Data
        </Button>
      </div>
    </>
  );
}
