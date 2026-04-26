import { chromium } from 'playwright';
import { prisma } from './db.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const PLATFORM_CONFIG = {
  linkedin: {
    label: 'LinkedIn',
    loginUrl: 'https://www.linkedin.com/login',
    // Login succeeded when redirected away from /login and feed/jobs is visible
    isLoggedIn: (url) =>
      url.includes('linkedin.com') &&
      !url.includes('/login') &&
      !url.includes('/signup') &&
      (url.includes('/feed') || url.includes('/jobs') || url.includes('/mynetwork') || url === 'https://www.linkedin.com/'),
  },
  naukri: {
    label: 'Naukri',
    loginUrl: 'https://www.naukri.com/nlogin/login',
    isLoggedIn: (url) =>
      url.includes('naukri.com') && !url.includes('/login') && !url.includes('/nlogin'),
  },
  indeed: {
    label: 'Indeed',
    loginUrl: 'https://secure.indeed.com/auth?hl=en_IN&co=IN',
    isLoggedIn: (url) =>
      url.includes('indeed.com') &&
      !url.includes('/auth') &&
      !url.includes('/signin') &&
      !url.includes('/login'),
  },
  glassdoor: {
    label: 'Glassdoor',
    loginUrl: 'https://www.glassdoor.co.in/profile/login_input.htm',
    isLoggedIn: (url) =>
      url.includes('glassdoor') &&
      !url.includes('login_input') &&
      !url.includes('/profile/login'),
  },
};

const LOGIN_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes for user to log in
const POLL_INTERVAL_MS = 1500;

export async function connectPlatform(platform, userId, io) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) throw new Error(`Unknown platform: ${platform}`);

  const emit = (event, data) => io.to(userId).emit(event, { platform, ...data });

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--no-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1100, height: 750 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();

    emit('platform:login_started', {
      message: `Browser opened for ${config.label}. Please log in — you have 3 minutes.`,
    });

    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Poll until login detected or timeout
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    let loggedIn = false;

    while (Date.now() < deadline) {
      const url = page.url();
      if (config.isLoggedIn(url)) {
        loggedIn = true;
        break;
      }
      // Check if page was closed by user
      if (page.isClosed()) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    if (!loggedIn) {
      emit('platform:login_timeout', {
        message: `${config.label} login timed out. Please try again.`,
      });
      return { success: false };
    }

    // Brief pause so any post-login redirects settle
    await page.waitForTimeout(1500);

    const storageState = await context.storageState();

    await prisma.userPlatformSession.upsert({
      where: { userId_platform: { userId, platform } },
      update: { storageState: JSON.stringify(storageState), connectedAt: new Date() },
      create: { userId, platform, storageState: JSON.stringify(storageState) },
    });

    emit('platform:connected', {
      message: `${config.label} connected successfully!`,
      connectedAt: new Date().toISOString(),
    });

    return { success: true };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export async function disconnectPlatform(platform, userId) {
  await prisma.userPlatformSession.deleteMany({ where: { userId, platform } });
}

export async function getPlatformStatuses(userId) {
  const sessions = await prisma.userPlatformSession.findMany({
    where: { userId },
    select: { platform: true, connectedAt: true },
  });

  return Object.keys(PLATFORM_CONFIG).map((platform) => {
    const session = sessions.find((s) => s.platform === platform);
    return {
      platform,
      label: PLATFORM_CONFIG[platform].label,
      connected: !!session,
      connectedAt: session?.connectedAt || null,
    };
  });
}

export async function loadPlatformSessions(userId) {
  const sessions = await prisma.userPlatformSession.findMany({ where: { userId } });
  return Object.fromEntries(sessions.map((s) => [s.platform, JSON.parse(s.storageState)]));
}
