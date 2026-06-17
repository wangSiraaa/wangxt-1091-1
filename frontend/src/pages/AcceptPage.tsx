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
} from 'antd'
import {
  ReloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import type { CheckRequest, Escort, RequestLog } from '../types'
import {
  getStatusInfo,
  getUrgencyInfo,
  formatDateTime,
  formatDuration,
  getActionText,
} from '../utils'

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
      title: '派单时间',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      render: (time: string) => formatDateTime(time),
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
              icon={<CheckCircleOutlined />}
              onClick={() => handleComplete(record)}
            >
              完成
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const stats = {
    assigned: requests.filter((r) => r.status === 'assigned').length,
    accepted: requests.filter((r) => r.status === 'accepted').length,
    inProgress: requests.filter((r) => r.status === 'in_progress').length,
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
            <Col span={6}>
              <Card>
                <Statistic title="待接单" value={stats.assigned} valueStyle={{ color: '#faad14' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="已接单" value={stats.accepted} valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="进行中" value={stats.inProgress} valueStyle={{ color: '#13c2c2' }} />
              </Card>
            </Col>
            <Col span={6}>
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
                    <Descriptions.Item label="等待时长">
                      {formatDuration(selectedRequest.wait_duration)}
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
