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
} from "antd";
import {
  FireOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

export default function Dashboard({
  data,
  onSelectBean,
  onClearData,
  onEditBean,
  onDeleteBean,
  onNewRoastForBean,
}) {
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
      <Card title="Your Beans">
        <List
          dataSource={data.beans}
          locale={{ emptyText: "No beans yet — add one from the menu above." }}
          renderItem={(bean) => {
            const sortedByDate = [...bean.roasts].sort(
              (a, b) => new Date(b.date) - new Date(a.date)
            );
            const lastRoast = sortedByDate[0];
            const ratings = bean.roasts.map((r) => r.rating).filter((r) => r > 0);
            const avgRating = ratings.length
              ? ratings.reduce((a, b) => a + b, 0) / ratings.length
              : 0;

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
                      {lastRoast && (
                        <Text type="secondary">
                          Last roasted{" "}
                          {dayjs(lastRoast.date).format("D MMM YYYY")}
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
