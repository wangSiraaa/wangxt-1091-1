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
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import type { CheckRequest, Escort, Ward, RequestLog } from '../types'
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
  const [selectedRequest, setSelectedRequest] = useState<CheckRequest | null>(null)
  const [selectedEscort, setSelectedEscort] = useState<string>('')
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([])

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
    if (!selectedRequest || !selectedEscort) {
      message.warning('请选择陪检员')
      return
    }

    try {
      await api.assignRequest(selectedRequest.id, {
        escort_id: selectedEscort,
        operator_id: 'supervisor-001',
        operator_name: '病区主管',
      })
      message.success('派单成功')
      setAssignModalVisible(false)
      fetchData()
    } catch (error: any) {
      message.error(error.message || '派单失败')
    }
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
          <span style={{ fontSize: 12, color: '#999' }}>{record.check_room}</span>
        </Space>
      ),
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
      render: (_: any, record: CheckRequest) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <Button
              size="small"
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleAssign(record)}
            >
              派单
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const stats = {
    pending: requests.filter((r) => r.status === 'pending').length,
    inProgress: requests.filter((r) => ['assigned', 'accepted', 'in_progress'].includes(r.status)).length,
    completed: requests.filter((r) => r.status === 'completed').length,
    settled: requests.filter((r) => r.status === 'settled').length,
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待派单" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="进行中" value={stats.inProgress} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
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
              <Option value="assigned">已派单</Option>
              <Option value="accepted">已接单</Option>
              <Option value="in_progress">进行中</Option>
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
        okText="确认派单"
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
              <Descriptions.Item label="紧急程度">
                {getUrgencyInfo(selectedRequest.urgency).text}
              </Descriptions.Item>
            </Descriptions>

            {selectedRequest.patient?.is_isolated && (
              <Alert
                message="该患者为隔离患者，必须安排专人陪检"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

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
