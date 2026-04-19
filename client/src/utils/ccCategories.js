// ─── Merchant keyword → FinFlow category ────────────────────────────────────

export const MERCHANT_RULES = [
  {
    keywords: [
      'swiggy', 'zomato', 'blinkit', 'dunzo', 'eatsure', 'faasos', 'box8',
      'dominos', 'pizza hut', 'kfc', 'mcdonalds', 'mcdonald', 'subway',
      'burger king', 'starbucks', 'cafe coffee day', 'ccd', 'chaayos',
      'haldirams', 'haldiram', 'wow momo', 'biryani blues', 'freshmenu',
      'eatclub', 'rebel foods', 'behrouz', 'ovenstory', 'the good bowl',
    ],
    category: 'Food & Dining',
  },
  {
    keywords: [
      'bigbasket', 'grofers', 'blinkit grocery', 'dmart', 'reliance fresh',
      'more supermarket', 'jiomart', 'zepto', 'instamart', 'nature basket',
      'spencers', 'star bazaar', 'spar', 'safal', 'nilgiris',
    ],
    category: 'Groceries',
  },
  {
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal',
      'tatacliq', 'reliance digital', 'croma', 'vijay sales', 'shopify',
      'lenskart', 'pepperfry', 'urban ladder', 'ikea', 'lifestyle', 'max fashion',
      'westside', 'pantaloons', 'h&m', 'zara', 'decathlon', 'firstcry',
    ],
    category: 'Shopping',
  },
  {
    keywords: [
      'uber', 'ola', 'rapido', 'meru', 'bluedart', 'delhivery', 'dtdc',
      'irctc', 'makemytrip', 'goibibo', 'cleartrip', 'yatra', 'ixigo',
      'indigo', 'air india', 'spicejet', 'vistara', 'air asia',
      'fasttag', 'paytm parking', 'indian railways', 'metro', 'dmrc',
      'bmtc', 'best bus', 'redbus', 'abhibus',
    ],
    category: 'Transport',
  },
  {
    keywords: [
      'netflix', 'amazon prime', 'hotstar', 'disney', 'sony liv', 'zee5',
      'bookmyshow', 'pvr', 'inox', 'cinepolis', 'spotify', 'youtube premium',
      'apple music', 'gaana', 'jio saavn', 'hungama', 'apple tv',
      'ea games', 'steam', 'playstation', 'xbox', 'epic games',
    ],
    category: 'Entertainment',
  },
  {
    keywords: [
      'apollo', 'medplus', '1mg', 'pharmeasy', 'netmeds', 'max hospital',
      'fortis', 'manipal', 'columbia asia', 'narayana', 'aster',
      'practo', 'tata 1mg', 'healthkart', 'doctor', 'clinic', 'hospital',
      'pharmacy', 'lab', 'diagnostic', 'pathology', 'thyrocare', 'lal path',
      'care health', 'niva bupa', 'star health', 'aditya birla health',
    ],
    category: 'Health',
  },
  {
    keywords: [
      'bescom', 'tata power', 'bses', 'adani electricity', 'mahanagar gas',
      'mgl', 'igl', 'airtel', 'jio', 'vi vodafone', 'bsnl', 'act fibernet',
      'hathway', 'excitel', 'tikona', 'billdesk', 'paytm utility',
      'npcl', 'msedcl', 'tneb', 'torrent power', 'merc', 'wesco',
    ],
    category: 'Utilities',
  },
  {
    keywords: [
      'udemy', 'coursera', 'byju', 'byjus', 'unacademy', 'vedantu',
      'whitehat', 'toppr', 'khan academy', 'linkedin learning', 'skillshare',
      'pluralsight', 'codecademy', 'collegedunia', 'school fees', 'tuition',
    ],
    category: 'Education',
  },
  {
    keywords: [
      'zerodha', 'groww', 'kuvera', 'coin', 'icicidirect', 'hdfc securities',
      'sbi securities', 'axis direct', 'motilal oswal', 'angel broking',
      'lic', 'nps', 'ppf', 'sip', 'mutual fund', 'insurance premium',
      'bajaj allianz', 'icici prudential', 'hdfc life',
    ],
    category: 'Savings',
  },
];

// ─── AI category → FinTracker category ──────────────────────────────────────

export const FINTRACK_CATEGORY_MAP = {
  'Food & Dining': 'Food',
  'Groceries':     'Food',
  'Shopping':      'Shopping',
  'Transport':     'Transport',
  'Entertainment': 'Entertainment',
  'Health':        'Health',
  'Utilities':     'Utilities',
  'Education':     'Other',
  'Savings':       'Other',
  'Rewards':       null,   // excluded from sync
  'Others':        'Other',
};

export const ALL_CC_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Shopping',
  'Transport',
  'Entertainment',
  'Health',
  'Utilities',
  'Education',
  'Savings',
  'Rewards',
  'Others',
];

// ─── Category colours ────────────────────────────────────────────────────────

export const CATEGORY_STYLE = {
  'Food & Dining':  { bg: 'bg-red-50',    text: 'text-red-500',    hex: '#EF4444' },
  'Groceries':      { bg: 'bg-lime-50',   text: 'text-lime-600',   hex: '#84CC16' },
  'Shopping':       { bg: 'bg-purple-50', text: 'text-purple-500', hex: '#A855F7' },
  'Transport':      { bg: 'bg-blue-50',   text: 'text-blue-500',   hex: '#3B82F6' },
  'Entertainment':  { bg: 'bg-orange-50', text: 'text-orange-500', hex: '#F97316' },
  'Health':         { bg: 'bg-green-50',  text: 'text-green-600',  hex: '#22C55E' },
  'Utilities':      { bg: 'bg-yellow-50', text: 'text-yellow-600', hex: '#CA8A04' },
  'Education':      { bg: 'bg-sky-50',    text: 'text-sky-600',    hex: '#0EA5E9' },
  'Savings':        { bg: 'bg-teal-50',   text: 'text-teal-600',   hex: '#14B8A6' },
  'Rewards':        { bg: 'bg-amber-50',  text: 'text-amber-600',  hex: '#F59E0B' },
  'Others':         { bg: 'bg-gray-50',   text: 'text-gray-500',   hex: '#6B7280' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function classifyMerchant(merchant) {
  if (!merchant) return null;
  const lower = merchant.toLowerCase();
  for (const rule of MERCHANT_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.category;
  }
  return null;
}

/**
 * Returns 'high' | 'medium' | 'low'
 * high   → local rule + AI agree
 * medium → only one of them has an opinion
 * low    → both are uncertain (Others / null)
 */
export function getCategoryConfidence(merchant, aiCategory) {
  const local = classifyMerchant(merchant);
  if (local && local === aiCategory) return 'high';
  if (local || (aiCategory && aiCategory !== 'Others')) return 'medium';
  return 'low';
}

// ─── Indian number formatting ────────────────────────────────────────────────

export const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n ?? 0);

export const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

// ─── Duplicate detection ─────────────────────────────────────────────────────

const STORAGE_KEY = 'finflow_cc_imported';

export function buildStatementKey(summary) {
  return `${summary.bank}-${summary.card_last4}-${summary.statement_date}`;
}

export function checkDuplicate(summary) {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const key = buildStatementKey(summary);
    return history[key] || null; // returns { importedAt, synced } or null
  } catch {
    return null;
  }
}

export function recordImport(summary, synced) {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const key = buildStatementKey(summary);
    history[key] = { importedAt: new Date().toISOString(), synced };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}
