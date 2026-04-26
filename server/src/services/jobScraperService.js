import { chromium } from 'playwright';

const HEADLESS = process.env.NODE_ENV === 'production';
const MAX_PER_PLATFORM = 20;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── LinkedIn ──────────────────────────────────────────────────────────────────

async function scrapeLinkedIn(page, profile, emit) {
  const keywords = encodeURIComponent(profile.targetRole || 'Software Engineer');
  const location = encodeURIComponent(profile.preferredLocations?.[0] || 'India');
  const url = `https://www.linkedin.com/jobs/search?keywords=${keywords}&location=${location}&f_TPR=r2592000&sortBy=DD`;

  emit('scraper:status', { platform: 'LinkedIn', message: `Opening LinkedIn Jobs...` });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  // Scroll to trigger lazy-loading
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(600);
  }

  const jobs = await page.evaluate((max) => {
    const cards = document.querySelectorAll('.base-card, .job-search-card');
    return Array.from(cards)
      .slice(0, max)
      .map((c) => ({
        title: c.querySelector('.base-search-card__title')?.textContent?.trim() || '',
        company: c.querySelector('.base-search-card__subtitle')?.textContent?.trim() || '',
        location: c.querySelector('.job-search-card__location')?.textContent?.trim() || '',
        url: c.querySelector('a.base-card__full-link, a.base-search-card__full-link')?.href || '',
        salary: c.querySelector('.job-search-card__salary-info')?.textContent?.trim() || '',
        postedAt: c.querySelector('time')?.getAttribute('datetime') || '',
        platform: 'linkedin',
      }))
      .filter((j) => j.title && j.url);
  }, MAX_PER_PLATFORM);

  emit('scraper:status', { platform: 'LinkedIn', message: `Found ${jobs.length} jobs on LinkedIn` });
  return jobs;
}

// ── Naukri ────────────────────────────────────────────────────────────────────

async function scrapeNaukri(page, profile, emit) {
  const role = encodeURIComponent(profile.targetRole || 'Software Engineer');
  const location = encodeURIComponent(profile.preferredLocations?.[0] || 'India');
  const exp = profile.experienceYears || 0;
  const url = `https://www.naukri.com/jobs-in-india?k=${role}&l=${location}&experience=${exp}`;

  emit('scraper:status', { platform: 'Naukri', message: `Opening Naukri.com...` });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);
  }

  const jobs = await page.evaluate((max) => {
    const selectors = [
      'article.jobTuple',
      'div.cust-job-tuple',
      'div[class*="srp-jobtuple-wrapper"]',
      'div[class*="jobTupleHeader"]',
      '.job-container',
    ];

    let cards = [];
    for (const sel of selectors) {
      cards = Array.from(document.querySelectorAll(sel));
      if (cards.length > 0) break;
    }

    return cards
      .slice(0, max)
      .map((c) => ({
        title:
          c.querySelector('a.title, a[class*="title"], a[class*="jobTitle"]')?.textContent?.trim() || '',
        company:
          c.querySelector('a.subTitle, a[class*="subTitle"], a[class*="comp-name"], span[class*="comp-name"]')
            ?.textContent?.trim() || '',
        location:
          c.querySelector('span.locWdth, li[class*="loc"], span[class*="location"], span[class*="loc"]')
            ?.textContent?.trim() || '',
        url: c.querySelector('a.title, a[class*="title"], a[class*="jobTitle"]')?.href || '',
        salary:
          c.querySelector('span.salary, span[class*="salary"], li[class*="salary"]')?.textContent?.trim() || '',
        postedAt: c.querySelector('span.date, span[class*="date"]')?.textContent?.trim() || '',
        platform: 'naukri',
      }))
      .filter((j) => j.title && j.url);
  }, MAX_PER_PLATFORM);

  emit('scraper:status', { platform: 'Naukri', message: `Found ${jobs.length} jobs on Naukri` });
  return jobs;
}

// ── Indeed ────────────────────────────────────────────────────────────────────

async function scrapeIndeed(page, profile, emit) {
  const role = encodeURIComponent(profile.targetRole || 'Software Engineer');
  const location = encodeURIComponent(profile.preferredLocations?.[0] || 'India');
  const url = `https://in.indeed.com/jobs?q=${role}&l=${location}&fromage=14&sort=date`;

  emit('scraper:status', { platform: 'Indeed', message: `Opening Indeed India...` });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);
  }

  const jobs = await page.evaluate((max) => {
    const cards = document.querySelectorAll('.job_seen_beacon, li[class*="css-"][class*="eu4oa1w"]');
    return Array.from(cards)
      .slice(0, max)
      .map((c) => ({
        title:
          c.querySelector('h2.jobTitle span[title], span[id^="jobTitle"], h2.jobTitle a span')
            ?.textContent?.trim() || '',
        company: c.querySelector('[class*="companyName"]')?.textContent?.trim() || '',
        location: c.querySelector('[class*="companyLocation"]')?.textContent?.trim() || '',
        url:
          (() => {
            const a = c.querySelector('a[id^="job_"], a.jcs-JobTitle, h2.jobTitle a');
            if (!a) return '';
            return a.href.startsWith('http') ? a.href : `https://in.indeed.com${a.getAttribute('href')}`;
          })(),
        salary: c.querySelector('[class*="salary"], [class*="Salary"]')?.textContent?.trim() || '',
        postedAt: c.querySelector('[class*="date"], span[class*="posted"]')?.textContent?.trim() || '',
        platform: 'indeed',
      }))
      .filter((j) => j.title && j.url);
  }, MAX_PER_PLATFORM);

  emit('scraper:status', { platform: 'Indeed', message: `Found ${jobs.length} jobs on Indeed` });
  return jobs;
}

// ── Glassdoor ─────────────────────────────────────────────────────────────────

async function scrapeGlassdoor(page, profile, emit) {
  const role = encodeURIComponent(profile.targetRole || 'Software Engineer');
  const location = encodeURIComponent(profile.preferredLocations?.[0] || 'India');
  const url = `https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword=${role}&locT=N&locId=115&sortBy=date_desc`;

  emit('scraper:status', { platform: 'Glassdoor', message: `Opening Glassdoor...` });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Close sign-up modal if present
  try {
    await page.click('[alt="Close"], button[class*="modal"] svg', { timeout: 3000 });
  } catch {}

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);
  }

  const jobs = await page.evaluate((max) => {
    const cards = document.querySelectorAll(
      'li[class*="JobsList_jobListItem"], article[class*="JobCard"], div[data-test="jobListing"]'
    );
    return Array.from(cards)
      .slice(0, max)
      .map((c) => ({
        title:
          c.querySelector('[class*="JobCard_jobTitle"], [data-test="job-title"], a[class*="jobLink"]')
            ?.textContent?.trim() || '',
        company:
          c.querySelector('[class*="EmployerProfile_employerName"], [data-test="employer-name"]')
            ?.textContent?.trim() || '',
        location:
          c.querySelector('[data-test="emp-location"], [class*="JobCard_location"]')
            ?.textContent?.trim() || '',
        url:
          (() => {
            const a = c.querySelector('a[class*="JobCard_trackingLink"], a[data-test="job-title"]');
            if (!a) return '';
            return a.href.startsWith('http') ? a.href : `https://www.glassdoor.co.in${a.getAttribute('href')}`;
          })(),
        salary:
          c.querySelector('[data-test="detailSalary"], [class*="salary"]')?.textContent?.trim() || '',
        platform: 'glassdoor',
      }))
      .filter((j) => j.title && j.url);
  }, MAX_PER_PLATFORM);

  emit('scraper:status', { platform: 'Glassdoor', message: `Found ${jobs.length} jobs on Glassdoor` });
  return jobs;
}

const PLATFORM_TIMEOUT_MS = 45_000; // 45 s per platform before skipping

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);

// ── Main orchestrator ─────────────────────────────────────────────────────────
// platformSessions: { linkedin: storageStateObj, naukri: ..., ... }
// Each platform gets its own browser context so sessions don't bleed across domains.

export async function runJobScraper(io, userId, profile, sessionId, platformSessions = {}) {
  const emit = (event, data) => io.to(userId).emit(event, { ...data, sessionId });

  let browser = null;
  let screenshotTimer = null;

  const startScreenshots = (page) => {
    stopScreenshots();
    screenshotTimer = setInterval(async () => {
      try {
        const buf = await page.screenshot({ type: 'jpeg', quality: 40, fullPage: false });
        emit('scraper:screenshot', { imageBase64: buf.toString('base64') });
      } catch {}
    }, 1500);
  };

  const stopScreenshots = () => {
    if (screenshotTimer) { clearInterval(screenshotTimer); screenshotTimer = null; }
  };

  const platforms = [
    { name: 'LinkedIn',  key: 'linkedin',  fn: scrapeLinkedIn  },
    { name: 'Naukri',    key: 'naukri',    fn: scrapeNaukri    },
    { name: 'Indeed',    key: 'indeed',    fn: scrapeIndeed    },
    { name: 'Glassdoor', key: 'glassdoor', fn: scrapeGlassdoor },
  ];

  try {
    emit('scraper:start', { message: 'Launching browser...', total: platforms.length });

    browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
      channel: HEADLESS ? undefined : 'chrome',
    });

    const allJobs = [];

    for (let i = 0; i < platforms.length; i++) {
      const { name, key, fn } = platforms[i];
      const session = platformSessions[key];
      const isLoggedIn = !!session;

      emit('scraper:platform', {
        platform: name,
        status: 'starting',
        loggedIn: isLoggedIn,
        index: i,
        total: platforms.length,
      });

      // Create a fresh context per platform — restores saved session if available
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1280, height: 800 },
        locale: 'en-IN',
        ...(session && { storageState: session }),
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      const page = await context.newPage();
      startScreenshots(page);

      try {
        const jobs = await withTimeout(fn(page, profile, emit), PLATFORM_TIMEOUT_MS, name);
        allJobs.push(...jobs);
        emit('scraper:platform', { platform: name, status: 'done', count: jobs.length, loggedIn: isLoggedIn, index: i, total: platforms.length });
      } catch (err) {
        const isTimeout = err.message.includes('timed out');
        emit('scraper:platform', { platform: name, status: 'error', message: err.message, timedOut: isTimeout, index: i, total: platforms.length });
      } finally {
        stopScreenshots();
        // Capture final screenshot before closing this platform's context
        try {
          const buf = await page.screenshot({ type: 'jpeg', quality: 50 });
          emit('scraper:screenshot', { imageBase64: buf.toString('base64') });
        } catch {}
        await context.close().catch(() => {});
      }

      if (i < platforms.length - 1) await new Promise((r) => setTimeout(r, 800));
    }

    await browser.close();
    browser = null;

    return allJobs;
  } catch (err) {
    stopScreenshots();
    emit('scraper:error', { message: err.message });
    return [];
  } finally {
    stopScreenshots();
    if (browser) await browser.close().catch(() => {});
  }
}
