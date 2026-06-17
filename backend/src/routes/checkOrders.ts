import { Router, Request, Response } from "express";
import { db } from "../database";
import { BusinessError } from "../middleware/errorHandler";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const { patientId, status, keyword } = req.query;
  let sql = "SELECT co.*, p.name as patient_name, p.bed_no, p.ward FROM check_orders co LEFT JOIN patients p ON co.patient_id = p.id WHERE 1=1";
  const params: any[] = [];

  if (patientId) {
    sql += " AND co.patient_id = ?";
    params.push(patientId);
  }
  if (status) {
    sql += " AND co.status = ?";
    params.push(status);
  }
  if (keyword) {
    sql += " AND (co.order_no LIKE ? OR co.check_item LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  sql += " ORDER BY co.created_at DESC";

  const orders = db.prepare(sql).all(...params);
  res.json({ success: true, data: orders });
});

router.get("/:id", (req: Request, res: Response) => {
  const order = db.prepare("SELECT co.*, p.name as patient_name, p.bed_no, p.ward FROM check_orders co LEFT JOIN patients p ON co.patient_id = p.id WHERE co.id = ?").get(req.params.id);
  if (!order) {
    throw new BusinessError("检查单不存在", "ORDER_NOT_FOUND", 404);
  }
  res.json({ success: true, data: order });
});

export default router;
