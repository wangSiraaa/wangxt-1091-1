import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  Tag,
  Space,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../api'
import type { CheckRequest, Patient, Nurse, CheckOrder } from '../types'
import { getStatusInfo, getUrgencyInfo, formatDateTime, formatDuration } from '../utils'

const { TextArea } = Input
const { Option } = Select

const RequestPage = () => {
  const [requests, setRequests] = useState<CheckRequest[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [checkOrders, setCheckOrders] = useState<CheckOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)

  const currentNurseId = nurses[0]?.id || ''

  const fetchData = async () => {
    setLoading(true)
    try {
      const [reqRes, patRes, nurRes] = await Promise.all([
        api.getCheckRequests({ nurseId: currentNurseId || undefined }),
        api.getPatients(),
        api.getNurses(),
      ])
      setRequests(reqRes.data || [])
      setPatients(patRes.data || [])
      setNurses(nurRes.data || [])
    } catch (error: any) {
      message.error(error.message || '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentNurseId])

  const fetchCheckOrders = async (patientId: string) => {
    try {
      const res = await api.getCheckOrders({ patientId, status: 'pending' })
      setCheckOrders(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取检查单失败')
    }
  }

  const handlePatientChange = (patientId: string) => {
    setSelectedPatient(patientId)
    form.setFieldsValue({ check_order_id: undefined, check_type: undefined, check_item: undefined, check_room: undefined })
    if (patientId) {
      fetchCheckOrders(patientId)
    } else {
      setCheckOrders([])
    }
  }

  const handleOrderChange = (orderId: string) => {
    const order = checkOrders.find((o) => o.id === orderId)
    if (order) {
      form.setFieldsValue({
        check_type: order.check_type,
        check_item: order.check_item,
        check_room: order.check_room,
        urgency: order.priority,
      })
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      await api.createCheckRequest({
        ...values,
        nurse_id: currentNurseId,
      })
      message.success('申请提交成功')
      setModalVisible(false)
      form.resetFields()
      setSelectedPatient(null)
      setCheckOrders([])
      fetchData()
    } catch (error: any) {
      message.error(error.message || '提交失败')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.cancelRequest(id, { operator_id: currentNurseId, operator_name: nurses[0]?.name, reason: '护士取消' })
      message.success('取消成功')
      fetchData()
    } catch (error: any) {
      message.error(error.message || '取消失败')
    }
  }

  const columns = [
    {
      title: '患者信息',
      key: 'patient',
      render: (_: any, record: CheckRequest) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.patient?.name}</span>
          <span style={{ fontSize: 12, color: '#999' }}>
            {record.patient?.bed_no} | {record.patient?.ward}
          </span>
          {record.patient?.is_isolated ? (
            <Tag color="red" style={{ marginTop: 4 }}>隔离患者</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: '检查项目',
      key: 'check',
      render: (_: any, record: CheckRequest) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.check_type}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.check_item}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.check_room}</span>
        </Space>
      ),
    },
    {
      title: '紧急程度',
      dataIndex: 'urgency',
      key: 'urgency',
      render: (urgency: string) => {
        const info = getUrgencyInfo(urgency)
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const info = getStatusInfo(status as any)
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '等待时长',
      dataIndex: 'wait_duration',
      key: 'wait_duration',
      render: (duration: number | null) => formatDuration(duration),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '陪检员',
      key: 'escort',
      render: (_: any, record: CheckRequest) => record.escort?.name || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CheckRequest) => {
        const canCancel = ['pending', 'assigned', 'accepted'].includes(record.status)
        return (
          <Space>
            {canCancel && (
              <Popconfirm title="确定取消该申请吗？" onConfirm={() => handleCancel(record.id)}>
                <Button size="small" danger type="link">取消</Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const inProgressCount = requests.filter((r) => ['assigned', 'accepted', 'in_progress'].includes(r.status)).length
  const completedCount = requests.filter((r) => ['completed', 'settled'].includes(r.status)).length

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="待派单" value={pendingCount} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="进行中" value={inProgressCount} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已完成" value={completedCount} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="我的陪检申请"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              提交申请
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={requests}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="提交陪检申请"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
          setSelectedPatient(null)
          setCheckOrders([])
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ urgency: 'normal' }}
        >
          <Form.Item
            name="patient_id"
            label="选择患者"
            rules={[{ required: true, message: '请选择患者' }]}
          >
            <Select
              showSearch
              placeholder="请选择患者"
              optionFilterProp="children"
              onChange={handlePatientChange}
              filterOption={(input, option: any) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {patients.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name} - {p.bed_no} ({p.ward})
                  {p.is_isolated ? ' 【隔离】' : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedPatient && (
            <Form.Item name="check_order_id" label="关联检查单（可选）">
              <Select
                placeholder="选择已开立的检查单"
                allowClear
                onChange={handleOrderChange}
              >
                {checkOrders.map((o) => (
                  <Option key={o.id} value={o.id}>
                    {o.order_no} - {o.check_item}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="check_type"
            label="检查类型"
            rules={[{ required: true, message: '请输入检查类型' }]}
          >
            <Select placeholder="请选择或输入检查类型">
              <Option value="CT">CT</Option>
              <Option value="MRI">MRI</Option>
              <Option value="B超">B超</Option>
              <Option value="X光">X光</Option>
              <Option value="心电图">心电图</Option>
              <Option value="化验">化验</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="check_item"
            label="检查项目"
            rules={[{ required: true, message: '请输入检查项目' }]}
          >
            <Input placeholder="请输入检查项目" />
          </Form.Item>

          <Form.Item name="check_room" label="检查科室">
            <Input placeholder="请输入检查科室/检查室" />
          </Form.Item>

          <Form.Item name="urgency" label="紧急程度">
            <Select>
              <Option value="normal">普通</Option>
              <Option value="urgent">加急</Option>
              <Option value="emergency">紧急</Option>
            </Select>
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RequestPage
