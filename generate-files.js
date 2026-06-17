const fs = require('fs');
const path = require('path');

const baseDir = '/Users/mingyuan/workspace/sihuo/wangxtw3/1091/frontend';

const files = {};

files['src/types/index.ts'] = `export interface Patient {
  id: string
  name: string
  gender: 'male' | 'female'
  age: number
  bedNo: string
  department: string
  phone?: string
  idCardNo?: string
}

export interface CheckOrder {
  id: string
  orderNo: string
  patientId: string
  patientName?: string
  checkType: string
  checkItem: string
  checkRoom: string
  appointmentTime: string
  status: 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
  nurseId?: string
  escortId?: string
  priority: 'normal' | 'urgent' | 'emergency'
  remark?: string
  createTime: string
  updateTime: string
}

export interface Nurse {
  id: string
  name: string
  employeeNo: string
  department: string
  phone: string
  status: 'on_duty' | 'off_duty'
}

export interface Escort {
  id: string
  name: string
  employeeNo: string
  phone: string
  status: 'idle' | 'busy' | 'off_duty'
  currentTaskCount?: number
}

export interface CheckRequest {
  patientId: string
  checkType: string
  checkItem: string
  checkRoom: string
  appointmentTime: string
  priority: 'normal' | 'urgent' | 'emergency'
  remark?: string
}

export interface RequestLog {
  id: string
  orderId: string
  action: string
  operatorId: string
  operatorName?: string
  operatorRole: 'nurse' | 'supervisor' | 'escort'
  operateTime: string
  remark?: string
}
`;

files['src/components/Layout.tsx'] = `import { useState } from 'react'
import { Layout as AntLayout, Menu, theme } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  FileAddOutlined,
  AuditOutlined,
  UserOutlined,
  BarChartOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = AntLayout

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const menuItems = [
    {
      key: '/request',
      icon: <FileAddOutlined />,
      label: '护士需求提交',
    },
    {
      key: '/assign',
      icon: <AuditOutlined />,
      label: '主管派单',
    },
    {
      key: '/accept',
      icon: <UserOutlined />,
      label: '陪检员接单',
    },
    {
      key: '/settle',
      icon: <BarChartOutlined />,
      label: '结算统计',
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        <div
          style={{
            height: 64,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 14 : 18,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? '陪检' : '医院陪检管理系统'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0 }}>医院陪检管理系统</h2>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
`;

files['src/pages/RequestPage.tsx'] = `import { useState } from 'react'
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  DatePicker,
  Table,
  Tag,
  Space,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CheckOrder } from '../types'

const { Option } = Select
const { TextArea } = Input

const RequestPage = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<CheckOrder[]>([])

  const columns: ColumnsType<CheckOrder> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
    },
    {
      title: '患者姓名',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 100,
    },
    {
      title: '检查类型',
      dataIndex: 'checkType',
      key: 'checkType',
      width: 120,
    },
    {
      title: '检查项目',
      dataIndex: 'checkItem',
      key: 'checkItem',
    },
    {
      title: '检查科室',
      dataIndex: 'checkRoom',
      key: 'checkRoom',
      width: 120,
    },
    {
      title: '预约时间',
      dataIndex: 'appointmentTime',
      key: 'appointmentTime',
      width: 160,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (value) => {
        const colorMap: Record<string, string> = {
          normal: 'blue',
          urgent: 'orange',
          emergency: 'red',
        }
        const textMap: Record<string, string> = {
          normal: '普通',
          urgent: '加急',
          emergency: '紧急',
        }
        return <Tag color={colorMap[value]}>{textMap[value]}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value) => {
        const colorMap: Record<string, string> = {
          pending: 'default',
          assigned: 'processing',
          accepted: 'blue',
          in_progress: 'orange',
          completed: 'success',
          cancelled: 'error',
        }
        const textMap: Record<string, string> = {
          pending: '待派单',
          assigned: '已派单',
          accepted: '已接单',
          in_progress: '进行中',
          completed: '已完成',
          cancelled: '已取消',
        }
        return <Tag color={colorMap[value]}>{textMap[value]}</Tag>
      },
    },
  ]

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      message.success('需求提交成功')
      form.resetFields()
      setLoading(false)
    } catch (error) {
      setLoading(false)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="提交陪检需求">
        <Form form={form} layout="vertical">
          <Form.Item
            label="患者ID"
            name="patientId"
            rules={[{ required: true, message: '请输入患者ID' }]}
          >
            <Input placeholder="请输入患者ID" />
          </Form.Item>
          <Form.Item
            label="检查类型"
            name="checkType"
            rules={[{ required: true, message: '请选择检查类型' }]}
          >
            <Select placeholder="请选择检查类型">
              <Option value="CT">CT检查</Option>
              <Option value="MRI">核磁共振</Option>
              <Option value="XRAY">X光检查</Option>
              <Option value="B超">B超检查</Option>
              <Option value="心电图">心电图</Option>
              <Option value="化验">化验检查</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="检查项目"
            name="checkItem"
            rules={[{ required: true, message: '请输入检查项目' }]}
          >
            <Input placeholder="请输入检查项目" />
          </Form.Item>
          <Form.Item
            label="检查科室"
            name="checkRoom"
            rules={[{ required: true, message: '请输入检查科室' }]}
          >
            <Input placeholder="请输入检查科室" />
          </Form.Item>
          <Form.Item
            label="预约时间"
            name="appointmentTime"
            rules={[{ required: true, message: '请选择预约时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="优先级"
            name="priority"
            initialValue="normal"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select>
              <Option value="normal">普通</Option>
              <Option value="urgent">加急</Option>
              <Option value="emergency">紧急</Option>
            </Select>
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={loading} onClick={handleSubmit}>
              提交需求
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Card title="我提交的需求">
        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  )
}

export default RequestPage
`;

files['src/pages/AssignPage.tsx'] = `import { useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Select,
  Form,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CheckOrder, Escort } from '../types'

const { Option } = Select

const AssignPage = () => {
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<CheckOrder | null>(null)
  const [form] = Form.useForm()
  const [dataSource, setDataSource] = useState<CheckOrder[]>([])

  const escortList: Escort[] = []

  const columns: ColumnsType<CheckOrder> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
    },
    {
      title: '患者姓名',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 100,
    },
    {
      title: '检查类型',
      dataIndex: 'checkType',
      key: 'checkType',
      width: 120,
    },
    {
      title: '检查项目',
      dataIndex: 'checkItem',
      key: 'checkItem',
    },
    {
      title: '检查科室',
      dataIndex: 'checkRoom',
      key: 'checkRoom',
      width: 120,
    },
    {
      title: '预约时间',
      dataIndex: 'appointmentTime',
      key: 'appointmentTime',
      width: 160,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (value) => {
        const colorMap: Record<string, string> = {
          normal: 'blue',
          urgent: 'orange',
          emergency: 'red',
        }
        const textMap: Record<string, string> = {
          normal: '普通',
          urgent: '加急',
          emergency: '紧急',
        }
        return <Tag color={colorMap[value]}>{textMap[value]}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value) => {
        const colorMap: Record<string, string> = {
          pending: 'default',
          assigned: 'processing',
          accepted: 'blue',
          in_progress: 'orange',
          completed: 'success',
          cancelled: 'error',
        }
        const textMap: Record<string, string> = {
          pending: '待派单',
          assigned: '已派单',
          accepted: '已接单',
          in_progress: '进行中',
          completed: '已完成',
          cancelled: '已取消',
        }
        return <Tag color={colorMap[value]}>{textMap[value]}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleAssign(record)}
            >
              派单
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const handleAssign = (record: CheckOrder) => {
    setSelectedOrder(record)
    setIsModalOpen(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      message.success('派单成功')
      setIsModalOpen(false)
      form.resetFields()
      setLoading(false)
    } catch (error) {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    form.resetFields()
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="待派单列表">
        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
      <Modal
        title="分配陪检员"
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="订单号">
            <span>{selectedOrder?.orderNo}</span>
          </Form.Item>
          <Form.Item label="患者">
            <span>{selectedOrder?.patientName}</span>
          </Form.Item>
          <Form.Item
            label="选择陪检员"
            name="escortId"
            rules={[{ required: true, message: '请选择陪检员' }]}
          >
            <Select placeholder="请选择陪检员">
              {escortList.map((escort) => (
                <Option key={escort.id} value={escort.id}>
                  {escort.name} - {escort.status === 'idle' ? '空闲' : escort.status === 'busy' ? '忙碌' : '休息'}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default AssignPage
`;

files['src/pages/AcceptPage.tsx'] = `import { useState } from 'react'
import { Card, Table, Tag, Button, Space, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CheckOrder } from '../types'

const AcceptPage = () => {
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<CheckOrder[]>([])

  const columns: ColumnsType<CheckOrder> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
    },
    {
      title: '患者姓名',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 100,
    },
    {
      title: '检查类型',
      dataIndex: 'checkType',
      key: 'checkType',
      width: 120,
    },
    {
      title: '检查项目',
      dataIndex: 'checkItem',
      key: 'checkItem',
    },
    {
      title: '检查科室',
      dataIndex: 'checkRoom',
      key: 'checkRoom',
      width: 120,
    },
    {
      title: '预约时间',
      dataIndex: 'appointmentTime',
      key: 'appointmentTime',
      width: 160,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (value) => {
        const colorMap: Record<string, string> = {
          normal: 'blue',
          urgent: 'orange',
          emergency: 'red',
        }
        const textMap: Record<string, string> = {
          normal: '普通',
          urgent: '加急',
          emergency: '紧急',
        }
        return <Tag color={colorMap[value]}>{textMap[value]}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value) => {
        const colorMap: Record<string, string> = {
          pending: 'default',
          assigned: 'processing',
          accepted: 'blue',
          in_progress: 'orange',
          completed: 'success',
          cancelled: 'error',
        }
        const textMap: Record<string, string> = {
          pending: '待派单',
          assigned: '已派单',
          accepted: '已接单',
          in_progress: '进行中',
          completed: '已完成',
          cancelled: '已取消',
        }
        return <Tag color={colorMap[value]}>{textMap[value]}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          {record.status === 'assigned' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleAccept(record)}
            >
              接单
            </Button>
          )}
          {record.status === 'accepted' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleStart(record)}
            >
              开始
            </Button>
          )}
          {record.status === 'in_progress' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleComplete(record)}
            >
              完成
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const handleAccept = (record: CheckOrder) => {
    setLoading(true)
    message.success('接单成功')
    setLoading(false)
  }

  const handleStart = (record: CheckOrder) => {
    setLoading(true)
    message.success('开始陪检')
    setLoading(false)
  }

  const handleComplete = (record: CheckOrder) => {
    setLoading(true)
    message.success('完成陪检')
    setLoading(false)
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="我的任务列表">
        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  )
}

export default AcceptPage
`;

files['src/pages/SettlePage.tsx'] = `import { useState } from 'react'
import {
  Card,
  Table,
  Tag,
  DatePicker,
  Button,
  Space,
  Statistic,
  Row,
  Col,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CheckOrder } from '../types'

const { RangePicker } = DatePicker

const SettlePage = () => {
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<CheckOrder[]>([])

  const columns: ColumnsType<CheckOrder> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
    },
    {
      title: '患者姓名',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 100,
    },
    {
      title: '检查类型',
      dataIndex: 'checkType',
      key: 'checkType',
      width: 120,
    },
    {
      title: '检查项目',
      dataIndex: 'checkItem',
      key: 'checkItem',
    },
    {
      title: '陪检员',
      dataIndex: 'escortId',
      key: 'escortId',
      width: 100,
    },
    {
      title: '完成时间',
      dataIndex: 'updateTime',
      key: 'updateTime',
      width: 160,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (value) => {
        const colorMap: Record<string, string> = {
          normal: 'blue',
          urgent: 'orange',
          emergency: 'red',
        }
        const textMap: Record<string, string> = {
          normal: '普通',
          urgent: '加急',
          emergency: '紧急',
        }
        return <Tag color={colorMap[value]}>{textMap[value]}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value) => {
        const colorMap: Record<string, string> = {
          pending: 'default',
          assigned: 'processing',
          accepted: 'blue',
          in_progress: 'orange',
          completed: 'success',
          cancelled: 'error',
        }
        const textMap: Record<string, string> = {
          pending: '待派单',
          assigned: '已派单',
          accepted: '已接单',
          in_progress: '进行中',
          completed: '已完成',
          cancelled: '已取消',
        }
        return <Tag color={colorMap[value]}>{textMap[value]}</Tag>
      },
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="统计概览">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="今日总单数" value={0} />
          </Col>
          <Col span={6}>
            <Statistic title="已完成" value={0} valueStyle={{ color: '#3f8600' }} />
          </Col>
          <Col span={6}>
            <Statistic title="进行中" value={0} valueStyle={{ color: '#cf1322' }} />
          </Col>
          <Col span={6}>
            <Statistic title="取消单数" value={0} valueStyle={{ color: '#999' }} />
          </Col>
        </Row>
      </Card>
      <Card
        title="结算明细"
        extra={
          <Space>
            <RangePicker />
            <Button type="primary" loading={loading}>
              查询
            </Button>
            <Button loading={loading}>导出</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  )
}

export default SettlePage
`;

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(baseDir, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Created:', filePath);
}

console.log('All files created successfully!');
