export interface Patient {
  id: string
  name: string
  gender?: 'male' | 'female'
  age?: number
  bed_no?: string
  ward?: string
  department?: string
  phone?: string
  id_card_no?: string
  is_isolated?: number
  created_at?: string
  updated_at?: string
}

export interface Nurse {
  id: string
  name: string
  employee_no?: string
  ward?: string
  department?: string
  phone?: string
  status?: 'on_duty' | 'off_duty'
  created_at?: string
  updated_at?: string
}

export interface Escort {
  id: string
  name: string
  employee_no?: string
  phone?: string
  status: 'online' | 'offline' | 'busy'
  is_specialist?: number
  current_task_id?: string
  created_at?: string
  updated_at?: string
}

export interface CheckOrder {
  id: string
  order_no: string
  patient_id: string
  patient_name?: string
  bed_no?: string
  ward?: string
  check_type: string
  check_item: string
  check_room?: string
  appointment_time?: string
  status: 'pending' | 'requested' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'normal' | 'urgent' | 'emergency'
  remark?: string
  created_at?: string
  updated_at?: string
}

export type RequestStatus = 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'settled' | 'cancelled'

export interface CheckRequest {
  id: string
  patient_id: string
  nurse_id: string
  escort_id?: string
  check_order_id?: string
  check_type: string
  check_item?: string
  check_room?: string
  urgency: 'normal' | 'urgent' | 'emergency'
  priority: number
  status: RequestStatus
  wait_started_at?: string
  assigned_at?: string
  accepted_at?: string
  started_at?: string
  completed_at?: string
  settled_at?: string
  settlement_amount?: number
  remark?: string
  created_at: string
  updated_at: string
  patient?: Patient
  nurse?: Nurse
  escort?: Escort
  check_order?: CheckOrder
  wait_duration?: number | null
}

export interface RequestLog {
  id: string
  request_id: string
  action: string
  operator_id?: string
  operator_role?: 'nurse' | 'supervisor' | 'escort'
  operator_name?: string
  remark?: string
  created_at: string
}

export interface Ward {
  id: string
  name: string
  department?: string
  created_at?: string
}

export interface StatsSummary {
  pending_count: number
  in_progress_count: number
  completed_count: number
  settled_count: number
  avg_wait_duration: number
  today_requests: number
  today_completed: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: string
}

export interface CreateRequestParams {
  patient_id: string
  nurse_id: string
  check_order_id?: string
  check_type: string
  check_item?: string
  check_room?: string
  urgency?: 'normal' | 'urgent' | 'emergency'
  remark?: string
}
