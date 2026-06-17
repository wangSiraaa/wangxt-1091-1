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
  Descriptions,
  Alert,
  Timeline,
} from 'antd'
import { PlusOutlined, ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { api } from '../api'
import type { CheckRequest, Patient, Nurse, CheckOrder, RescheduleRecord } from '../types'
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
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [rescheduleForm] = Form.useForm()
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<CheckRequest | null>(null)
  const [rescheduleRecords, setRescheduleRecords] = useState<RescheduleRecord[]>([])
  const [rescheduleDetailVisible, setRescheduleDetailVisible] = useState(false)

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

  const handleReschedule = (record: CheckRequest) => {
    setSelectedRequest(record)
    rescheduleForm.resetFields()
    setRescheduleModalVisible(true)
  }

  const handleConfirmReschedule = async (values: any) => {
    if (!selectedRequest) return
    try {
      await api.rescheduleRequest(selectedRequest.id, {
        ...values,
        operator_id: currentNurseId,
        operator_name: nurses[0]?.name,
      })
      message.success('已转待重排')
      setRescheduleModalVisible(false)
      fetchData()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handleViewReschedule = async (record: CheckRequest) => {
    setSelectedRequest(record)
    try {
      const res = await api.getAuditTrail(record.id)
      setRescheduleRecords(res.data?.reschedules || [])
    } catch (error: any) {
      message.error(error.message || '获取重排记录失败')
    }
    setRescheduleDetailVisible(true)
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
      render: (duration: number | null, record: CheckRequest) => {
        const totalDuration = (duration || 0) + (record.rescheduled_wait_duration || 0)
        return (
          <Space direction="vertical" size={0}>
            <span>{formatDuration(totalDuration || null)}</span>
            {record.rescheduled_wait_duration && record.rescheduled_wait_duration > 0 && (
              <span style={{ fontSize: 11, color: '#fa8c16' }}>
                含重排等待 {record.rescheduled_wait_duration}分钟
              </span>
            )}
          </Space>
        )
      },
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
        const canCancel = ['pending', 'assigned', 'accepted', 'to_reschedule'].includes(record.status)
        const canReschedule = ['pending', 'assigned', 'accepted'].includes(record.status)
        const canViewReschedule = record.status === 'to_reschedule' || (record.rescheduled_wait_duration && record.rescheduled_wait_duration > 0)
        return (
          <Space>
            {canViewReschedule && (
              <Button size="small" type="link" onClick={() => handleViewReschedule(record)}>
                重排记录
              </Button>
            )}
            {canReschedule && (
              <Button size="small" type="link" onClick={() => handleReschedule(record)}>
                改时间
              </Button>
            )}
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
  const toRescheduleCount = requests.filter((r) => r.status === 'to_reschedule').length
  const inProgressCount = requests.filter((r) => ['assigned', 'accepted', 'in_progress', 'in_transport'].includes(r.status)).length
  const completedCount = requests.filter((r) => ['completed', 'settled'].includes(r.status)).length

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待派单" value={pendingCount} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待重排" value={toRescheduleCount} valueStyle={{ color: '#fa8c16' }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="进行中" value={inProgressCount} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
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

          <Form.Item name="source_department" label="来源科室">
            <Input placeholder="请输入患者所在科室/病区" />
          </Form.Item>

          <Form.Item name="target_department" label="目标科室">
            <Input placeholder="请输入检查科室" />
          </Form.Item>

          <Form.Item name="check_room" label="检查室">
            <Input placeholder="请输入检查室" />
          </Form.Item>

          <Form.Item name="urgency" label="紧急程度">
            <Select>
              <Option value="normal">普通</Option>
              <Option value="urgent">加急</Option>
              <Option value="emergency">紧急</Option>
            </Select>
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息（如患者行动不便、需要轮椅等）" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改检查时间"
        open={rescheduleModalVisible}
        onOk={() => rescheduleForm.submit()}
        onCancel={() => setRescheduleModalVisible(false)}
        okText="确认转待重排"
        cancelText="取消"
        width={500}
      >
        {selectedRequest && (
          <div>
            <Alert
              message="将检查时间改期后，原申请将转入待重排状态，已等待时长将被保留"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="患者">
                {selectedRequest.patient?.name} ({selectedRequest.patient?.bed_no})
              </Descriptions.Item>
              <Descriptions.Item label="检查项目">
                {selectedRequest.check_type} - {selectedRequest.check_item}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={getStatusInfo(selectedRequest.status).color}>
                  {getStatusInfo(selectedRequest.status).text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="已等待时长">
                {formatDuration(selectedRequest.wait_duration)}
              </Descriptions.Item>
            </Descriptions>
            <Form
              form={rescheduleForm}
              layout="vertical"
              onFinish={handleConfirmReschedule}
            >
              <Form.Item
                name="original_check_time"
                label="原检查时间"
              >
                <Input placeholder="请输入原检查时间" />
              </Form.Item>
              <Form.Item
                name="new_check_time"
                label="新检查时间"
              >
                <Input placeholder="请输入新检查时间" />
              </Form.Item>
              <Form.Item
                name="reason"
                label="重排原因"
                rules={[{ required: true, message: '请填写重排原因' }]}
              >
                <TextArea rows={3} placeholder="请填写重排原因，如：患者身体不适、设备故障等" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="重排记录"
        open={rescheduleDetailVisible}
        onCancel={() => setRescheduleDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setRescheduleDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={500}
      >
        {selectedRequest && (
          <div>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="患者">
                {selectedRequest.patient?.name}
              </Descriptions.Item>
              <Descriptions.Item label="检查项目">
                {selectedRequest.check_type} - {selectedRequest.check_item}
              </Descriptions.Item>
              <Descriptions.Item label="累计等待时长">
                <span style={{ color: '#fa8c16', fontWeight: 500 }}>
                  {formatDuration((selectedRequest.wait_duration || 0) + (selectedRequest.rescheduled_wait_duration || 0) || null)}
                </span>
              </Descriptions.Item>
            </Descriptions>
            {rescheduleRecords.length > 0 ? (
              <Timeline
                items={rescheduleRecords.map((record) => ({
                  color: 'orange',
                  children: (
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        转待重排
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {record.operator_name || record.operator_id} · {formatDateTime(record.created_at)}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        原因：{record.reason}
                      </div>
                      <div style={{ fontSize: 12, color: '#fa8c16', marginTop: 4 }}>
                        本次等待：{record.wait_duration_before}分钟
                      </div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                暂无重排记录
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default RequestPage
