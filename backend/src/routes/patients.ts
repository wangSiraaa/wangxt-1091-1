import { Router, Request, Response } from "express";
import { db } from "../database";
import { BusinessError } from "../middleware/errorHandler";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const { ward, isIsolated, keyword } = req.query;
  let sql = "SELECT * FROM patients WHERE 1=1";
  const params: any[] = [];

  if (ward) {
    sql += " AND ward = ?";
    params.push(ward);
  }
  if (isIsolated !== undefined) {
    sql += " AND is_isolated = ?";
    params.push(isIsolated === "true" ? 1 : 0);
  }
  if (keyword) {
    sql += " AND (name LIKE ? OR bed_no LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  sql += " ORDER BY bed_no";

  const patients = db.prepare(sql).all(...params);
  res.json({ success: true, data: patients });
});

router.get("/:id", (req: Request, res: Response) => {
  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
  if (!patient) {
    throw new BusinessError("患者不存在", "PATIENT_NOT_FOUND", 404);
  }
  res.json({ success: true, data: patient });
});

export default router;
