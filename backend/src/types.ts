export type UrgencyLevel = 'normal' | 'urgent' | 'emergency';

export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'in_transport'
  | 'completed'
  | 'to_reschedule'
  | 'settled'
  | 'cancelled';

export interface Patient {
  id: string;
  name: string;
  gender?: 'male' | 'female';
  age?: number;
  bed_no?: string;
  ward?: string;
  department?: string;
  phone?: string;
  id_card_no?: string;
  is_isolated?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Nurse {
  id: string;
  name: string;
  employee_no?: string;
  ward?: string;
  department?: string;
  phone?: string;
  status?: 'on_duty' | 'off_duty';
  created_at?: string;
  updated_at?: string;
}

export interface Escort {
  id: string;
  name: string;
  employee_no?: string;
  phone?: string;
  status: 'online' | 'offline' | 'busy';
  is_specialist?: number;
  current_task_id?: string;
  current_location?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CheckOrder {
  id: string;
  order_no: string;
  patient_id: string;
  patient_name?: string;
  bed_no?: string;
  ward?: string;
  check_type: string;
  check_item: string;
  check_room?: string;
  target_department?: string;
  appointment_time?: string;
  status: 'pending' | 'requested' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
  priority: UrgencyLevel;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CheckRequest {
  id: string;
  patient_id: string;
  nurse_id: string;
  escort_id?: string;
  check_order_id?: string;
  check_type: string;
  check_item?: string;
  check_room?: string;
  source_department?: string;
  target_department?: string;
  urgency: UrgencyLevel;
  priority: number;
  status: RequestStatus;
  wait_started_at?: string;
  rescheduled_wait_duration?: number;
  assigned_at?: string;
  accepted_at?: string;
  started_at?: string;
  transport_started_at?: string;
  transport_completed_at?: string;
  completed_at?: string;
  settled_at?: string;
  settlement_amount?: number;
  is_cross_department?: number;
  has_overtime_wait?: number;
  has_shift_change?: number;
  remark?: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  nurse?: Nurse;
  escort?: Escort;
  check_order?: CheckOrder;
  wait_duration?: number | null;
}

export interface RequestLog {
  id: string;
  request_id: string;
  action: string;
  operator_id?: string;
  operator_role?: 'nurse' | 'supervisor' | 'escort';
  operator_name?: string;
  remark?: string;
  created_at: string;
}

export interface Ward {
  id: string;
  name: string;
  department?: string;
  created_at?: string;
}

export interface DepartmentDistance {
  id?: string;
  source_department: string;
  target_department: string;
  estimated_minutes: number;
  distance_meters?: number;
  created_at?: string;
}

export interface AssignmentSuggestion {
  id: string;
  request_id: string;
  escort_id: string;
  score: number;
  distance_score: number;
  load_score: number;
  skill_score: number;
  priority_score: number;
  estimated_arrival_minutes: number;
  reason: string;
  is_recommended: number;
  created_at: string;
  escort?: Escort;
}

export interface EscortWorkload {
  escort_id: string;
  escort_name: string;
  current_task_count: number;
  pending_count: number;
  in_progress_count: number;
  today_completed: number;
  avg_task_duration: number;
  is_available: boolean;
}

export interface OvertimeWaitResult {
  is_overtime: boolean;
  wait_duration: number;
  overtime_threshold: number;
  overtime_minutes: number;
  urgency: UrgencyLevel;
}

export interface Transport {
  id: string;
  request_id: string;
  escort_id: string;
  from_department: string;
  to_department: string;
  is_cross_department: number;
  transport_type: 'pickup' | 'sendback' | 'transfer';
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  status: 'pending' | 'in_progress' | 'completed';
  remark?: string;
  created_at: string;
  updated_at: string;
  escort?: Escort;
}

export interface ShiftChange {
  id: string;
  request_id: string;
  from_escort_id: string;
  to_escort_id: string;
  operator_id?: string;
  operator_name?: string;
  reason?: string;
  handover_note?: string;
  handover_time: string;
  created_at: string;
  from_escort?: Escort;
  to_escort?: Escort;
}

export interface RescheduleRecord {
  id: string;
  request_id: string;
  original_check_time?: string;
  new_check_time?: string;
  reason: string;
  operator_id?: string;
  operator_name?: string;
  wait_duration_before: number;
  created_at: string;
}

export interface SettlementValidation {
  request_id: string;
  has_transport_record: boolean;
  has_cross_department: boolean;
  has_overtime_wait: boolean;
  overtime_minutes: number;
  has_shift_change: boolean;
  shift_change_count: number;
  is_valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface AuditTrail {
  request_id: string;
  request: CheckRequest;
  logs: RequestLog[];
  transports: Transport[];
  shift_changes: ShiftChange[];
  reschedules: RescheduleRecord[];
  assignment_suggestions: AssignmentSuggestion[];
}

export interface StatsSummary {
  pending_count: number;
  to_reschedule_count: number;
  in_progress_count: number;
  in_transport_count: number;
  completed_count: number;
  settled_count: number;
  avg_wait_duration: number;
  today_requests: number;
  today_completed: number;
}

export interface CreateRequestParams {
  patient_id: string;
  nurse_id: string;
  check_order_id?: string;
  check_type: string;
  check_item?: string;
  check_room?: string;
  source_department?: string;
  target_department?: string;
  urgency?: UrgencyLevel;
  remark?: string;
}
