import { Router, Request, Response } from "express";
import { db, now, uuidv4 } from "../database";
import { BusinessError } from "../middleware/errorHandler";

const router = Router();

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
  return Math.round((end - start) / 60000);
}

function attachPatientInfo(requests: any[]) {
  return requests.map((req) => {
    const patient = db.prepare("SELECT id, name, gender, age, bed_no, ward, department, is_isolated FROM patients WHERE id = ?").get(req.patient_id);
    const nurse = db.prepare("SELECT id, name, employee_no, ward, phone FROM nurses WHERE id = ?").get(req.nurse_id);
    let escort = null;
    if (req.escort_id) {
      escort = db.prepare("SELECT id, name, employee_no, phone, status, is_specialist FROM escorts WHERE id = ?").get(req.escort_id);
    }
    let checkOrder = null;
    if (req.check_order_id) {
      checkOrder = db.prepare("SELECT id, order_no, check_type, check_item, check_room, priority, status FROM check_orders WHERE id = ?").get(req.check_order_id);
    }
    const waitDuration = calculateWaitDuration(req);
    return { ...req, patient, nurse, escort, check_order: checkOrder, wait_duration: waitDuration };
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
  const inProgress = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status IN ('assigned', 'accepted', 'in_progress')").get() as { count: number };
  const completed = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status = 'completed'").get() as { count: number };
  const settled = db.prepare("SELECT COUNT(*) as count FROM check_requests WHERE status = 'settled'").get() as { count: number };

  const completedRequests = db.prepare(
    "SELECT wait_started_at, accepted_at, completed_at FROM check_requests WHERE status IN ('completed', 'settled') AND wait_started_at IS NOT NULL AND (accepted_at IS NOT NULL OR completed_at IS NOT NULL)"
  ).all() as any[];

  let avgWaitDuration = 0;
  if (completedRequests.length > 0) {
    const durations = completedRequests.map((r) => {
      const start = new Date(r.wait_started_at).getTime();
      const endTime = r.accepted_at || r.completed_at;
      const end = new Date(endTime).getTime();
      return Math.round((end - start) / 60000);
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
      in_progress_count: inProgress.count,
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
  const { patient_id, nurse_id, check_order_id, check_type, check_item, check_room, urgency, priority, remark } = req.body;

  if (!patient_id || !nurse_id || !check_type) {
    throw new BusinessError("患者、护士和检查类型为必填项");
  }

  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(patient_id) as any;
  if (!patient) {
    throw new BusinessError("患者不存在");
  }

  const nurse = db.prepare("SELECT * FROM nurses WHERE id = ?").get(nurse_id) as any;
  if (!nurse) {
    throw new BusinessError("护士不存在");
  }

  let orderInfo = null;
  if (check_order_id) {
    const order = db.prepare("SELECT * FROM check_orders WHERE id = ?").get(check_order_id) as any;
    if (!order) {
      throw new BusinessError("检查单不存在");
    }
    orderInfo = order;
  }

  const id = uuidv4();
  const currentTime = now();

  const finalCheckType = orderInfo?.check_type || check_type;
  const finalCheckItem = orderInfo?.check_item || check_item;
  const finalCheckRoom = orderInfo?.check_room || check_room;
  const finalUrgency = orderInfo?.priority || urgency || "normal";
  const priorityValue = finalUrgency === "emergency" ? 3 : finalUrgency === "urgent" ? 2 : 1;

  db.prepare(
    `INSERT INTO check_requests 
    (id, patient_id, nurse_id, check_order_id, check_type, check_item, check_room, urgency, priority, status, wait_started_at, remark, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).run(id, patient_id, nurse_id, check_order_id || null, finalCheckType, finalCheckItem, finalCheckRoom, finalUrgency, priorityValue, currentTime, remark || null, currentTime, currentTime);

  addLog(id, "create", nurse_id, "nurse", nurse.name, "护士提交陪检申请");

  if (orderInfo) {
    db.prepare("UPDATE check_orders SET status = 'requested', updated_at = ? WHERE id = ?").run(currentTime, check_order_id);
  }

  const created = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(id);
  const result = attachPatientInfo([created])[0];
  res.status(201).json({ success: true, data: result });
});

router.put("/:id/assign", (req: Request, res: Response) => {
  const { escort_id, operator_id, operator_name } = req.body;
  if (!escort_id) {
    throw new BusinessError("请选择陪检员");
  }

  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as any;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (request.status !== "pending") {
    throw new BusinessError("只有待派单状态的申请可以派单");
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

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE check_requests SET status = 'assigned', escort_id = ?, assigned_at = ?, updated_at = ? WHERE id = ?"
    ).run(escort_id, currentTime, currentTime, req.params.id);

    db.prepare("UPDATE escorts SET status = 'busy', current_task_id = ?, updated_at = ? WHERE id = ?").run(req.params.id, currentTime, escort_id);

    addLog(req.params.id, "assign", operator_id, "supervisor", operator_name || "主管", `派单给陪检员：${escort.name}`);
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
  if (request.status !== "in_progress") {
    throw new BusinessError("只有进行中的申请可以完成");
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

    addLog(req.params.id, "complete", operator_id || request.escort_id, "escort", escort?.name || "陪检员", remark || "陪检完成");
  });

  tx();

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

router.put("/:id/settle", (req: Request, res: Response) => {
  const { operator_id, operator_name, settlement_amount, remark } = req.body;
  const request = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id) as any;
  if (!request) {
    throw new BusinessError("申请不存在", "REQUEST_NOT_FOUND", 404);
  }
  if (request.status !== "completed") {
    throw new BusinessError("只有已完成的申请可以结算，陪检完成前不能结算");
  }

  const currentTime = now();

  db.prepare(
    "UPDATE check_requests SET status = 'settled', settled_at = ?, settlement_amount = ?, updated_at = ? WHERE id = ?"
  ).run(currentTime, settlement_amount || null, currentTime, req.params.id);

  addLog(req.params.id, "settle", operator_id, "supervisor", operator_name || "主管", remark || "已结算");

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
  if (!["pending", "assigned", "accepted"].includes(request.status)) {
    throw new BusinessError("当前状态无法取消");
  }

  const currentTime = now();

  const tx = db.transaction(() => {
    if (request.escort_id && ["assigned", "accepted"].includes(request.status)) {
      db.prepare("UPDATE escorts SET status = 'online', current_task_id = NULL, updated_at = ? WHERE id = ?").run(currentTime, request.escort_id);
    }

    db.prepare("UPDATE check_requests SET status = 'cancelled', updated_at = ? WHERE id = ?").run(currentTime, req.params.id);

    addLog(req.params.id, "cancel", operator_id, "supervisor", operator_name || "主管", reason || "取消申请");
  });

  tx();

  const updated = db.prepare("SELECT * FROM check_requests WHERE id = ?").get(req.params.id);
  const result = attachPatientInfo([updated])[0];
  res.json({ success: true, data: result });
});

export default router;
