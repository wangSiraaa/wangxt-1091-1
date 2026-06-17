import { Router, Request, Response } from 'express';
import { db } from '../database';
import { BusinessError } from '../middleware/errorHandler';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, isSpecialist } = req.query;
  let sql = 'SELECT * FROM escorts WHERE 1=1';
  const params: any[] = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (isSpecialist !== undefined) {
    sql += ' AND is_specialist = ?';
    params.push(isSpecialist === 'true' ? 1 : 0);
  }
  sql += ' ORDER BY name';

  const escorts = db.prepare(sql).all(...params);
  res.json({ success: true, data: escorts });
});

router.put('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  if (!status) {
    throw new BusinessError('Status is required');
  }
  const validStatuses = ['online', 'offline', 'busy'];
  if (!validStatuses.includes(status)) {
    throw new BusinessError('Invalid status');
  }

  const escort = db.prepare('SELECT * FROM escorts WHERE id = ?').get(req.params.id);
  if (!escort) {
    throw new BusinessError('Escort not found', 'ESCORT_NOT_FOUND', 404);
  }

  db.prepare('UPDATE escorts SET status = ? WHERE id = ?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM escorts WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

export default router;
