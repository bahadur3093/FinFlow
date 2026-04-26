import { Router } from 'express';
import {
  getProfile,
  saveProfile,
  startScrape,
  getJobs,
  getSessions,
  getJob,
  recaptureScreenshot,
  updateJobStatus,
  deleteJob,
  deleteAllJobs,
  clearSession,
  listPlatforms,
  startPlatformConnect,
  removePlatformSession,
} from '../controllers/jobsController.js';

const router = Router();

router.get('/profile', getProfile);
router.post('/profile', saveProfile);
router.get('/platforms', listPlatforms);
router.post('/platforms/:platform/connect', startPlatformConnect);
router.delete('/platforms/:platform', removePlatformSession);
router.post('/scrape', startScrape);
router.get('/', getJobs);
router.delete('/', deleteAllJobs);
router.get('/sessions', getSessions);
router.get('/:id', getJob);
router.post('/:id/screenshot', recaptureScreenshot);
router.patch('/:id/status', updateJobStatus);
router.delete('/sessions/:sessionId', clearSession);
router.delete('/:id', deleteJob);

export default router;
