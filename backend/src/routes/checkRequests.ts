import { Router, Request, Response } from "express";
import { db, now, uuidv4 } from "../database";
import { BusinessError } from "../middleware/errorHandler";
import { generateAssignmentSuggestions, detectOvertimeWait } from "../utils/scheduler";
import type {
  CheckRequest,
  AssignmentSuggestion,
  Transport,
  ShiftChange,
  RescheduleRecord,
  SettlementValidation,
  AuditTrail,
  UrgencyLevel,
} from "../types";

const router = Router();
const OVERTIME_THRESHOLDS: Record<UrgencyLevel, number> = {
  normal: 30,
  urgent: 15,
  emergency: 5,
};

function addLog(requestId: string, action: string, operatorId?: string, operatorRole?: string, operatorName?: string, remark?: string) {
  db.prepare(
    "INSERT INTO request_logs (id, request_id, action, operator_id, operator_role, operator_name, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuidv4(), requestId, action, operatorId || null, operatorRole || null, operatorName || null, remark || null, now());
}

function calculateWaitDuration(req: any): number | null {
  if (!req.wait_started_at) return null;
  const start = new Date(req.wait_started_at).getTime();
  const endTime = req.accepted_at || req.completed_at;
  if (!endTime) return null;
  const end = new Date(endTime).getTime();
  const baseDuration = Math.round((end - start) / 60000);
  return baseDuration + (req.rescheduled_wait_duration || 0);
}

function attachPatientInfo(requests: any[]) {
  return requests.map((req) => {
    const patient = db.prepare("SELECT id, name, gender, age, bed_no, ward, department, is_isolated FROM patients WHERE id = ?").get(req.patient_id);
    const nurse = db.prepare("SELECT id, name, employee_no, ward, phone FROM nurses WHERE id = ?").get(req.nurse_id);
    let escort = null;
    if (req.escort_id) {
      escort = db.prepare("SELECT id, name, employee_no, phone, status, is_specialist, current_location FROM escorts WHERE id = ?").get(req.escort_id);
    }
    let checkOrder = null;
    if (req.check_order_id) {
      checkOrder = db.prepare("SELECT id, order_no, check_type, check_item, check_room, target_department, priority, status FROM check_orders WHERE id = ?").get(req.check_order_id);
    }
    const waitDuration = calculateWaitDuration(req);
    return { ...req, patient, nurse, escort, check_order: checkOrder, wait_duration: waitDuration };
  });
}

function attachEscortInfo(suggestions: any[]): AssignmentSuggestion[] {
  return suggestions.map((s) => {
    const escort = db.prepare("SELECT id, name, employee_no, phone, status, is_specialist, current_location FROM escorts WHERE id = ?").get(s.escort_id);
    return { ...s, escort };
  });
}

router.get("/", (req: Request, res: Response) => {
  const { status, ward, escortId, nurseId, patientId } = req.query;
  let sql = "SELECT cr.* FROM check_requests cr LEFT JOIN patients p ON cr.patient_id = p.id WHERE 1=1";
  const params: any[] = [];

  if (status) {
    sql += " AND cr.status = ?";
    params.push(status);
  }
  if (ward) {
    sql += " AND p.ward = ?";
    params.push(ward);
  }
  if (escortId) {
    sql += " AND cr.escort_id = ?";
    params.push(escortId);
  }
  if (nurseId) {
    sql += " AND cr.nurse_id = ?";
    params.push(nurseId);
  }
  if (patientId) {
    sql += " AND cr.patient_id = ?";
    params.push(patientId);
  }
  sql += " ORDER BY cr.priority DESC, cr.created_at DESC";

  const requests = db.prepare(sql).all(...params);
  const result = attachPatientInfo(requests);
  res.json({ success: true, data: result });
});

router.get("/stats/summary", (req: Request, res: Response) => {
  const pending = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status = 'pending'").get() as { count: number };
  const toReschedule = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status = 'to_reschedule'").get() as { count: number };
  const inProgress = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status IN ('assigned', 'accepted', 'in_progress')").get() as { count: number };
  const inTransport = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status = 'in_transport'").get() as { count: number };
  const completed = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status = 'completed'").get() as { count: number };
  const settled = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status = 'settled'").get() as { count: number };

  const completedRequests = db.prepare(
    "SELECT wait_started_at, accepted_at, completed_at, rescheduled_wait_duration FROM check_requests WHERE status IN ('completed', 'settled') AND wait_started_at IS NOT NULL AND (accepted_at IS NOT NULL OR completed_at IS NOT NULL)"
  ).all() as any[];

  let avgWaitDuration = 0;
  if (completedRequests.length > 0) {
    const durations = completedRequests.map((r) => {
      const start = new Date(r.wait_started_at).getTime();
      const endTime = r.accepted_at || r.completed_at;
      const end = new Date(endTime).getTime();
      const baseDuration = Math.round((end - start) / 60000);
      return baseDuration + (r.rescheduled_wait_duration || 0);
    }).filter((d) => d >= 0);
    if (durations.length > 0) {
      avgWaitDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString().slice(0, 10);

  const todayRequests = db.prepare(
    "SELECT COUNT(*) as count FROM check_requests WHERE DATE(created_at) = ?"
  ).get(todayStr) as { count: number };

  const todayCompleted = db.prepare(
    "SELECT COUNT(*) as count FROM check_requests WHERE DATE(completed_at) = ?"
  ).get(todayStr) as { count: number };

  res.json({
    success: true,
    data: {
      pending_count: pending.count,
      to_reschedule_count: toReschedule.count,
      in_progress_count: inProgress.count,
      in_transport_count: inTransport.count,
      completed_count: completed.count,
      settled_count: settled.count,
      avg_wait_duration: avgWaitDuration,
      today_requests: todayRequests.count,
      today_completed: todayCompleted.count,
    },
  });
});

router.get("/:id", (req: Request, res: Response) => {
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  const result = attachPatientInfo([request])[0];
  res.json({ success: true, data: result });
});

router.get("/:id/logs", (req: Request, res: Response) => {
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  const logs = db.prepare("SELECT * FROM request_logs WHERE request_id = ? ORDER BY created_at ASC").all(req.params.id);
  res.json({ success: true, data: logs });
});

router.post("/", (req: Request, res: Response) => {
  const { patient_id, nurse_id, check_order_id, check_type, check_item, check_room, source_department, target_department, urgency, remark } = req.body;

  if (!patient_id || !nurse_id) {
    throw new BusinessError("患者和护士为必填项");
  }
  if (!check_order_id) {
    throw new BusinessError("必须关联已开立的检查单");
  }

  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(patient_id) as any;
  if (!patient) {
    throw new BusinessError("患者不存在");
  }

  const nurse = db.prepare("SELECT * FROM nurses WHERE id = ?").get(nurse_id) as any;
  if (!nurse) {
    throw new BusinessError("护士不存在");
  }

  const order = db.prepare("SELECT * FROM check_orders WHERE id = ?").get(check_order_id) as any;
  if (!order) {
    throw new BusinessError("检查单不存在");
  }
  if (order.patient_id !== patient_id) {
    throw new BusinessError("检查单与患者不匹配");
  }
  if (order.status !== "pending") {
    throw new BusinessError(`检查单状态异常，仅开立状态的检查单可以提交陪检申请，当前状态：${order.status || '未知'}`);
  }
  const orderInfo = order;

  const id = uuidv4();
  const currentTime = now();

  const finalCheckType = orderInfo?.check_type || check_type;
  const finalCheckItem = orderInfo?.check_item || check_item;
  const finalCheckRoom = orderInfo?.check_room || check_room;
  const finalUrgency = (orderInfo?.priority || urgency || "normal") as UrgencyLevel;
  const priorityValue = finalUrgency === "emergency" ? 3 : finalUrgency === "urgent" ? 2 : 1;
  const finalSourceDept = source_department || patient.department || patient.ward;
  const finalTargetDept = target_department || orderInfo?.target_department;

  const isIsolated = patient.is_isolated === 1;

  db.prepare(
    `INSERT INTO check_requests 
    (id, patient_id, nurse_id, check_order_id, check_type, check_item, check_room, source_department, target_department, urgency, priority, status, wait_started_at, remark, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).run(id, patient_id, nurse_id, check_order_id || null, finalCheckType, finalCheckItem, finalCheckRoom, finalSourceDept || null, finalTargetDept || null, finalUrgency, priorityValue, currentTime, remark || null, currentTime, currentTime);

  const remarkLog = isIsolated ? "护士提交陪检申请（隔离患者）" : `护士提交陪检申请（${finalUrgency === 'emergency' ? '紧急' : finalUrgency === 'urgent' ? '加急' : '普通'}）`;
  addLog(id, "create", nurse_id, "nurse", nurse.name, remarkLog);

  if (orderInfo) {
    db.prepare("UPDATE check_orders SET status = 'requested', updated_at = ? WHERE id = ?").run(currentTime, check_order_id);
  }

  const created = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(id);
  const result = attachPatientInfo([created])[0];
  res.status(201).json({ success: true, data: result });
});

router.get("/:id/suggestions", (req: Request, res: Response) => {
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as CheckRequest;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (request.status !== "pending") {
    throw new BusinessError("只有待派单状态的申请可以获取派单建议");
  }

  const suggestions = generateAssignmentSuggestions(req.params.id);
  const result = attachEscortInfo(suggestions);
  res.json({ success: true, data: result });
});

router.get("/:id/transports", (req: Request, res: Response) => {
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  const transports = db.prepare("SELECT * FROM transports WHERE request_id = ? ORDER BY created_at ASC").all(req.params.id);
  const result = transports.map((t: any) => {
    const escort = db.prepare("SELECT id, name, employee_no FROM escorts WHERE id = ?").get(t.escort_id);
    return { ...t, escort };
  });
  res.json({ success: true, data: result });
});

router.post("/:id/transports", (req: Request, res: Response) => {
  const { from_department, to_department, transport_type, escort_id, operator_id, operator_name, remark } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as CheckRequest;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (!["accepted", "in_progress", "in_transport"].includes(request.status)) {
    throw new BusinessError("当前状态无法开始转运");
  }
  if (!from_department || !to_department || !transport_type) {
    throw new BusinessError("起始科室、目标科室和转运类型为必填项");
  }

  const isCrossDept = from_department !== to_department;
  const currentTime = now();
  const id = uuidv4();
  const actualEscortId = escort_id || request.escort_id;

  if (!actualEscortId) {
    throw new BusinessError("请指定转运陪检员");
  }

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO transports 
      (id, request_id, escort_id, from_department, to_department, is_cross_department, transport_type, status, created_at, updated_at, remark) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).run(id, req.params.id, actualEscortId, from_department, to_department, isCrossDept ? 1 : 0, transport_type, currentTime, currentTime, remark || null);

    if (isCrossDept) {
      db.prepare("UPDATE check_requests SET is_cross_department = 1, updated_at = ? WHERE id = ?").run(currentTime, req.params.id);
    }

    addLog(req.params.id, "transport_create", operator_id, "escort", operator_name, `创建${transport_type === 'pickup' ? '接患者' : transport_type === 'sendback' ? '送回' : '转运'}记录：${from_department} → ${to_department}`);
  });

  tx();

  const created = db.prepare("SELECT * FROM transports WHERE id = ?").get(id);
  res.status(201).json({ success: true, data: created });
});

router.put("/:id/transports/:transportId/start", (req: Request, res: Response) => {
  const { operator_id, operator_name } = req.body;
  const transport = db.prepare("SELECT * FROM transports WHERE id = ? AND request_id = ?").get(req.params.transportId, req.params.id) as Transport;
  if (!transport) {
    throw new BusinessError("转运记录不存在", "TRANSPORT_NOT_FOUND", 404);
  }
  if (transport.status !== "pending") {
    throw new BusinessError("只有待处理的转运可以开始");
  }

  const currentTime = now();

  const tx = db.transaction(() => {
    db.prepare("UPDATE transports SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?").run(currentTime, currentTime, req.params.transportId);
    db.prepare("UPDATE check_requests SET status = 'in_transport', transport_started_at = ?, updated_at = ? WHERE id = ?").run(currentTime, currentTime, req.params.id);
    addLog(req.params.id, "transport_start", operator_id, "escort", operator_name, `开始转运：${transport.from_department} → ${transport.to_department}`);
  });

  tx();

  const updated = db.prepare("SELECT * FROM transports WHERE id = ?").get(req.params.transportId);
  res.json({ success: true, data: updated });
});

router.put("/:id/transports/:transportId/complete", (req: Request, res: Response) => {
  const { operator_id, operator_name, remark } = req.body;
  const transport = db.prepare("SELECT * FROM transports WHERE id = ? AND request_id = ?").get(req.params.transportId, req.params.id) as Transport;
  if (!transport) {
    throw new BusinessError("转运记录不存在", "TRANSPORT_NOT_FOUND", 404);
  }
  if (transport.status !== "in_progress") {
    throw new BusinessError("只有进行中的转运可以完成");
  }

  const currentTime = now();
  let duration = null;
  if (transport.started_at) {
    const start = new Date(transport.started_at).getTime();
    const end = new Date(currentTime).getTime();
    duration = Math.round((end - start) / 60000);
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE transports SET status = 'completed', completed_at = ?, duration_minutes = ?, updated_at = ?, remark = ? WHERE id = ?").run(currentTime, duration, currentTime, remark || transport.remark, req.params.transportId);
    db.prepare("UPDATE check_requests SET status = 'in_progress', transport_completed_at = ?, updated_at = ? WHERE id = ?").run(currentTime, currentTime, req.params.id);
    addLog(req.params.id, "transport_complete", operator_id, "escort", operator_name, `完成转运：${transport.from_department} → ${transport.to_department}，耗时${duration || '?'}分钟`);
  });

  tx();

  const updated = db.prepare("SELECT * FROM transports WHERE id = ?").get(req.params.transportId);
  res.json({ success: true, data: updated });
});

router.put("/:id/reschedule", (req: Request, res: Response) => {
  const { original_check_time, new_check_time, reason, operator_id, operator_name } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as CheckRequest;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (!["pending", "assigned", "accepted", "to_reschedule"].includes(request.status)) {
    throw new BusinessError("当前状态无法转待重排");
  }
  if (!reason) {
    throw new BusinessError("请填写重排原因");
  }

  const currentTime = now();
  const rescheduleId = uuidv4();

  let waitDurationBefore = 0;
  if (request.wait_started_at) {
    const start = new Date(request.wait_started_at).getTime();
    const end = new Date(currentTime).getTime();
    waitDurationBefore = Math.round((end - start) / 60000);
  }
  const accumulatedWait = (request.rescheduled_wait_duration || 0) + waitDurationBefore;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO reschedule_records 
      (id, request_id, original_check_time, new_check_time, reason, operator_id, operator_name, wait_duration_before, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(rescheduleId, req.params.id, original_check_time || null, new_check_time || null, reason, operator_id || null, operator_name || null, waitDurationBefore, currentTime);

    db.prepare(
      "UPDATE check_requests SET status = 'to_reschedule', rescheduled_wait_duration = ?, wait_started_at = NULL, assigned_at = NULL, accepted_at = NULL, escort_id = NULL, updated_at = ? WHERE id = ?"
    ).run(accumulatedWait, currentTime, req.params.id);

    if (request.escort_id) {
      db.prepare("UPDATE escorts SET status = 'online', current_task_id = NULL, updated_at = ? WHERE id = ?").run(currentTime, request.escort_id);
    }

    if (request.check_order_id) {
      db.prepare("UPDATE check_orders SET status = 'rescheduled', updated_at = ? WHERE id = ?").run(currentTime, request.check_order_id);
    }

    addLog(req.params.id, "to_reschedule", operator_id, "nurse", operator_name, `转待重排：${reason}，已等待${accumulatedWait}分钟`);
  });

  tx();

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

router.put("/:id/reassign", (req: Request, res: Response) => {
  const { operator_id, operator_name } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as CheckRequest;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (request.status !== "to_reschedule") {
    throw new BusinessError("只有待重排状态的申请可以重新派单");
  }

  const currentTime = now();

  db.prepare("UPDATE check_requests SET status = 'pending', wait_started_at = ?, updated_at = ? WHERE id = ?").run(currentTime, currentTime, req.params.id);

  if (request.check_order_id) {
    db.prepare("UPDATE check_orders SET status = 'requested', updated_at = ? WHERE id = ?").run(currentTime, request.check_order_id);
  }

  addLog(req.params.id, "reassign", operator_id, "supervisor", operator_name, `重新进入待派单，累计等待${request.rescheduled_wait_duration || 0}分钟`);

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

router.get("/:id/shift-changes", (req: Request, res: Response) => {
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  const shiftChanges = db.prepare("SELECT * FROM shift_changes WHERE request_id = ? ORDER BY created_at ASC").all(req.params.id);
  const result = shiftChanges.map((sc: any) => {
    const fromEscort = db.prepare("SELECT id, name, employee_no FROM escorts WHERE id = ?").get(sc.from_escort_id);
    const toEscort = db.prepare("SELECT id, name, employee_no FROM escorts WHERE id = ?").get(sc.to_escort_id);
    return { ...sc, from_escort: fromEscort, to_escort: toEscort };
  });
  res.json({ success: true, data: result });
});

router.post("/:id/shift-change", (req: Request, res: Response) => {
  const { to_escort_id, reason, handover_note, operator_id, operator_name } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as CheckRequest;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (!["assigned", "accepted", "in_progress", "in_transport"].includes(request.status)) {
    throw new BusinessError("当前状态无法进行替班交接");
  }
  if (!request.escort_id) {
    throw new BusinessError("当前申请没有分配陪检员");
  }
  if (!to_escort_id) {
    throw new BusinessError("请选择接班陪检员");
  }
  if (to_escort_id === request.escort_id) {
    throw new BusinessError("接班陪检员不能与当前陪检员相同");
  }

  const toEscort = db.prepare("SELECT * FROM escorts WHERE id = ?").get(to_escort_id) as any;
  if (!toEscort) {
    throw new BusinessError("接班陪检员不存在");
  }
  if (toEscort.status !== "online") {
    throw new BusinessError("接班陪检员当前不在线");
  }

  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(request.patient_id) as any;
  if (patient.is_isolated && !toEscort.is_specialist) {
    throw new BusinessError("隔离患者必须安排专人陪检，请选择具备资质的陪检员");
  }

  const currentTime = now();
  const shiftChangeId = uuidv4();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO shift_changes 
      (id, request_id, from_escort_id, to_escort_id, operator_id, operator_name, reason, handover_note, handover_time, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(shiftChangeId, req.params.id, request.escort_id, to_escort_id, operator_id || null, operator_name || null, reason || null, handover_note || null, currentTime, currentTime);

    db.prepare("UPDATE check_requests SET escort_id = ?, has_shift_change = 1, updated_at = ? WHERE id = ?").run(to_escort_id, currentTime, req.params.id);

    db.prepare("UPDATE escorts SET status = 'online', current_task_id = NULL, updated_at = ? WHERE id = ?").run(currentTime, request.escort_id);
    db.prepare("UPDATE escorts SET status = 'busy', current_task_id = ?, updated_at = ? WHERE id = ?").run(req.params.id, currentTime, to_escort_id);

    const fromEscort = db.prepare("SELECT name FROM escorts WHERE id = ?").get(request.escort_id);
    addLog(req.params.id, "shift_change", operator_id, "supervisor", operator_name, `替班交接：${fromEscort?.name || '?'} → ${toEscort.name}${reason ? '，原因：' + reason : ''}`);
  });

  tx();

  const created = db.prepare("SELECT * FROM shift_changes WHERE id = ?").get(shiftChangeId);
  const fromEscort = db.prepare("SELECT id, name, employee_no FROM escorts WHERE id = ?").get(created.from_escort_id);
  const toEscortResult = db.prepare("SELECT id, name, employee_no FROM escorts WHERE id = ?").get(created.to_escort_id);
  const result = { ...created, from_escort: fromEscort, to_escort: toEscortResult };

  res.status(201).json({ success: true, data: result });
});

router.get("/:id/validate-settlement", (req: Request, res: Response) => {
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as CheckRequest;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (request.status !== "completed") {
    throw new BusinessError("只有已完成的申请可以进行结算校验");
  }

  const transports = db.prepare("SELECT * FROM transports WHERE request_id = ?").all(req.params.id) as Transport[];
  const shiftChanges = db.prepare("SELECT * FROM shift_changes WHERE request_id = ?").all(req.params.id) as ShiftChange[];
  const overtimeResult = detectOvertimeWait(req.params.id);

  const hasTransport = transports.length > 0;
  const hasCrossDept = transports.some((t) => t.is_cross_department === 1);
  const hasOvertime = overtimeResult?.is_overtime || false;
  const overtimeMinutes = overtimeResult?.overtime_minutes || 0;
  const hasShiftChange = shiftChanges.length > 0;
  const shiftChangeCount = shiftChanges.length;

  const warnings: string[] = [];
  const errors: string[] = [];

  if (!hasTransport) {
    warnings.push("未找到转运记录，请确认是否有跨科室转运");
  }

  if (hasOvertime) {
    warnings.push(`存在超时等候：${overtimeMinutes}分钟（阈值：${OVERTIME_THRESHOLDS[request.urgency]}分钟）`);
  }

  if (hasShiftChange) {
    warnings.push(`存在${shiftChangeCount}次替班交接，请确认交接是否完整`);
  }

  const isCrossDeptMarked = request.is_cross_department === 1;
  if (hasCrossDept && !isCrossDeptMarked) {
    errors.push("存在跨科室转运但未标记，请核实");
  }

  if (request.escort_id && transports.length > 0) {
    const allTransportsHaveEscort = transports.every((t) => t.escort_id === request.escort_id || shiftChanges.some((sc) => sc.to_escort_id === t.escort_id));
    if (!allTransportsHaveEscort) {
      errors.push("存在转运记录与陪检员不匹配，请核实");
    }
  }

  const isValid = errors.length === 0;

  const result: SettlementValidation = {
    request_id: req.params.id,
    has_transport_record: hasTransport,
    has_cross_department: hasCrossDept,
    has_overtime_wait: hasOvertime,
    overtime_minutes: overtimeMinutes,
    has_shift_change: hasShiftChange,
    shift_change_count: shiftChangeCount,
    is_valid: isValid,
    warnings,
    errors,
  };

  res.json({ success: true, data: result });
});

router.get("/:id/audit-trail", (req: Request, res: Response) => {
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }

  const requestData = attachPatientInfo([request])[0];
  const logs = db.prepare("SELECT * FROM request_logs WHERE request_id = ? ORDER BY created_at ASC").all(req.params.id);

  const transports = db.prepare("SELECT * FROM transports WHERE request_id = ? ORDER BY created_at ASC").all(req.params.id);
  const transportsWithEscort = transports.map((t: any) => {
    const escort = db.prepare("SELECT id, name, employee_no FROM escorts WHERE id = ?").get(t.escort_id);
    return { ...t, escort };
  });

  const shiftChanges = db.prepare("SELECT * FROM shift_changes WHERE request_id = ? ORDER BY created_at ASC").all(req.params.id);
  const shiftChangesWithEscorts = shiftChanges.map((sc: any) => {
    const fromEscort = db.prepare("SELECT id, name, employee_no FROM escorts WHERE id = ?").get(sc.from_escort_id);
    const toEscort = db.prepare("SELECT id, name, employee_no FROM escorts WHERE id = ?").get(sc.to_escort_id);
    return { ...sc, from_escort: fromEscort, to_escort: toEscort };
  });

  const reschedules = db.prepare("SELECT * FROM reschedule_records WHERE request_id = ? ORDER BY created_at ASC").all(req.params.id);
  const suggestions = db.prepare("SELECT * FROM assignment_suggestions WHERE request_id = ? ORDER BY score DESC").all(req.params.id);
  const suggestionsWithEscort = attachEscortInfo(suggestions);

  const result: AuditTrail = {
    request_id: req.params.id,
    request: requestData,
    logs,
    transports: transportsWithEscort,
    shift_changes: shiftChangesWithEscorts,
    reschedules,
    assignment_suggestions: suggestionsWithEscort,
  };

  res.json({ success: true, data: result });
});

router.put("/:id/assign", (req: Request, res: Response) => {
  const { escort_id, operator_id, operator_name, selected_suggestion_id, is_manual_assign } = req.body;
  if (!escort_id) {
    throw new BusinessError("请选择陪检员");
  }

  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as any;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (!["pending", "to_reschedule"].includes(request.status)) {
    throw new BusinessError("只有待派单或待重排状态的申请可以派单");
  }

  if (!request.check_order_id) {
    throw new BusinessError("申请未关联检查单，无法派单，请先开立检查单");
  }
  const checkOrder = db.prepare("SELECT * FROM check_orders WHERE id = ?").get(request.check_order_id) as any;
  if (!checkOrder) {
    throw new BusinessError("关联的检查单不存在，无法派单");
  }
  if (checkOrder.status !== "pending" && checkOrder.status !== "requested") {
    throw new BusinessError(`检查单状态异常，仅开立或已申请状态的检查单可以派单，当前状态：${checkOrder.status || '未知'}`);
  }

  const escort = db.prepare("SELECT * FROM escorts WHERE id = ?").get(escort_id) as any;
  if (!escort) {
    throw new BusinessError("陪检员不存在");
  }
  if (escort.status !== "online") {
    throw new BusinessError("陪检员当前不在线，无法派单");
  }

  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(request.patient_id) as any;
  if (patient.is_isolated && !escort.is_specialist) {
    throw new BusinessError("隔离患者必须安排专人陪检，请选择具备资质的陪检员");
  }

  const currentTime = now();
  const isManual = is_manual_assign === true;
  const waitStartTime = request.status === "to_reschedule" ? currentTime : (request.wait_started_at || currentTime);

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE check_requests SET status = 'assigned', escort_id = ?, assigned_at = ?, wait_started_at = ?, updated_at = ? WHERE id = ?"
    ).run(escort_id, currentTime, waitStartTime, currentTime, req.params.id);

    db.prepare("UPDATE escorts SET status = 'busy', current_task_id = ?, updated_at = ? WHERE id = ?").run(req.params.id, currentTime, escort_id);

    if (selected_suggestion_id) {
      db.prepare("UPDATE assignment_suggestions SET is_selected = 1, selected_at = ? WHERE id = ?").run(currentTime, selected_suggestion_id);
    }

    const assignType = isManual ? "手动派单" : "智能派单";
    addLog(req.params.id, "assign", operator_id, "supervisor", operator_name || "主管", `${assignType}给陪检员：${escort.name}${selected_suggestion_id ? `（建议ID：${selected_suggestion_id}）` : ''}`);
  });

  tx();

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

router.put("/:id/accept", (req: Request, res: Response) => {
  const { operator_id } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as any;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (request.status !== "assigned") {
    throw new BusinessError("只有已派单状态的申请可以接单");
  }

  const escort = db.prepare("SELECT * FROM escorts WHERE id = ?").get(request.escort_id) as any;
  const currentTime = now();

  db.prepare("UPDATE check_requests SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ?").run(currentTime, currentTime, req.params.id);
  addLog(req.params.id, "accept", operator_id || request.escort_id, "escort", escort?.name || "陪检员", "陪检员已接单");

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

router.put("/:id/start", (req: Request, res: Response) => {
  const { operator_id } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as any;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (request.status !== "accepted") {
    throw new BusinessError("只有已接单状态的申请可以开始陪检");
  }

  const escort = db.prepare("SELECT * FROM escorts WHERE id = ?").get(request.escort_id) as any;
  const currentTime = now();

  db.prepare("UPDATE check_requests SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?").run(currentTime, currentTime, req.params.id);
  addLog(req.params.id, "start", operator_id || request.escort_id, "escort", escort?.name || "陪检员", "开始陪检");

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

router.put("/:id/complete", (req: Request, res: Response) => {
  const { operator_id, remark } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as any;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (!["in_progress", "in_transport"].includes(request.status)) {
    throw new BusinessError("只有进行中或转运中的申请可以完成");
  }

  const escort = db.prepare("SELECT * FROM escorts WHERE id = ?").get(request.escort_id) as any;
  const currentTime = now();

  const tx = db.transaction(() => {
    db.prepare("UPDATE check_requests SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?").run(currentTime, currentTime, req.params.id);

    if (request.escort_id) {
      db.prepare("UPDATE escorts SET status = 'online', current_task_id = NULL, updated_at = ? WHERE id = ?").run(currentTime, request.escort_id);
    }

    if (request.check_order_id) {
      db.prepare("UPDATE check_orders SET status = 'completed', updated_at = ? WHERE id = ?").run(currentTime, request.check_order_id);
    }

    const pendingTransports = db.prepare("SELECT * FROM transports WHERE request_id = ? AND status = 'in_progress'").all(req.params.id);
    pendingTransports.forEach((t: any) => {
      db.prepare("UPDATE transports SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?").run(currentTime, currentTime, t.id);
    });

    addLog(req.params.id, "complete", operator_id || request.escort_id, "escort", escort?.name || "陪检员", remark || "陪检完成");
  });

  tx();

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

router.put("/:id/settle", (req: Request, res: Response) => {
  const { operator_id, operator_name, settlement_amount, remark, force_settle } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as any;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (request.status !== "completed") {
    throw new BusinessError("只有已完成的申请可以结算，陪检完成前不能结算");
  }

  const transports = db.prepare("SELECT * FROM transports WHERE request_id = ?").all(req.params.id) as Transport[];
  const shiftChanges = db.prepare("SELECT * FROM shift_changes WHERE request_id = ?").all(req.params.id) as ShiftChange[];
  const overtimeResult = detectOvertimeWait(req.params.id);

  const hasOvertime = overtimeResult?.is_overtime || false;
  const hasShiftChange = shiftChanges.length > 0;
  const hasCrossDept = transports.some((t) => t.is_cross_department === 1);

  const validationErrors: string[] = [];
  const isCrossDeptMarked = request.is_cross_department === 1;
  if (hasCrossDept && !isCrossDeptMarked) {
    validationErrors.push("存在跨科室转运但未标记");
  }

  if (validationErrors.length > 0 && !force_settle) {
    throw new BusinessError(`结算校验失败：${validationErrors.join('；')}。如需强制结算，请指定force_settle=true`);
  }

  const currentTime = now();

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE check_requests SET status = 'settled', settled_at = ?, settlement_amount = ?, has_overtime_wait = ?, has_shift_change = ?, updated_at = ? WHERE id = ?"
    ).run(currentTime, settlement_amount || null, hasOvertime ? 1 : 0, hasShiftChange ? 1 : 0, currentTime, req.params.id);

    const logRemark = remark || "已结算";
    const extraInfo: string[] = [];
    if (hasCrossDept) extraInfo.push("跨科室转运");
    if (hasOvertime) extraInfo.push(`超时${overtimeResult?.overtime_minutes || 0}分钟`);
    if (hasShiftChange) extraInfo.push(`${shiftChanges.length}次替班`);
    const fullRemark = extraInfo.length > 0 ? `${logRemark}（${extraInfo.join('，')}）` : logRemark;

    addLog(req.params.id, "settle", operator_id, "supervisor", operator_name || "主管", fullRemark);
  });

  tx();

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

router.put("/:id/cancel", (req: Request, res: Response) => {
  const { operator_id, operator_name, reason } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as any;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (!["pending", "assigned", "accepted", "to_reschedule"].includes(request.status)) {
    throw new BusinessError("当前状态无法取消");
  }

  const currentTime = now();

  const tx = db.transaction(() => {
    if (request.escort_id && ["assigned", "accepted"].includes(request.status)) {
      db.prepare("UPDATE escorts SET status = 'online', current_task_id = NULL, updated_at = ? WHERE id = ?").run(currentTime, request.escort_id);
    }

    if (request.check_order_id) {
      db.prepare("UPDATE check_orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(currentTime, request.check_order_id);
    }

    const pendingTransports = db.prepare("SELECT * FROM transports WHERE request_id = ? AND status IN ('pending', 'in_progress')").all(req.params.id);
    pendingTransports.forEach((t: any) => {
      db.prepare("UPDATE transports SET status = 'cancelled', updated_at = ? WHERE id = ?").run(currentTime, t.id);
    });

    db.prepare("UPDATE check_requests SET status = 'cancelled', updated_at = ? WHERE id = ?").run(currentTime, req.params.id);

    addLog(req.params.id, "cancel", operator_id, "supervisor", operator_name || "主管", reason || "取消申请");
  });

  tx();

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

export default router;
