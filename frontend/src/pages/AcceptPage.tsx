import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Select,
  Tag,
  Space,
  message,
  Row,
  Col,
  Statistic,
  Modal,
  Descriptions,
  Tabs,
  Timeline,
  Form,
  Input,
  Alert,
  List,
  Divider,
  Popconfirm,
  Badge,
  Empty,
} from 'antd'
import {
  ReloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  UserOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import type { CheckRequest, Escort, RequestLog, Transport, ShiftChange } from '../types'
import {
  getStatusInfo,
  getUrgencyInfo,
  formatDateTime,
  formatDuration,
  getActionText,
} from '../utils'

const { TextArea } = Input

const { Option } = Select
const { TabPane } = Tabs

const AcceptPage = () => {
  const [requests, setRequests] = useState<CheckRequest[]>([])
  const [escorts, setEscorts] = useState<Escort[]>([])
  const [currentEscort, setCurrentEscort] = useState<Escort | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('assigned')

  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<CheckRequest | null>(null)
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([])
  const [transports, setTransports] = useState<Transport[]>([])
  const [shiftChanges, setShiftChanges] = useState<ShiftChange[]>([])
  const [shiftChangeModalVisible, setShiftChangeModalVisible] = useState(false)
  const [shiftChangeForm] = Form.useForm()
  const [newEscortId, setNewEscortId] = useState<string>('')
  const [detailTabKey, setDetailTabKey] = useState('info')

  const fetchTransports = async (requestId: string) => {
    try {
      const res = await api.getTransports(requestId)
      setTransports(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取转运记录失败')
    }
  }

  const fetchShiftChanges = async (requestId: string) => {
    try {
      const res = await api.getShiftChanges(requestId)
      setShiftChanges(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取替班记录失败')
    }
  }

  useEffect(() => {
    if (detailModalVisible && selectedRequest) {
      if (detailTabKey === 'transports') {
        fetchTransports(selectedRequest.id)
      } else if (detailTabKey === 'shifts') {
        fetchShiftChanges(selectedRequest.id)
      }
    }
  }, [detailTabKey, detailModalVisible])

  const fetchData = async () => {
    if (!currentEscort) return
    setLoading(true)
    try {
      const params: any = {}
      if (statusFilter) params.status = statusFilter

      const [reqRes, escRes] = await Promise.all([
        api.getCheckRequests({ ...params, escortId: currentEscort.id }),
        api.getEscorts(),
      ])
      setRequests(reqRes.data || [])
      setEscorts(escRes.data || [])
    } catch (error: any) {
      message.error(error.message || '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (escorts.length > 0 && !currentEscort) {
      const onlineEscort = escorts.find((e) => e.status === 'online')
      if (onlineEscort) {
        setCurrentEscort(onlineEscort)
      }
    }
  }, [escorts])

  useEffect(() => {
    if (currentEscort) {
      fetchData()
    } else {
      api.getEscorts().then((res) => {
        setEscorts(res.data || [])
      })
    }
  }, [currentEscort, statusFilter])

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

  const handleAccept = async (record: CheckRequest) => {
    try {
      await api.acceptRequest(record.id, { operator_id: currentEscort?.id })
      message.success('接单成功')
      fetchData()
    } catch (error: any) {
      message.error(error.message || '接单失败')
    }
  }

  const handleStart = async (record: CheckRequest) => {
    try {
      await api.startRequest(record.id, { operator_id: currentEscort?.id })
      message.success('已开始陪检')
      fetchData()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handleCreateTransport = async (record: CheckRequest) => {
    try {
      await api.createTransport(record.id, {
        from_department: record.source_department || '',
        to_department: record.target_department || '',
        operator_id: currentEscort?.id,
        operator_name: currentEscort?.name,
      })
      message.success('已创建转运记录')
      fetchData()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handleStartTransport = async (record: CheckRequest) => {
    try {
      if (transports.length === 0) {
        await handleCreateTransport(record)
      }
      const transportId = transports[0]?.id || 'latest'
      await api.startTransport(record.id, transportId, {
        operator_id: currentEscort?.id,
        operator_name: currentEscort?.name,
      })
      message.success('已开始转运')
      fetchData()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handleCompleteTransport = async (record: CheckRequest) => {
    Modal.confirm({
      title: '确认完成转运',
      content: '确认患者已安全送达目标科室？',
      onOk: async () => {
        try {
          const transportId = transports[0]?.id || 'latest'
          await api.completeTransport(record.id, transportId, {
            operator_id: currentEscort?.id,
            operator_name: currentEscort?.name,
          })
          message.success('转运完成')
          fetchData()
        } catch (error: any) {
          message.error(error.message || '操作失败')
        }
      },
    })
  }

  const handleComplete = async (record: CheckRequest) => {
    Modal.confirm({
      title: '确认完成',
      content: '确认已完成陪检任务？',
      onOk: async () => {
        try {
          await api.completeRequest(record.id, { operator_id: currentEscort?.id })
          message.success('陪检完成')
          fetchData()
        } catch (error: any) {
          message.error(error.message || '操作失败')
        }
      },
    })
  }

  const handleRequestShiftChange = async (record: CheckRequest) => {
    setSelectedRequest(record)
    setNewEscortId('')
    shiftChangeForm.resetFields()
    try {
      await fetchShiftChanges(record.id)
    } catch (error: any) {
      message.error(error.message || '获取替班记录失败')
    }
    setShiftChangeModalVisible(true)
  }

  const handleConfirmShiftChange = async (values: any) => {
    if (!selectedRequest || !newEscortId) {
      message.warning('请选择替班陪检员')
      return
    }

    try {
      await api.createShiftChange(selectedRequest.id, {
        new_escort_id: newEscortId,
        old_escort_id: currentEscort?.id!,
        ...values,
        operator_id: currentEscort?.id,
        operator_name: currentEscort?.name,
      })
      message.success('替班申请已提交')
      setShiftChangeModalVisible(false)
      fetchData()
    } catch (error: any) {
      message.error(error.message || '替班申请失败')
    }
  }

  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      render: (_: any, record: CheckRequest) => {
        const info = getUrgencyInfo(record.urgency)
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: CheckRequest) => {
        const info = getStatusInfo(status as any)
        return (
          <Space direction="vertical" size={0}>
            <Tag color={info.color}>{info.text}</Tag>
            {record.is_cross_department && <Tag color="geekblue" style={{ fontSize: 10 }}>跨科室</Tag>}
            {record.has_overtime_wait && <Tag color="red" style={{ fontSize: 10 }}>超时</Tag>}
            {record.has_shift_change && <Tag color="purple" style={{ fontSize: 10 }}>替班</Tag>}
          </Space>
        )
      },
    },
    {
      title: '等待时长',
      dataIndex: 'wait_duration',
      key: 'wait_duration',
      render: (duration: number | null) => formatDuration(duration),
    },
    {
      title: '派单时间',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CheckRequest) => {
        const canShiftChange = ['assigned', 'accepted', 'in_progress', 'in_transport'].includes(record.status)
        return (
          <Space wrap>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            {record.status === 'assigned' && (
              <Button
                size="small"
                type="primary"
                icon={<UserOutlined />}
                onClick={() => handleAccept(record)}
              >
                接单
              </Button>
            )}
            {record.status === 'accepted' && (
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStart(record)}
              >
                开始陪检
              </Button>
            )}
            {record.status === 'in_progress' && (
              <Button
                size="small"
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => handleStartTransport(record)}
              >
                开始转运
              </Button>
            )}
            {record.status === 'in_transport' && (
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleCompleteTransport(record)}
              >
                完成转运
              </Button>
            )}
            {record.status === 'in_progress' && (
              <Button
                size="small"
                type="default"
                icon={<CheckCircleOutlined />}
                onClick={() => handleComplete(record)}
              >
                直接完成
              </Button>
            )}
            {canShiftChange && (
              <Popconfirm
                title="确认申请替班？"
                description="申请后将由其他陪检员接手此任务"
                onConfirm={() => handleRequestShiftChange(record)}
                okText="确认申请"
                cancelText="取消"
              >
                <Button size="small" icon={<SwapOutlined />}>
                  替班
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  const stats = {
    assigned: requests.filter((r) => r.status === 'assigned').length,
    accepted: requests.filter((r) => r.status === 'accepted').length,
    inProgress: requests.filter((r) => r.status === 'in_progress').length,
    inTransport: requests.filter((r) => r.status === 'in_transport').length,
    completed: requests.filter((r) => ['completed', 'settled'].includes(r.status)).length,
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>当前陪检员：</span>
          <Select
            style={{ width: 200 }}
            value={currentEscort?.id || undefined}
            onChange={(val) => {
              const escort = escorts.find((e) => e.id === val)
              setCurrentEscort(escort || null)
            }}
            placeholder="选择陪检员身份"
          >
            {escorts.map((e) => (
              <Option key={e.id} value={e.id} disabled={e.status === 'offline'}>
                {e.name}
                {e.is_specialist ? ' 【专人】' : ''}
                {e.status === 'online' ? '（在线）' : '（离线）'}
              </Option>
            ))}
          </Select>
          {currentEscort && (
            <Tag color={currentEscort.status === 'online' ? 'green' : 'default'}>
              {currentEscort.status === 'online' ? '在线' : '离线'}
            </Tag>
          )}
        </Space>
      </Card>

      {currentEscort && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={5}>
              <Card>
                <Statistic title="待接单" value={stats.assigned} valueStyle={{ color: '#faad14' }} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="已接单" value={stats.accepted} valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="进行中" value={stats.inProgress} valueStyle={{ color: '#13c2c2' }} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="转运中" value={stats.inTransport} valueStyle={{ color: '#2f54eb' }} prefix={<ThunderboltOutlined />} />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
          </Row>

          <Card
            title="我的任务"
            extra={
              <Space>
                <Select
                  placeholder="状态筛选"
                  style={{ width: 140 }}
                  value={statusFilter || undefined}
                  onChange={(val) => setStatusFilter(val || '')}
                  allowClear
                >
                  <Option value="assigned">待接单</Option>
                  <Option value="accepted">已接单</Option>
                  <Option value="in_progress">进行中</Option>
                  <Option value="in_transport">转运中</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="settled">已结算</Option>
                </Select>
                <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
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
            title="任务详情"
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
              <Tabs activeKey={detailTabKey} onChange={setDetailTabKey}>
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
                    {selectedRequest.source_department && (
                      <Descriptions.Item label="来源科室">
                        {selectedRequest.source_department}
                      </Descriptions.Item>
                    )}
                    {selectedRequest.target_department && (
                      <Descriptions.Item label="目标科室">
                        {selectedRequest.target_department}
                      </Descriptions.Item>
                    )}
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
                    {selectedRequest.transport_started_at && (
                      <Descriptions.Item label="转运时间">
                        <Space direction="vertical" size={0}>
                          <span>开始：{formatDateTime(selectedRequest.transport_started_at)}</span>
                          {selectedRequest.transport_completed_at && (
                            <span>完成：{formatDateTime(selectedRequest.transport_completed_at)}</span>
                          )}
                        </Space>
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="特殊标记">
                      <Space>
                        {selectedRequest.is_cross_department && <Tag color="geekblue">跨科室转运</Tag>}
                        {selectedRequest.has_overtime_wait && <Tag color="red">超时等候</Tag>}
                        {selectedRequest.has_shift_change && <Tag color="purple">替班交接</Tag>}
                        {!selectedRequest.is_cross_department && !selectedRequest.has_overtime_wait && !selectedRequest.has_shift_change && '-'}
                      </Space>
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
                    <Descriptions.Item label="备注">
                      {selectedRequest.remark || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                </TabPane>
                <TabPane tab="转运记录" key="transports">
                  {transports.length > 0 ? (
                    <List
                      dataSource={transports}
                      renderItem={(transport) => (
                        <List.Item>
                          <List.Item.Meta
                            title={
                              <Space>
                                <Badge status={transport.status === 'completed' ? 'success' : 'processing'} />
                                <span>{transport.from_department} → {transport.to_department}</span>
                                {transport.is_cross_department && (
                                  <Tag color="geekblue" style={{ fontSize: 10 }}>跨科室</Tag>
                                )}
                              </Space>
                            }
                            description={
                              <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
                                {transport.started_at && (
                                  <span>开始：{formatDateTime(transport.started_at)}</span>
                                )}
                                {transport.completed_at && (
                                  <span>完成：{formatDateTime(transport.completed_at)}</span>
                                )}
                                {(transport.actual_duration_minutes || transport.duration_minutes) && (
                                  <span style={{ color: '#1890ff' }}>
                                    耗时：{transport.actual_duration_minutes || transport.duration_minutes}分钟
                                  </span>
                                )}
                                {transport.escort_name && (
                                  <span>陪检员：{transport.escort_name}</span>
                                )}
                                {transport.remark && (
                                  <span style={{ color: '#999' }}>备注：{transport.remark}</span>
                                )}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="暂无转运记录" />
                  )}
                </TabPane>
                <TabPane tab="替班记录" key="shifts">
                  {shiftChanges.length > 0 ? (
                    <Timeline
                      items={shiftChanges.map((sc) => ({
                        color: 'purple',
                        children: (
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {sc.old_escort_name || sc.old_escort_id} → {sc.new_escort_name || sc.new_escort_id}
                            </div>
                            <div style={{ fontSize: 12, color: '#999' }}>
                              {sc.operator_name || sc.operator_id} · {formatDateTime(sc.created_at)}
                            </div>
                            {sc.reason && (
                              <div style={{ fontSize: 12, marginTop: 4 }}>
                                原因：{sc.reason}
                              </div>
                            )}
                            {sc.transfer_notes && (
                              <div style={{ fontSize: 12, marginTop: 2, color: '#1890ff' }}>
                                交接说明：{sc.transfer_notes}
                              </div>
                            )}
                          </div>
                        ),
                      }))}
                    />
                  ) : (
                    <Empty description="暂无替班记录" />
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

          <Modal
            title="申请替班"
            open={shiftChangeModalVisible}
            onOk={() => shiftChangeForm.submit()}
            onCancel={() => setShiftChangeModalVisible(false)}
            okText="提交申请"
            cancelText="取消"
            width={500}
          >
            {selectedRequest && (
              <div>
                <Alert
                  message="申请替班后，此任务将转交其他陪检员"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="患者">
                    {selectedRequest.patient?.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="检查项目">
                    {selectedRequest.check_type} - {selectedRequest.check_item}
                  </Descriptions.Item>
                  <Descriptions.Item label="当前状态">
                    <Tag color={getStatusInfo(selectedRequest.status).color}>
                      {getStatusInfo(selectedRequest.status).text}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>

                {shiftChanges.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Divider orientation="left" style={{ margin: '8px 0', fontSize: 12 }}>
                      历史交接
                    </Divider>
                    <Timeline
                      items={shiftChanges.slice(0, 3).map((sc) => ({
                        color: 'purple',
                        children: (
                          <div style={{ fontSize: 11 }}>
                            <div>{sc.old_escort_name || sc.from_escort_name || sc.from_escort?.name || '原陪检员'} → {sc.new_escort_name || sc.to_escort_name || sc.to_escort?.name || '新陪检员'}</div>
                            <div style={{ color: '#999' }}>{formatDateTime(sc.created_at)}</div>
                          </div>
                        ),
                      }))}
                    />
                  </div>
                )}

                <Form
                  form={shiftChangeForm}
                  layout="vertical"
                  onFinish={handleConfirmShiftChange}
                >
                  <Form.Item
                    name="new_escort_id"
                    label="选择替班陪检员"
                    rules={[{ required: true, message: '请选择替班陪检员' }]}
                  >
                    <Select
                      placeholder="请选择替班陪检员"
                      value={newEscortId || undefined}
                      onChange={(val) => setNewEscortId(val)}
                    >
                      {escorts
                        .filter((e) => e.status === 'online' && e.id !== currentEscort?.id)
                        .map((e) => (
                          <Option key={e.id} value={e.id}>
                            {e.name}
                            {e.is_specialist ? ' 【专人】' : ''}
                          </Option>
                        ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="reason"
                    label="替班原因"
                    rules={[{ required: true, message: '请填写替班原因' }]}
                  >
                    <TextArea rows={2} placeholder="请填写替班原因" />
                  </Form.Item>
                  <Form.Item
                    name="transfer_notes"
                    label="交接说明"
                  >
                    <TextArea rows={2} placeholder="请填写交接说明，如患者情况、注意事项等" />
                  </Form.Item>
                </Form>
              </div>
            )}
          </Modal>
        </>
      )}

      {!currentEscort && (
        <Card>
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            请选择陪检员身份以查看任务
          </div>
        </Card>
      )}
    </div>
  )
}

export default AcceptPage
