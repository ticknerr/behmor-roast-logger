import { useEffect } from "react";
import { Form, Input, Button, Card, Space } from "antd";

export default function BeanForm({ bean, onSave, onCancel }) {
  const [form] = Form.useForm();
  const isEdit = !!bean;

  useEffect(() => {
    if (bean) {
      form.setFieldsValue(bean);
    } else {
      form.resetFields();
    }
  }, [bean, form]);

  return (
    <Card title={isEdit ? `Edit: ${bean.title}` : "New Bean"}>
      <Form
        form={form}
        layout="vertical"
        onFinish={onSave}
        style={{ maxWidth: 480 }}
      >
        <Form.Item
          name="title"
          label="Name"
          rules={[{ required: true, message: "Please enter a bean name" }]}
        >
          <Input placeholder="e.g. Yirgacheffe Natural" />
        </Form.Item>

        <Form.Item name="country" label="Country">
          <Input placeholder="e.g. Ethiopia" />
        </Form.Item>

        <Form.Item name="estate" label="Estate / Farm">
          <Input placeholder="e.g. Kochere Station" />
        </Form.Item>

        <Form.Item name="processing" label="Processing">
          <Input placeholder="e.g. Natural, Washed, Honey" />
        </Form.Item>

        <Form.Item name="varietal" label="Varietal">
          <Input placeholder="e.g. Heirloom" />
        </Form.Item>

        <Form.Item name="year" label="Harvest Year">
          <Input placeholder="e.g. 2024" />
        </Form.Item>

        <Form.Item name="supplier" label="Supplier">
          <Input placeholder="e.g. Single Origin Roasters" />
        </Form.Item>

        <Space>
          <Button type="primary" htmlType="submit">
            {isEdit ? "Update Bean" : "Save Bean"}
          </Button>
          {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        </Space>
      </Form>
    </Card>
  );
}
