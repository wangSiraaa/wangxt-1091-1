import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  message,
  Row,
  Col,
  Statistic,
  Descriptions,
  Tabs,
  Timeline,
  InputNumber,
} from 'antd'
import {
  ReloadOutlined,
  DollarOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import type { CheckRequest, StatsSummary, RequestLog, Ward } from '../types'
import {
  getStatusInfo,
  getUrgencyInfo,
  formatDateTime,
  formatDuration,
  getActionText,
} from '../utils'

const { Option } = Select
const { TabPane } = Tabs
const { TextArea } = Input

const SettlePage = () => {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [toSettleRequests, setToSettleRequests] = useState<CheckRequest[]>([])
  const [settledRequests, setSettledRequests] = useState<CheckRequest[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [loading, setLoading] = useState(false)
  const [wardFilter, setWardFilter] = useState<string>('')
  const [activeTab, setActiveTab] = useState<string>('toSettle')

  const [settleModalVisible, setSettleModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<CheckRequest | null>(null)
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([])
  const [form] = Form.useForm()

  const fetchStats = async () => {
    try {
      const res = await api.getStatsSummary()
      setStats(res.data || null)
    } catch (error: any) {
      message.error(error.message || '获取统计数据失败')
    }
  }

  const fetchToSettle = async () => {
    setLoading(true)
    try {
      const params: any = { status: 'completed' }
      if (wardFilter) params.ward = wardFilter
      const res = await api.getCheckRequests(params)
      setToSettleRequests(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchSettled = async () => {
    setLoading(true)
    try {
      const params: any = { status: 'settled' }
      if (wardFilter) params.ward = wardFilter
      const res = await api.getCheckRequests(params)
      setSettledRequests(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchWards = async () => {
    try {
      const res = await api.getWards()
      setWards(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取病区数据失败')
    }
  }

  useEffect(() => {
    fetchStats()
    fetchWards()
  }, [])

  useEffect(() => {
    if (activeTab === 'toSettle') {
      fetchToSettle()
    } else {
      fetchSettled()
    }
  }, [activeTab, wardFilter])

  const handleViewDetail = async (record: CheckRequest) => {
    setSelectedRequest(record)
    try {
      const res = await api.getRequestLogs(record.id)
      setRequestLogs(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取日志失败')
    }
    setDetailModalVisible(true)
  }

  const handleSettle = (record: CheckRequest) => {
    setSelectedRequest(record)
    form.resetFields()
    setSettleModalVisible(true)
  }

  const handleConfirmSettle = async (values: any) => {
    if (!selectedRequest) return
    try {
      await api.settleRequest(selectedRequest.id, {
        operator_id: 'supervisor-001',
        operator_name: '病区主管',
        settlement_amount: values.settlement_amount,
        remark: values.remark,
      })
      message.success('结算成功')
      setSettleModalVisible(false)
      fetchStats()
      if (activeTab === 'toSettle') {
        fetchToSettle()
      } else {
        fetchSettled()
      }
    } catch (error: any) {
      message.error(error.message || '结算失败')
    }
  }

  const commonColumns = [
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
      title: '陪检员',
      key: 'escort',
      render: (_: any, record: CheckRequest) => {
        if (record.escort) {
          return (
            <Space direction="vertical" size={0}>
              <span>{record.escort.name}</span>
              {record.escort.is_specialist ? (
                <Tag color="purple" style={{ fontSize: 11 }}>专人</Tag>
              ) : null}
            </Space>
          )
        }
        return '-'
      },
    },
    {
      title: '等待时长',
      dataIndex: 'wait_duration',
      key: 'wait_duration',
      render: (duration: number | null) => formatDuration(duration),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      render: (time: string) => formatDateTime(time),
    },
  ]

  const toSettleColumns = [
    ...commonColumns,
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CheckRequest) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<DollarOutlined />}
            onClick={() => handleSettle(record)}
          >
            结算
          </Button>
        </Space>
      ),
    },
  ]

  const settledColumns = [
    ...commonColumns,
    {
      title: '结算金额',
      dataIndex: 'settlement_amount',
      key: 'settlement_amount',
      render: (amount: number | undefined) => {
        if (amount === undefined || amount === null) return '-'
        return `¥${amount.toFixed(2)}`
      },
    },
    {
      title: '结算时间',
      dataIndex: 'settled_at',
      key: 'settled_at',
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CheckRequest) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ]

  const totalSettleAmount = settledRequests.reduce((sum, r) => sum + (r.settlement_amount || 0), 0)

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待结算"
              value={stats?.completed_count || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已结算"
              value={stats?.settled_count || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均等待时长"
              value={stats?.avg_wait_duration || 0}
              suffix="分钟"
              valueStyle={{ color: '#1890ff' }}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日完成"
              value={stats?.today_completed || 0}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="结算管理"
        extra={
          <Space>
            <Select
              placeholder="病区筛选"
              style={{ width: 160 }}
              value={wardFilter || undefined}
              onChange={(val) => setWardFilter(val || '')}
              allowClear
            >
              {wards.map((w) => (
                <Option key={w.id} value={w.name}>
                  {w.name}
                </Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => {
              fetchStats()
              if (activeTab === 'toSettle') {
                fetchToSettle()
              } else {
                fetchSettled()
              }
            }}>
              刷新
            </Button>
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={`待结算 (${toSettleRequests.length})`} key="toSettle">
            <Table
              rowKey="id"
              columns={toSettleColumns}
              dataSource={toSettleRequests}
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab={`已结算 (${settledRequests.length})`} key="settled">
            {settledRequests.length > 0 && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <span style={{ color: '#666' }}>结算总金额：</span>
                <span style={{ color: '#f5222d', fontSize: 18, fontWeight: 'bold', marginLeft: 8 }}>
                  ¥{totalSettleAmount.toFixed(2)}
                </span>
              </Card>
            )}
            <Table
              rowKey="id"
              columns={settledColumns}
              dataSource={settledRequests}
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="结算"
        open={settleModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setSettleModalVisible(false)}
        okText="确认结算"
        cancelText="取消"
        width={500}
      >
        {selectedRequest && (
          <div>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="患者">
                {selectedRequest.patient?.name} ({selectedRequest.patient?.bed_no})
              </Descriptions.Item>
              <Descriptions.Item label="检查项目">
                {selectedRequest.check_type} - {selectedRequest.check_item}
              </Descriptions.Item>
              <Descriptions.Item label="陪检员">
                {selectedRequest.escort?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {formatDateTime(selectedRequest.completed_at)}
              </Descriptions.Item>
              <Descriptions.Item label="等待时长">
                {formatDuration(selectedRequest.wait_duration)}
              </Descriptions.Item>
            </Descriptions>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleConfirmSettle}
            >
              <Form.Item
                name="settlement_amount"
                label="结算金额（元）"
                rules={[
                  { required: true, message: '请输入结算金额' },
                  { type: 'number', min: 0, message: '金额不能为负数' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入结算金额"
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="¥"
                />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <TextArea rows={3} placeholder="请输入备注信息" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="申请详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedRequest && (
          <Tabs defaultActiveKey="info">
            <TabPane tab="基本信息" key="info">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="状态">
                  <Tag color={getStatusInfo(selectedRequest.status).color}>
                    {getStatusInfo(selectedRequest.status).text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="患者">
                  {selectedRequest.patient?.name}
                </Descriptions.Item>
                <Descriptions.Item label="床号">
                  {selectedRequest.patient?.bed_no}
                </Descriptions.Item>
                <Descriptions.Item label="病区">
                  {selectedRequest.patient?.ward}
                </Descriptions.Item>
                <Descriptions.Item label="是否隔离">
                  {selectedRequest.patient?.is_isolated ? '是' : '否'}
                </Descriptions.Item>
                <Descriptions.Item label="检查类型">
                  {selectedRequest.check_type}
                </Descriptions.Item>
                <Descriptions.Item label="检查项目">
                  {selectedRequest.check_item}
                </Descriptions.Item>
                <Descriptions.Item label="检查科室">
                  {selectedRequest.check_room}
                </Descriptions.Item>
                <Descriptions.Item label="紧急程度">
                  <Tag color={getUrgencyInfo(selectedRequest.urgency).color}>
                    {getUrgencyInfo(selectedRequest.urgency).text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="提交护士">
                  {selectedRequest.nurse?.name}
                </Descriptions.Item>
                <Descriptions.Item label="陪检员">
                  {selectedRequest.escort?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="等待时长">
                  {formatDuration(selectedRequest.wait_duration)}
                </Descriptions.Item>
                <Descriptions.Item label="结算金额">
                  {selectedRequest.settlement_amount !== undefined
                    ? `¥${selectedRequest.settlement_amount.toFixed(2)}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="提交时间">
                  {formatDateTime(selectedRequest.created_at)}
                </Descriptions.Item>
                <Descriptions.Item label="派单时间">
                  {formatDateTime(selectedRequest.assigned_at)}
                </Descriptions.Item>
                <Descriptions.Item label="接单时间">
                  {formatDateTime(selectedRequest.accepted_at)}
                </Descriptions.Item>
                <Descriptions.Item label="开始时间">
                  {formatDateTime(selectedRequest.started_at)}
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {formatDateTime(selectedRequest.completed_at)}
                </Descriptions.Item>
                <Descriptions.Item label="结算时间">
                  {formatDateTime(selectedRequest.settled_at)}
                </Descriptions.Item>
                <Descriptions.Item label="备注">
                  {selectedRequest.remark || '-'}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>
            <TabPane tab="操作日志" key="logs">
              <Timeline
                items={requestLogs.map((log) => ({
                  color: 'blue',
                  children: (
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {getActionText(log.action)}
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {log.operator_name || log.operator_id} · {formatDateTime(log.created_at)}
                      </div>
                      {log.remark && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {log.remark}
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            </TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  )
}

export default SettlePage
