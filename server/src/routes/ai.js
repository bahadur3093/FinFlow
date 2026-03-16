import { Router } from 'express';
import multer from 'multer';
import { parseStatement, getInsights } from '../controllers/aiController.js';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.post('/parse-statement', upload.single('statement'), parseStatement);
router.get('/insights', getInsights);
export default router;
