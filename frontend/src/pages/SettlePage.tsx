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
  Alert,
  List,
  Badge,
  Steps,
  Checkbox,
} from 'antd'
import {
  ReloadOutlined,
  DollarOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  ExclamationCircleOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import type {
  CheckRequest,
  StatsSummary,
  RequestLog,
  Ward,
  SettlementValidation,
  AuditTrail,
  Transport,
  ShiftChange,
  RescheduleRecord,
} from '../types'
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
  const [settlementValidation, setSettlementValidation] = useState<SettlementValidation | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [forceSettle, setForceSettle] = useState(false)
  const [auditTrail, setAuditTrail] = useState<AuditTrail | null>(null)
  const [detailTabKey, setDetailTabKey] = useState('info')

  const fetchSettlementValidation = async (requestId: string) => {
    setValidationLoading(true)
    try {
      const res = await api.validateSettlement(requestId)
      setSettlementValidation(res.data || null)
    } catch (error: any) {
      message.error(error.message || '获取结算校验信息失败')
    } finally {
      setValidationLoading(false)
    }
  }

  const fetchAuditTrail = async (requestId: string) => {
    try {
      const res = await api.getAuditTrail(requestId)
      setAuditTrail(res.data || null)
    } catch (error: any) {
      message.error(error.message || '获取审计链信息失败')
    }
  }

  useEffect(() => {
    if (settleModalVisible && selectedRequest) {
      fetchSettlementValidation(selectedRequest.id)
    }
  }, [settleModalVisible])

  useEffect(() => {
    if (detailModalVisible && selectedRequest) {
      if (detailTabKey === 'audit') {
        fetchAuditTrail(selectedRequest.id)
      }
    }
  }, [detailTabKey, detailModalVisible])

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
    setSettlementValidation(null)
    setForceSettle(false)
    setSettleModalVisible(true)
  }

  const handleConfirmSettle = async (values: any) => {
    if (!selectedRequest) return

    if (settlementValidation && !settlementValidation.can_settle && !forceSettle) {
      message.warning('存在未通过的校验项，请确认后勾选"强制结算"')
      return
    }

    try {
      await api.settleRequest(selectedRequest.id, {
        operator_id: 'supervisor-001',
        operator_name: '病区主管',
        settlement_amount: values.settlement_amount,
        remark: values.remark,
        force_settle: forceSettle,
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
          {record.source_department && record.target_department && (
            <span style={{ fontSize: 12, color: '#1890ff' }}>
              <EnvironmentOutlined /> {record.source_department} → {record.target_department}
            </span>
          )}
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
      title: '标记',
      key: 'flags',
      width: 120,
      render: (_: any, record: CheckRequest) => {
        const flags = []
        if (record.is_cross_department) flags.push(<Tag key="cross" color="geekblue" style={{ fontSize: 10 }}>跨科室</Tag>)
        if (record.has_overtime_wait) flags.push(<Tag key="overtime" color="red" style={{ fontSize: 10 }}>超时</Tag>)
        if (record.has_shift_change) flags.push(<Tag key="shift" color="purple" style={{ fontSize: 10 }}>替班</Tag>)
        if (flags.length === 0) return <span style={{ color: '#ccc' }}>-</span>
        return <Space wrap>{flags}</Space>
      },
    },
    {
      title: '等待时长',
      dataIndex: 'wait_duration',
      key: 'wait_duration',
      render: (duration: number | null, record: CheckRequest) => {
        const total = (duration || 0) + (record.rescheduled_wait_duration || 0)
        return (
          <Space direction="vertical" size={0}>
            <span>{formatDuration(total || null)}</span>
            {record.rescheduled_wait_duration && record.rescheduled_wait_duration > 0 && (
              <span style={{ fontSize: 11, color: '#fa8c16' }}>
                含重排 {record.rescheduled_wait_duration}分钟
              </span>
            )}
          </Space>
        )
      },
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
        width={600}
      >
        {selectedRequest && (
          <div>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="患者">
                {selectedRequest.patient?.name} ({selectedRequest.patient?.bed_no})
              </Descriptions.Item>
              <Descriptions.Item label="紧急程度">
                <Tag color={getUrgencyInfo(selectedRequest.urgency).color}>
                  {getUrgencyInfo(selectedRequest.urgency).text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检查项目">
                {selectedRequest.check_type} - {selectedRequest.check_item}
              </Descriptions.Item>
              <Descriptions.Item label="陪检员">
                {selectedRequest.escort?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="转运路线">
                {selectedRequest.source_department && selectedRequest.target_department
                  ? `${selectedRequest.source_department} → ${selectedRequest.target_department}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {formatDateTime(selectedRequest.completed_at)}
              </Descriptions.Item>
              <Descriptions.Item label="等待时长">
                {formatDuration((selectedRequest.wait_duration || 0) + (selectedRequest.rescheduled_wait_duration || 0) || null)}
              </Descriptions.Item>
              <Descriptions.Item label="特殊标记">
                <Space wrap>
                  {selectedRequest.is_cross_department && <Tag color="geekblue">跨科室</Tag>}
                  {selectedRequest.has_overtime_wait && <Tag color="red">超时</Tag>}
                  {selectedRequest.has_shift_change && <Tag color="purple">替班</Tag>}
                  {!selectedRequest.is_cross_department && !selectedRequest.has_overtime_wait && !selectedRequest.has_shift_change && '-'}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {validationLoading ? (
              <Card size="small" loading={validationLoading}>
                正在校验结算条件...
              </Card>
            ) : settlementValidation && (
              <Card
                size="small"
                style={{ marginBottom: 16 }}
                title={
                  <Space>
                    <SafetyOutlined style={{ color: settlementValidation.can_settle ? '#52c41a' : '#faad14' }} />
                    结算前校验
                    {settlementValidation.can_settle ? (
                      <Tag color="success">全部通过</Tag>
                    ) : (
                      <Tag color="warning">存在异常</Tag>
                    )}
                  </Space>
                }
              >
                <List
                  size="small"
                  dataSource={[
                    {
                      key: 'cross_department',
                      icon: <EnvironmentOutlined />,
                      label: '跨科室转运记录',
                      passed: settlementValidation.cross_department_passed,
                      detail: settlementValidation.cross_department_detail,
                    },
                    {
                      key: 'overtime_wait',
                      icon: <ThunderboltOutlined />,
                      label: '超时等候',
                      passed: settlementValidation.overtime_wait_passed,
                      detail: settlementValidation.overtime_wait_detail,
                    },
                    {
                      key: 'shift_change',
                      icon: <SwapOutlined />,
                      label: '替班交接',
                      passed: settlementValidation.shift_change_passed,
                      detail: settlementValidation.shift_change_detail,
                    },
                  ]}
                  renderItem={(item) => (
                    <List.Item
                      key={item.key}
                      style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          {item.icon}
                          <span>{item.label}</span>
                        </Space>
                        <Space>
                          <span style={{ color: item.passed ? '#52c41a' : '#faad14', fontSize: 12 }}>
                            {item.detail}
                          </span>
                          <Badge
                            status={item.passed ? 'success' : 'warning'}
                            text={item.passed ? '通过' : '注意'}
                          />
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
                {!settlementValidation.can_settle && (
                  <Alert
                    style={{ marginTop: 12 }}
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    message="存在未通过的校验项，结算后需人工复核"
                  />
                )}
              </Card>
            )}

            {settlementValidation && !settlementValidation.can_settle && (
              <Checkbox
                checked={forceSettle}
                onChange={(e) => setForceSettle(e.target.checked)}
                style={{ marginBottom: 16 }}
              >
                我已确认以上异常情况，同意强制结算
              </Checkbox>
            )}

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
        width={700}
      >
        {selectedRequest && (
          <Tabs activeKey={detailTabKey} onChange={setDetailTabKey}>
            <TabPane tab="基本信息" key="info">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="状态">
                  <Tag color={getStatusInfo(selectedRequest.status).color}>
                    {getStatusInfo(selectedRequest.status).text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="紧急程度">
                  <Tag color={getUrgencyInfo(selectedRequest.urgency).color}>
                    {getUrgencyInfo(selectedRequest.urgency).text}
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
                <Descriptions.Item label="来源科室">
                  {selectedRequest.source_department || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="目标科室">
                  {selectedRequest.target_department || '-'}
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
                <Descriptions.Item label="提交护士">
                  {selectedRequest.nurse?.name}
                </Descriptions.Item>
                <Descriptions.Item label="陪检员">
                  {selectedRequest.escort?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="特殊标记">
                  <Space wrap>
                    {selectedRequest.is_cross_department && <Tag color="geekblue">跨科室</Tag>}
                    {selectedRequest.has_overtime_wait && <Tag color="red">超时</Tag>}
                    {selectedRequest.has_shift_change && <Tag color="purple">替班</Tag>}
                    {!selectedRequest.is_cross_department && !selectedRequest.has_overtime_wait && !selectedRequest.has_shift_change && '-'}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="等待时长">
                  <Space direction="vertical" size={0}>
                    <span>{formatDuration((selectedRequest.wait_duration || 0) + (selectedRequest.rescheduled_wait_duration || 0) || null)}</span>
                    {selectedRequest.rescheduled_wait_duration && selectedRequest.rescheduled_wait_duration > 0 && (
                      <span style={{ fontSize: 11, color: '#fa8c16' }}>
                        含重排等待 {selectedRequest.rescheduled_wait_duration}分钟
                      </span>
                    )}
                  </Space>
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
                <Descriptions.Item label="转运开始">
                  {formatDateTime(selectedRequest.transport_started_at)}
                </Descriptions.Item>
                <Descriptions.Item label="转运完成">
                  {formatDateTime(selectedRequest.transport_completed_at)}
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {formatDateTime(selectedRequest.completed_at)}
                </Descriptions.Item>
                <Descriptions.Item label="结算时间">
                  {formatDateTime(selectedRequest.settled_at)}
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>
                  {selectedRequest.remark || '-'}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>

            <TabPane tab="审计链" key="audit">
              {auditTrail ? (
                <div>
                  <Card size="small" style={{ marginBottom: 16 }} title="流程总览">
                    <Steps
                      direction="vertical"
                      size="small"
                      current={100}
                      items={[
                        {
                          title: '需求提交',
                          description: auditTrail.request
                            ? `${formatDateTime(auditTrail.request.created_at)} · ${auditTrail.request.nurse_name || '护士'}`
                            : '-',
                          status: auditTrail.request ? 'finish' : 'wait',
                        },
                        {
                          title: '智能派单',
                          description: auditTrail.suggestion
                            ? `推荐: ${auditTrail.suggestion.escort_name} (${auditTrail.suggestion.final_score.toFixed(1)}分) · ${auditTrail.suggestion.operator_name}`
                            : auditTrail.assignment
                            ? `${formatDateTime(auditTrail.assignment.created_at)} · ${auditTrail.assignment.operator_name}`
                            : '-',
                          status: auditTrail.assignment ? 'finish' : 'wait',
                        },
                        {
                          title: '接单执行',
                          description: auditTrail.acceptance
                            ? `${formatDateTime(auditTrail.acceptance.created_at)} · ${auditTrail.acceptance.escort_name}`
                            : '-',
                          status: auditTrail.acceptance ? 'finish' : 'wait',
                        },
                        {
                          title: '转运',
                          description: auditTrail.transports && auditTrail.transports.length > 0
                            ? `${auditTrail.transports.length}次转运 · 累计${auditTrail.transports.reduce((s, t) => s + (t.duration_minutes || 0), 0)}分钟`
                            : '无转运记录',
                          status: (auditTrail.transports && auditTrail.transports.length > 0)
                            ? (auditTrail.transports.every(t => t.status === 'completed') ? 'finish' : 'process')
                            : 'wait',
                        },
                        {
                          title: '完成',
                          description: auditTrail.completion
                            ? `${formatDateTime(auditTrail.completion.created_at)} · ${auditTrail.completion.operator_name}`
                            : '-',
                          status: auditTrail.completion ? 'finish' : 'wait',
                        },
                        {
                          title: '结算',
                          description: auditTrail.settlement
                            ? `${formatDateTime(auditTrail.settlement.created_at)} · ${auditTrail.settlement.operator_name} · ¥${auditTrail.settlement.settlement_amount?.toFixed(2) || '0.00'}`
                            : '待结算',
                          status: auditTrail.settlement ? 'finish' : 'wait',
                        },
                      ]}
                    />
                  </Card>

                  {auditTrail.suggestion && (
                    <Card size="small" style={{ marginBottom: 16 }} title="派单建议">
                      <Descriptions column={2} size="small">
                        <Descriptions.Item label="推荐陪检员">{auditTrail.suggestion.escort_name}</Descriptions.Item>
                        <Descriptions.Item label="综合评分">{auditTrail.suggestion.final_score.toFixed(1)}分</Descriptions.Item>
                        <Descriptions.Item label="距离评分">{auditTrail.suggestion.distance_score.toFixed(1)}</Descriptions.Item>
                        <Descriptions.Item label="负载评分">{auditTrail.suggestion.load_score.toFixed(1)}</Descriptions.Item>
                        <Descriptions.Item label="技能评分">{auditTrail.suggestion.skill_score.toFixed(1)}</Descriptions.Item>
                        <Descriptions.Item label="优先级评分">{auditTrail.suggestion.priority_score.toFixed(1)}</Descriptions.Item>
                        <Descriptions.Item label="操作人" span={2}>{auditTrail.suggestion.operator_name}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  )}

                  {auditTrail.transports && auditTrail.transports.length > 0 && (
                    <Card size="small" style={{ marginBottom: 16 }} title={`转运记录 (${auditTrail.transports.length}次)`}>
                      <List
                        size="small"
                        dataSource={auditTrail.transports}
                        renderItem={(transport: Transport, idx: number) => (
                          <List.Item key={transport.id}>
                            <Space direction="vertical" size={0} style={{ width: '100%' }}>
                              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 500 }}>
                                  转运 #{idx + 1} - {transport.from_department} → {transport.to_department}
                                </span>
                                <Tag color={transport.status === 'completed' ? 'success' : transport.status === 'in_progress' ? 'processing' : 'default'}>
                                  {transport.status === 'completed' ? '已完成' : transport.status === 'in_progress' ? '进行中' : '待开始'}
                                </Tag>
                              </Space>
                              <span style={{ fontSize: 12, color: '#999' }}>
                                陪检员: {transport.escort_name} · 耗时: {transport.duration_minutes || 0}分钟
                              </span>
                              <span style={{ fontSize: 12, color: '#999' }}>
                                {formatDateTime(transport.start_time)} → {formatDateTime(transport.end_time)}
                              </span>
                              {transport.remark && (
                                <span style={{ fontSize: 12, marginTop: 4 }}>{transport.remark}</span>
                              )}
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>
                  )}

                  {auditTrail.shift_changes && auditTrail.shift_changes.length > 0 && (
                    <Card size="small" style={{ marginBottom: 16 }} title={`替班交接 (${auditTrail.shift_changes.length}次)`}>
                      <List
                        size="small"
                        dataSource={auditTrail.shift_changes}
                        renderItem={(sc: ShiftChange, idx: number) => (
                          <List.Item key={sc.id}>
                            <Space direction="vertical" size={0} style={{ width: '100%' }}>
                              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 500 }}>
                                  交接 #{idx + 1} - {sc.from_escort_name} → {sc.to_escort_name}
                                </span>
                                <Tag color="purple">替班</Tag>
                              </Space>
                              <span style={{ fontSize: 12, color: '#999' }}>
                                {formatDateTime(sc.created_at)} · {sc.operator_name}
                              </span>
                              {sc.reason && (
                                <span style={{ fontSize: 12, marginTop: 4 }}>原因: {sc.reason}</span>
                              )}
                              {sc.remark && (
                                <span style={{ fontSize: 12 }}>备注: {sc.remark}</span>
                              )}
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>
                  )}

                  {auditTrail.reschedule_records && auditTrail.reschedule_records.length > 0 && (
                    <Card size="small" title={`待重排记录 (${auditTrail.reschedule_records.length}次)`}>
                      <List
                        size="small"
                        dataSource={auditTrail.reschedule_records}
                        renderItem={(rr: RescheduleRecord, idx: number) => (
                          <List.Item key={rr.id}>
                            <Space direction="vertical" size={0} style={{ width: '100%' }}>
                              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 500 }}>
                                  重排 #{idx + 1} - 原时间: {formatDateTime(rr.old_scheduled_time)}
                                </span>
                                <span style={{ fontSize: 12, color: '#fa8c16' }}>
                                  等待 {rr.wait_duration_minutes}分钟
                                </span>
                              </Space>
                              <span style={{ fontSize: 12, color: '#999' }}>
                                新时间: {formatDateTime(rr.new_scheduled_time)} · {rr.operator_name}
                              </span>
                              {rr.reason && (
                                <span style={{ fontSize: 12, marginTop: 4 }}>原因: {rr.reason}</span>
                              )}
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>
                  )}
                </div>
              ) : (
                <Card size="small" loading>
                  加载审计链信息...
                </Card>
              )}
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
