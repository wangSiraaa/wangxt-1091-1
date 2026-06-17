import { Router, Request, Response } from "express";
import { db } from "../database";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const wards = db.prepare("SELECT * FROM wards ORDER BY name").all();
  res.json({ success: true, data: wards });
});

export default router;
