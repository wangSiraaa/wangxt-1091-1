import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
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
  Alert,
  Form,
  Input,
  Radio,
  Progress,
  Empty,
  List,
  Avatar,
  Badge,
  Divider,
  Tooltip,
} from 'antd'

const { TextArea } = Input
const { Meta } = List.Item
import {
  ReloadOutlined,
  EyeOutlined,
  SendOutlined,
  SwapOutlined,
  RedoOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  StarOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import type { CheckRequest, Escort, Ward, RequestLog, AssignmentSuggestion, ShiftChange } from '../types'
import {
  getStatusInfo,
  getUrgencyInfo,
  formatDateTime,
  formatDuration,
  getActionText,
} from '../utils'

const { Option } = Select
const { TabPane } = Tabs

const AssignPage = () => {
  const [requests, setRequests] = useState<CheckRequest[]>([])
  const [escorts, setEscorts] = useState<Escort[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [wardFilter, setWardFilter] = useState<string>('')

  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [shiftChangeModalVisible, setShiftChangeModalVisible] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<CheckRequest | null>(null)
  const [selectedEscort, setSelectedEscort] = useState<string>('')
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([])
  const [suggestions, setSuggestions] = useState<AssignmentSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string>('')
  const [assignTabKey, setAssignTabKey] = useState('suggestions')
  const [isManualAssign, setIsManualAssign] = useState(false)
  const [shiftChangeForm] = Form.useForm()
  const [shiftChanges, setShiftChanges] = useState<ShiftChange[]>([])
  const [newEscortId, setNewEscortId] = useState<string>('')

  const fetchSuggestions = async (requestId: string) => {
    setSuggestionsLoading(true)
    try {
      const res = await api.getAssignmentSuggestions(requestId)
      setSuggestions(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取派单建议失败')
    } finally {
      setSuggestionsLoading(false)
    }
  }

  useEffect(() => {
    if (assignModalVisible && selectedRequest?.status === 'pending') {
      fetchSuggestions(selectedRequest.id)
    }
  }, [assignModalVisible])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (statusFilter) params.status = statusFilter
      if (wardFilter) params.ward = wardFilter

      const [reqRes, escRes, wardRes] = await Promise.all([
        api.getCheckRequests(params),
        api.getEscorts(),
        api.getWards(),
      ])
      setRequests(reqRes.data || [])
      setEscorts(escRes.data || [])
      setWards(wardRes.data || [])
    } catch (error: any) {
      message.error(error.message || '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [statusFilter, wardFilter])

  const handleAssign = (record: CheckRequest) => {
    setSelectedRequest(record)
    setSelectedEscort('')
    setAssignModalVisible(true)
  }

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

  const handleConfirmAssign = async () => {
    if (!selectedRequest) return
    const escortId = isManualAssign ? selectedEscort : selectedSuggestionId
    if (!escortId) {
      message.warning('请选择陪检员')
      return
    }

    try {
      await api.assignRequest(selectedRequest.id, {
        escort_id: escortId,
        operator_id: 'supervisor-001',
        operator_name: '病区主管',
        selected_suggestion_id: isManualAssign ? undefined : selectedSuggestionId,
        is_manual_assign: isManualAssign,
      })
      message.success(isManualAssign ? '手动派单成功' : '派单成功')
      setAssignModalVisible(false)
      fetchData()
    } catch (error: any) {
      message.error(error.message || '派单失败')
    }
  }

  const handleReassign = async (record: CheckRequest) => {
    try {
      await api.reassignRequest(record.id, {
        operator_id: 'supervisor-001',
        operator_name: '病区主管',
        reason: '检查时间重新安排',
      })
      message.success('已转待派单，可重新安排')
      fetchData()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handleShiftChange = async (record: CheckRequest) => {
    setSelectedRequest(record)
    setNewEscortId('')
    shiftChangeForm.resetFields()
    try {
      const res = await api.getShiftChanges(record.id)
      setShiftChanges(res.data || [])
    } catch (error: any) {
      message.error(error.message || '获取替班记录失败')
    }
    setShiftChangeModalVisible(true)
  }

  const handleConfirmShiftChange = async (values: any) => {
    if (!selectedRequest || !newEscortId) {
      message.warning('请选择新陪检员')
      return
    }

    try {
      await api.createShiftChange(selectedRequest.id, {
        new_escort_id: newEscortId,
        old_escort_id: selectedRequest.escort_id!,
        ...values,
        operator_id: 'supervisor-001',
        operator_name: '病区主管',
      })
      message.success('替班交接成功')
      setShiftChangeModalVisible(false)
      fetchData()
    } catch (error: any) {
      message.error(error.message || '替班交接失败')
    }
  }

  const getSuggestionEscortInfo = (suggestion: AssignmentSuggestion) => {
    return escorts.find((e) => e.id === suggestion.escort_id)
  }

  const getAvailableEscorts = () => {
    if (!selectedRequest) return []
    const isIsolated = selectedRequest.patient?.is_isolated
    return escorts.filter((e) => {
      if (isIsolated && !e.is_specialist) return false
      return e.status === 'online'
    })
  }

  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 60,
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
            {record.is_cross_department && (
              <Tag color="geekblue" style={{ fontSize: 10 }}>跨科室</Tag>
            )}
            {record.has_overtime_wait && (
              <Tag color="red" style={{ fontSize: 10 }}>超时等候</Tag>
            )}
            {record.has_shift_change && (
              <Tag color="purple" style={{ fontSize: 10 }}>替班</Tag>
            )}
          </Space>
        )
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
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => formatDateTime(time),
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
      title: '操作',
      key: 'action',
      render: (_: any, record: CheckRequest) => {
        const canAssign = record.status === 'pending'
        const canReassign = record.status === 'to_reschedule'
        const canShiftChange = ['assigned', 'accepted', 'in_progress', 'in_transport'].includes(record.status) && record.escort_id
        return (
          <Space wrap>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            {canAssign && (
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                onClick={() => handleAssign(record)}
              >
                派单
              </Button>
            )}
            {canReassign && (
              <Button
                size="small"
                type="primary"
                icon={<RedoOutlined />}
                onClick={() => handleReassign(record)}
              >
                重新派单
              </Button>
            )}
            {canShiftChange && (
              <Button
                size="small"
                icon={<SwapOutlined />}
                onClick={() => handleShiftChange(record)}
              >
                替班
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  const stats = {
    pending: requests.filter((r) => r.status === 'pending').length,
    toReschedule: requests.filter((r) => r.status === 'to_reschedule').length,
    inProgress: requests.filter((r) => ['assigned', 'accepted', 'in_progress', 'in_transport'].includes(r.status)).length,
    inTransport: requests.filter((r) => r.status === 'in_transport').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    settled: requests.filter((r) => r.status === 'settled').length,
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic title="待派单" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="待重排" value={stats.toReschedule} valueStyle={{ color: '#fa8c16' }} prefix={<HistoryOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="进行中" value={stats.inProgress} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="转运中" value={stats.inTransport} valueStyle={{ color: '#2f54eb' }} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="已结算" value={stats.settled} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="陪检申请管理"
        extra={
          <Space>
            <Select
              placeholder="状态筛选"
              style={{ width: 140 }}
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val || '')}
              allowClear
            >
              <Option value="pending">待派单</Option>
              <Option value="to_reschedule">待重排</Option>
              <Option value="assigned">已派单</Option>
              <Option value="accepted">已接单</Option>
              <Option value="in_progress">进行中</Option>
              <Option value="in_transport">转运中</Option>
              <Option value="completed">已完成</Option>
              <Option value="settled">已结算</Option>
            </Select>
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
        title="派单"
        open={assignModalVisible}
        onOk={handleConfirmAssign}
        onCancel={() => setAssignModalVisible(false)}
        okText={isManualAssign ? '确认手动派单' : '确认派单'}
        cancelText="取消"
        width={700}
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
              <Descriptions.Item label="等待时长">
                {formatDuration(selectedRequest.wait_duration)}
              </Descriptions.Item>
              {selectedRequest.source_department && selectedRequest.target_department && (
                <Descriptions.Item label="转运路线" span={2}>
                  <EnvironmentOutlined /> {selectedRequest.source_department} → {selectedRequest.target_department}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedRequest.patient?.is_isolated && (
              <Alert
                message="该患者为隔离患者，必须安排专人陪检"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Tabs
              activeKey={assignTabKey}
              onChange={(key) => {
                setAssignTabKey(key)
                setIsManualAssign(key === 'manual')
              }}
            >
              <TabPane
                tab={
                  <span>
                    <ThunderboltOutlined />
                    智能派单建议
                  </span>
                }
                key="suggestions"
              >
                {suggestionsLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>正在计算最佳派单...</div>
                ) : suggestions.length > 0 ? (
                  <Radio.Group
                    value={selectedSuggestionId}
                    onChange={(e) => setSelectedSuggestionId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <List
                      dataSource={suggestions}
                      renderItem={(suggestion, index) => {
                        const escort = getSuggestionEscortInfo(suggestion)
                        if (!escort) return null
                        return (
                          <List.Item
                            key={suggestion.id}
                            style={{
                              border: '1px solid #d9d9d9',
                              borderRadius: 8,
                              marginBottom: 8,
                              padding: 12,
                              backgroundColor: selectedSuggestionId === suggestion.id ? '#e6f7ff' : 'white',
                            }}
                          >
                            <Radio value={suggestion.id} style={{ width: '100%' }}>
                              <Meta
                                avatar={
                                  <Badge status={escort.status === 'online' ? 'success' : 'default'} text="">
                                    <Avatar icon={<TeamOutlined />} />
                                  </Badge>
                                }
                                title={
                                  <Space>
                                    <span style={{ fontWeight: 500 }}>{escort.name}</span>
                                    {index === 0 && <Tag color="gold" icon={<StarOutlined />}>最佳推荐</Tag>}
                                    {escort.is_specialist && <Tag color="purple">专人</Tag>}
                                    <Tooltip title="综合评分">
                                      <Tag color="blue">{Math.round(suggestion.total_score * 100)}分</Tag>
                                    </Tooltip>
                                  </Space>
                                }
                                description={
                                  <Space direction="vertical" size={0} style={{ width: '100%', marginTop: 8 }}>
                                    <Row gutter={8}>
                                      <Col span={6}>
                                        <div style={{ fontSize: 11, color: '#999' }}>距离评分</div>
                                        <Progress percent={Math.round(suggestion.distance_score * 100)} size="small" showInfo={false} />
                                      </Col>
                                      <Col span={6}>
                                        <div style={{ fontSize: 11, color: '#999' }}>负载评分</div>
                                        <Progress percent={Math.round(suggestion.load_score * 100)} size="small" showInfo={false} strokeColor="#52c41a" />
                                      </Col>
                                      <Col span={6}>
                                        <div style={{ fontSize: 11, color: '#999' }}>技能匹配</div>
                                        <Progress percent={Math.round(suggestion.skill_score * 100)} size="small" showInfo={false} strokeColor="#722ed1" />
                                      </Col>
                                      <Col span={6}>
                                        <div style={{ fontSize: 11, color: '#999' }}>优先级</div>
                                        <Progress percent={Math.round(suggestion.priority_score * 100)} size="small" showInfo={false} strokeColor="#fa8c16" />
                                      </Col>
                                    </Row>
                                    <Space size={[16, 4]} style={{ fontSize: 11, marginTop: 4 }}>
                                      <span><EnvironmentOutlined /> 预计{suggestion.estimated_arrival_minutes}分钟到达</span>
                                      <span><TeamOutlined /> 当前{suggestion.current_load}个任务</span>
                                      {escort.current_location && (
                                        <span>位置：{escort.current_location}</span>
                                      )}
                                    </Space>
                                  </Space>
                                }
                              />
                            </Radio>
                          </List.Item>
                        )
                      }}
                    />
                  </Radio.Group>
                ) : (
                  <Empty description="暂无派单建议" />
                )}
              </TabPane>
              <TabPane
                tab={
                  <span>
                    <TeamOutlined />
                    手动派单
                  </span>
                }
                key="manual"
              >
                <div style={{ marginBottom: 8 }}>选择陪检员：</div>
                <Select
                  style={{ width: '100%' }}
                  placeholder="请选择陪检员"
                  value={selectedEscort || undefined}
                  onChange={(val) => setSelectedEscort(val)}
                  showSearch
                  optionFilterProp="children"
                >
                  {getAvailableEscorts().map((e) => (
                    <Option key={e.id} value={e.id}>
                      {e.name}
                      {e.is_specialist ? ' 【专人】' : ''}
                      {e.status === 'busy' ? ' （忙碌中）' : ''}
                    </Option>
                  ))}
                </Select>
                {getAvailableEscorts().length === 0 && (
                  <div style={{ color: '#999', marginTop: 8, fontSize: 12 }}>
                    暂无可用的陪检员
                    {selectedRequest.patient?.is_isolated ? '（专人）' : ''}
                  </div>
                )}
              </TabPane>
            </Tabs>
          </div>
        )}
      </Modal>

      <Modal
        title="替班交接"
        open={shiftChangeModalVisible}
        onOk={() => shiftChangeForm.submit()}
        onCancel={() => setShiftChangeModalVisible(false)}
        okText="确认交接"
        cancelText="取消"
        width={550}
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
              <Descriptions.Item label="当前陪检员">
                {selectedRequest.escort?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={getStatusInfo(selectedRequest.status).color}>
                  {getStatusInfo(selectedRequest.status).text}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {shiftChanges.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Divider orientation="left" style={{ margin: '8px 0' }}>
                  历史交接记录
                </Divider>
                <Timeline
                  items={shiftChanges.map((sc) => ({
                    color: 'purple',
                    children: (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>
                          {sc.old_escort_name || sc.from_escort_name || sc.from_escort?.name || '原陪检员'} → {sc.new_escort_name || sc.to_escort_name || sc.to_escort?.name || '新陪检员'}
                        </div>
                        <div style={{ fontSize: 11, color: '#999' }}>
                          {sc.operator_name} · {formatDateTime(sc.created_at)}
                        </div>
                        {sc.reason && (
                          <div style={{ fontSize: 11, marginTop: 2 }}>
                            原因：{sc.reason}
                          </div>
                        )}
                      </div>
                    ),
                  }))}
                />
              </div>
            )}

            <Divider orientation="left" style={{ margin: '8px 0' }}>
              新陪检员
            </Divider>
            <Form
              form={shiftChangeForm}
              layout="vertical"
              onFinish={handleConfirmShiftChange}
            >
              <Form.Item
                name="new_escort_id"
                label="选择新陪检员"
                rules={[{ required: true, message: '请选择新陪检员' }]}
              >
                <Select
                  placeholder="请选择替班陪检员"
                  value={newEscortId || undefined}
                  onChange={(val) => setNewEscortId(val)}
                >
                  {escorts
                    .filter((e) => e.status === 'online' && e.id !== selectedRequest.escort_id)
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
                label="交接原因"
                rules={[{ required: true, message: '请填写交接原因' }]}
              >
                <TextArea rows={3} placeholder="请填写交接原因" />
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
                <Descriptions.Item label="陪检员">
                  {selectedRequest.escort?.name || '-'}
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
                  <Descriptions.Item label="转运开始">
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

export default AssignPage
