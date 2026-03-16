import { Router } from 'express';
import { subscribe, getVapidKey } from '../controllers/pushController.js';
const router = Router();
router.get('/vapid-key', getVapidKey);
router.post('/subscribe', subscribe);
export default router;
