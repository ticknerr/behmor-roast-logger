import { useState, useEffect } from "react";
import { Layout, Menu, Button, Space, Upload, message } from "antd";
import {
  DashboardOutlined,
  CoffeeOutlined,
  FireOutlined,
  ExportOutlined,
  ImportOutlined,
} from "@ant-design/icons";

import { loadData, saveData, exportJSON, importJSON } from "./storage";
import Dashboard from "./components/Dashboard";
import BeanForm from "./components/BeanForm";
import RoastForm from "./components/RoastForm";
import RoastLog from "./components/RoastLog";

const { Header, Content } = Layout;

export default function App() {
  const [data, setData] = useState(() => loadData());
  const [view, setView] = useState("dashboard");
  const [selectedBeanId, setSelectedBeanId] = useState(null);
  const [editingBean, setEditingBean] = useState(null);
  const [preSelectBeanId, setPreSelectBeanId] = useState(null);

  useEffect(() => saveData(data), [data]);

  // Always derive the selected bean live from data so it never goes stale (fixes B1)
  const selectedBean = data.beans.find((b) => b.id === selectedBeanId) || null;

  const updateBeans = (fn) =>
    setData((d) => ({ ...d, beans: fn(d.beans) }));

  // ── Bean mutations ──────────────────────────────────────────────────────────

  const addBean = (values) => {
    updateBeans((beans) => [
      ...beans,
      { ...values, id: Date.now(), roasts: [] },
    ]);
    setView("dashboard");
  };

  const updateBean = (beanId, values) => {
    updateBeans((beans) =>
      beans.map((b) => (b.id === beanId ? { ...b, ...values } : b))
    );
    setEditingBean(null);
    setView("dashboard");
  };

  const deleteBean = (beanId) => {
    updateBeans((beans) => beans.filter((b) => b.id !== beanId));
    if (selectedBeanId === beanId) setSelectedBeanId(null);
    setView("dashboard");
  };

  // ── Roast mutations ─────────────────────────────────────────────────────────

  const addRoast = (beanId, roast) => {
    updateBeans((beans) =>
      beans.map((b) =>
        b.id === beanId
          ? {
              ...b,
              roasts: [
                ...b.roasts,
                { ...roast, id: Date.now(), rating: 0, comments: [] },
              ],
            }
          : b
      )
    );
    setSelectedBeanId(beanId);
    setPreSelectBeanId(null);
    setView("roasts");
  };

  const deleteRoast = (beanId, roastId) => {
    updateBeans((beans) =>
      beans.map((b) =>
        b.id === beanId
          ? { ...b, roasts: b.roasts.filter((r) => r.id !== roastId) }
          : b
      )
    );
  };

  const updateRating = (beanId, roastId, rating) => {
    updateBeans((beans) =>
      beans.map((b) =>
        b.id === beanId
          ? {
              ...b,
              roasts: b.roasts.map((r) =>
                r.id === roastId ? { ...r, rating } : r
              ),
            }
          : b
      )
    );
  };

  const addComment = (beanId, roastId, text) => {
    const comment = {
      id: Date.now(),
      text,
      timestamp: new Date().toISOString(),
    };
    updateBeans((beans) =>
      beans.map((b) =>
        b.id === beanId
          ? {
              ...b,
              roasts: b.roasts.map((r) =>
                r.id === roastId
                  ? { ...r, comments: [...(r.comments || []), comment] }
                  : r
              ),
            }
          : b
      )
    );
  };

  // ── Data management ─────────────────────────────────────────────────────────

  const clearData = () => {
    setData({ version: 2, beans: [] });
    setSelectedBeanId(null);
    setView("dashboard");
  };

  const handleImport = async (file) => {
    try {
      const imported = await importJSON(file);
      setData(imported);
      message.success("Backup imported successfully");
    } catch (e) {
      message.error(e.message);
    }
    return false; // prevent antd's default upload behaviour
  };

  // ── Navigation helpers ──────────────────────────────────────────────────────

  const goToNewRoastForBean = (bean) => {
    setPreSelectBeanId(bean.id);
    setView("newRoast");
  };

  const handleMenuClick = (e) => {
    setView(e.key);
    if (e.key !== "editBean") setEditingBean(null);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingRight: 24,
          paddingLeft: 0,
        }}
      >
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[view]}
          onClick={handleMenuClick}
          style={{ flex: 1 }}
          items={[
            {
              key: "dashboard",
              icon: <DashboardOutlined />,
              label: "Dashboard",
            },
            { key: "newBean", icon: <CoffeeOutlined />, label: "New Bean" },
            { key: "newRoast", icon: <FireOutlined />, label: "New Roast" },
          ]}
        />

        <Space>
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={() => exportJSON(data)}
            style={{
              color: "rgba(255,255,255,0.65)",
              borderColor: "rgba(255,255,255,0.3)",
              background: "transparent",
            }}
          >
            Export
          </Button>
          <Upload accept=".json" showUploadList={false} beforeUpload={handleImport}>
            <Button
              size="small"
              icon={<ImportOutlined />}
              style={{
                color: "rgba(255,255,255,0.65)",
                borderColor: "rgba(255,255,255,0.3)",
                background: "transparent",
              }}
            >
              Import
            </Button>
          </Upload>
        </Space>
      </Header>

      <Layout>
        <Content style={{ padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          {view === "dashboard" && (
            <Dashboard
              data={data}
              onClearData={clearData}
              onSelectBean={(bean) => {
                setSelectedBeanId(bean.id);
                setView("roasts");
              }}
              onEditBean={(bean) => {
                setEditingBean(bean);
                setView("editBean");
              }}
              onDeleteBean={deleteBean}
              onNewRoastForBean={goToNewRoastForBean}
            />
          )}

          {view === "newBean" && (
            <BeanForm
              onSave={addBean}
              onCancel={() => setView("dashboard")}
            />
          )}

          {view === "editBean" && editingBean && (
            <BeanForm
              bean={editingBean}
              onSave={(values) => updateBean(editingBean.id, values)}
              onCancel={() => setView("dashboard")}
            />
          )}

          {view === "newRoast" && (
            <RoastForm
              beans={data.beans}
              preSelectBeanId={preSelectBeanId}
              onSave={addRoast}
              onCancel={() => {
                setPreSelectBeanId(null);
                setView("dashboard");
              }}
            />
          )}

          {view === "roasts" && selectedBean && (
            <RoastLog
              bean={selectedBean}
              onBack={() => setView("dashboard")}
              onUpdateRating={updateRating}
              onAddComment={addComment}
              onDeleteRoast={deleteRoast}
              onNewRoast={() => goToNewRoastForBean(selectedBean)}
            />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
