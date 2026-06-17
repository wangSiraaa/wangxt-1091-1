import axios from 'axios'
import type {
  CheckRequest,
  Patient,
  Nurse,
  Escort,
  CheckOrder,
  Ward,
  StatsSummary,
  RequestLog,
  CreateRequestParams,
  ApiResponse
} from '../types'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

request.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

export const api = {
  getStatsSummary: (): Promise<ApiResponse<StatsSummary>> =>
    request.get('/check-requests/stats/summary'),

  getCheckRequests: (params?: {
    status?: string
    ward?: string
    escortId?: string
    nurseId?: string
    patientId?: string
  }): Promise<ApiResponse<CheckRequest[]>> =>
    request.get('/check-requests', { params }),

  getCheckRequest: (id: string): Promise<ApiResponse<CheckRequest>> =>
    request.get(`/check-requests/${id}`),

  getRequestLogs: (id: string): Promise<ApiResponse<RequestLog[]>> =>
    request.get(`/check-requests/${id}/logs`),

  createCheckRequest: (data: CreateRequestParams): Promise<ApiResponse<CheckRequest>> =>
    request.post('/check-requests', data),

  assignRequest: (id: string, data: {
    escort_id: string
    operator_id?: string
    operator_name?: string
  }): Promise<ApiResponse<CheckRequest>> =>
    request.put(`/check-requests/${id}/assign`, data),

  acceptRequest: (id: string, data?: { operator_id?: string }): Promise<ApiResponse<CheckRequest>> =>
    request.put(`/check-requests/${id}/accept`, data || {}),

  startRequest: (id: string, data?: { operator_id?: string }): Promise<ApiResponse<CheckRequest>> =>
    request.put(`/check-requests/${id}/start`, data || {}),

  completeRequest: (id: string, data?: { operator_id?: string; remark?: string }): Promise<ApiResponse<CheckRequest>> =>
    request.put(`/check-requests/${id}/complete`, data || {}),

  settleRequest: (id: string, data: {
    operator_id?: string
    operator_name?: string
    settlement_amount?: number
    remark?: string
  }): Promise<ApiResponse<CheckRequest>> =>
    request.put(`/check-requests/${id}/settle`, data),

  cancelRequest: (id: string, data?: {
    operator_id?: string
    operator_name?: string
    reason?: string
  }): Promise<ApiResponse<CheckRequest>> =>
    request.put(`/check-requests/${id}/cancel`, data || {}),

  getPatients: (params?: {
    ward?: string
    isIsolated?: boolean
    keyword?: string
  }): Promise<ApiResponse<Patient[]>> =>
    request.get('/patients', { params }),

  getPatient: (id: string): Promise<ApiResponse<Patient>> =>
    request.get(`/patients/${id}`),

  getNurses: (): Promise<ApiResponse<Nurse[]>> =>
    request.get('/nurses'),

  getEscorts: (params?: {
    status?: string
    isSpecialist?: boolean
  }): Promise<ApiResponse<Escort[]>> =>
    request.get('/escorts', { params }),

  updateEscortStatus: (id: string, status: string): Promise<ApiResponse<Escort>> =>
    request.put(`/escorts/${id}/status`, { status }),

  getCheckOrders: (params?: {
    patientId?: string
    status?: string
    keyword?: string
  }): Promise<ApiResponse<CheckOrder[]>> =>
    request.get('/check-orders', { params }),

  getCheckOrder: (id: string): Promise<ApiResponse<CheckOrder>> =>
    request.get(`/check-orders/${id}`),

  getWards: (): Promise<ApiResponse<Ward[]>> =>
    request.get('/wards'),
}

export default request
