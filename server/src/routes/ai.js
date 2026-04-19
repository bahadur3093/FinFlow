import { Router } from 'express';
import multer from 'multer';
import { parseStatement, getInsights, ollamaChatHandler } from '../controllers/aiController.js';
import { parseCreditStatement } from '../controllers/creditCardController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadLarge = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/parse-statement', upload.single('statement'), parseStatement);
router.post('/parse-credit-statement', uploadLarge.single('statement'), parseCreditStatement);
router.get('/insights', getInsights);
router.post('/chat', ollamaChatHandler);

export default router;
