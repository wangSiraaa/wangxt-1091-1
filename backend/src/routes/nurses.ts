import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const nurses = db.prepare('SELECT * FROM nurses ORDER BY name').all();
  res.json({ success: true, data: nurses });
});

export default router;
