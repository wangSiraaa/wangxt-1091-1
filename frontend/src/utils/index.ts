import dayjs from 'dayjs'
import type { RequestStatus } from '../types'

export const statusMap: Record<RequestStatus, { text: string; color: string }> = {
  pending: { text: '待派单', color: 'orange' },
  assigned: { text: '已派单', color: 'blue' },
  accepted: { text: '已接单', color: 'cyan' },
  in_progress: { text: '进行中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  settled: { text: '已结算', color: 'purple' },
  cancelled: { text: '已取消', color: 'default' },
}

export const urgencyMap: Record<string, { text: string; color: string }> = {
  normal: { text: '普通', color: 'default' },
  urgent: { text: '加急', color: 'orange' },
  emergency: { text: '紧急', color: 'red' },
}

export const actionMap: Record<string, string> = {
  create: '提交申请',
  assign: '派单',
  accept: '接单',
  start: '开始陪检',
  complete: '完成陪检',
  settle: '结算',
  cancel: '取消',
}

export function formatDateTime(date?: string): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

export function formatDate(date?: string): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

export function formatDuration(minutes?: number | null): string {
  if (minutes === undefined || minutes === null) return '-'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours} 小时 ${mins} 分钟`
}

export function getStatusInfo(status: RequestStatus) {
  return statusMap[status] || { text: status, color: 'default' }
}

export function getUrgencyInfo(urgency: string) {
  return urgencyMap[urgency] || { text: urgency, color: 'default' }
}

export function getActionText(action: string) {
  return actionMap[action] || action
}
