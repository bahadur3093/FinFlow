import { Router } from 'express';
import multer from 'multer';
import { unlockPdf } from '../controllers/toolsController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  },
});

router.post('/unlock-pdf', upload.single('pdf'), unlockPdf);

export default router;
