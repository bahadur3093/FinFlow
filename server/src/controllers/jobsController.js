import { prisma } from '../services/db.js';
import { io } from '../index.js';
import { runJobScraper } from '../services/jobScraperService.js';
import { scoreJobs } from '../services/jobScoringService.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';
import { connectPlatform, disconnectPlatform, getPlatformStatuses, loadPlatformSessions } from '../services/platformSessionService.js';
import { chromium } from 'playwright';
import { randomUUID } from 'crypto';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Background: capture screenshots for a batch of jobs ────────────────────────
// Runs headless, 3 pages in parallel, uploads each to Cloudinary, patches DB,
// and emits a socket event per job so the detail page can update live.

async function captureJobScreenshots(jobs, userId, sessionId) {
  const CONCURRENCY = 3;
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Process in batches of CONCURRENCY
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const batch = jobs.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async ({ id, url }) => {
          const page = await context.newPage();
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
            await page.waitForTimeout(1800);
            await page.evaluate(() => window.scrollBy(0, 200));
            await page.waitForTimeout(400);

            const buf = await page.screenshot({ type: 'jpeg', quality: 80, fullPage: false });
            const { secure_url } = await uploadToCloudinary(buf, 'finflow/job-proofs');

            await prisma.jobPost.update({ where: { id }, data: { screenshotUrl: secure_url } });

            io.to(userId).emit('job:screenshot_ready', { jobId: id, screenshotUrl: secure_url, sessionId });
          } catch {
            // Skip — screenshot stays null for this job
          } finally {
            await page.close().catch(() => {});
          }
        })
      );
    }
  } catch {
    // Non-fatal: jobs are already saved, screenshots are optional
  } finally {
    if (browser) await browser.close().catch(() => {});
    io.to(userId).emit('job:screenshots_complete', { sessionId });
  }
}

// ── Profile ────────────────────────────────────────────────────────────────────

export const getProfile = async (req, res) => {
  try {
    const profile = await prisma.userJobProfile.findUnique({ where: { userId: req.user.id } });
    res.json(profile || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const saveProfile = async (req, res) => {
  try {
    const { skills, experienceYears, targetRole, preferredLocations, summary } = req.body;
    const profile = await prisma.userJobProfile.upsert({
      where: { userId: req.user.id },
      update: { skills: skills || [], experienceYears: parseInt(experienceYears) || 0, targetRole: targetRole || '', preferredLocations: preferredLocations || [], summary: summary || null },
      create: { userId: req.user.id, skills: skills || [], experienceYears: parseInt(experienceYears) || 0, targetRole: targetRole || '', preferredLocations: preferredLocations || [], summary: summary || null },
    });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Scrape ─────────────────────────────────────────────────────────────────────

export const startScrape = async (req, res) => {
  try {
    const profile = await prisma.userJobProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(400).json({ error: 'Please set up your job profile first' });

    const sessionId = randomUUID();
    const userId = req.user.id;
    const scoringProvider = (req.headers['x-ai-provider'] || 'groq').toLowerCase();
    res.json({ message: 'Scraping started', sessionId });

    (async () => {
      const emit = (event, data) => io.to(userId).emit(event, { ...data, sessionId });
      try {
        // 1. Scrape
        // Load saved platform login sessions (may be empty if user hasn't connected)
        const platformSessions = await loadPlatformSessions(userId);

        const rawJobs = await runJobScraper(io, userId, profile, sessionId, platformSessions);
        if (rawJobs.length === 0) {
          emit('scraper:complete', { message: 'No jobs found. Try adjusting your profile.', total: 0 });
          return;
        }

        // 2. AI score
        emit('scraper:scoring', { message: `Scoring ${rawJobs.length} jobs with AI (${scoringProvider})...`, total: rawJobs.length });
        const scoredJobs = await scoreJobs(rawJobs, profile, (job, idx) => {
          emit('scraper:job_scored', { job, index: idx, total: rawJobs.length });
        }, scoringProvider);

        // 3. Persist to DB
        const sample = scoredJobs[0];
        console.log(`[startScrape] Persisting ${scoredJobs.length} jobs. Sample — score: ${sample?.score}, scoreDetails: ${JSON.stringify(sample?.scoreDetails)?.slice(0, 120)}`);
        await prisma.jobPost.createMany({
          data: scoredJobs.map((j) => ({
            userId,
            sessionId,
            title: j.title,
            company: j.company,
            location: j.location || null,
            url: j.url,
            description: j.description || null,
            platform: j.platform,
            salary: j.salary || null,
            postedAt: j.postedAt || null,
            score: j.score,
            scoreDetails: j.scoreDetails || null,
          })),
        });

        // 4. Notify frontend — scraping is done
        emit('scraper:complete', {
          message: `Found and scored ${scoredJobs.length} jobs. Capturing screenshots in background...`,
          total: scoredJobs.length,
        });

        // 5. Fetch saved job IDs (createMany doesn't return them)
        const savedJobs = await prisma.jobPost.findMany({
          where: { userId, sessionId },
          select: { id: true, url: true },
        });

        // 6. Kick off background screenshot capture — fire and forget
        captureJobScreenshots(savedJobs, userId, sessionId);
      } catch (err) {
        io.to(userId).emit('scraper:error', { message: err.message, sessionId });
      }
    })();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Jobs list / sessions ───────────────────────────────────────────────────────

export const getJobs = async (req, res) => {
  try {
    const { sessionId, minScore, platform, status } = req.query;
    const jobs = await prisma.jobPost.findMany({
      where: {
        userId: req.user.id,
        ...(sessionId && { sessionId }),
        ...(minScore && { score: { gte: parseInt(minScore) } }),
        ...(platform && { platform }),
        ...(status && { status }),
      },
      orderBy: [{ score: 'desc' }, { scrapedAt: 'desc' }],
      take: 300,
    });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getSessions = async (req, res) => {
  try {
    const sessions = await prisma.jobPost.groupBy({
      by: ['sessionId', 'scrapedAt'],
      where: { userId: req.user.id, sessionId: { not: null } },
      _count: { id: true },
      _max: { score: true, scrapedAt: true },
      orderBy: { _max: { scrapedAt: 'desc' } },
      take: 10,
    });
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getJob = async (req, res) => {
  try {
    const job = await prisma.jobPost.findUnique({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Status / delete ────────────────────────────────────────────────────────────

export const updateJobStatus = async (req, res) => {
  try {
    const job = await prisma.jobPost.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { status: req.body.status },
    });
    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteJob = async (req, res) => {
  try {
    await prisma.jobPost.delete({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteAllJobs = async (req, res) => {
  try {
    const { sessionId, platform } = req.query;
    const { count } = await prisma.jobPost.deleteMany({
      where: {
        userId: req.user.id,
        ...(sessionId && { sessionId }),
        ...(platform && { platform }),
      },
    });
    res.json({ success: true, deleted: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const clearSession = async (req, res) => {
  try {
    await prisma.jobPost.deleteMany({ where: { userId: req.user.id, sessionId: req.params.sessionId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Manual recapture (single job) ─────────────────────────────────────────────

// ── Platform session endpoints ─────────────────────────────────────────────────

export const listPlatforms = async (req, res) => {
  try {
    const statuses = await getPlatformStatuses(req.user.id);
    res.json(statuses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const startPlatformConnect = async (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user.id;

    // Respond immediately; login flow runs async (browser opens on server)
    res.json({ message: `Opening ${platform} login...` });

    connectPlatform(platform, userId, io).catch((err) => {
      io.to(userId).emit('platform:login_error', { platform, message: err.message });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const removePlatformSession = async (req, res) => {
  try {
    await disconnectPlatform(req.params.platform, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const recaptureScreenshot = async (req, res) => {
  try {
    const job = await prisma.jobPost.findUnique({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.json({ message: 'Recapturing screenshot in background' });

    // Fire and forget single-job capture
    captureJobScreenshots([{ id: job.id, url: job.url }], req.user.id, job.sessionId);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
