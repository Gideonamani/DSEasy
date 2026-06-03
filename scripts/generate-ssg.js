import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicLogosDir = path.join(rootDir, 'public', 'logos');
const baseDomain = process.env.VITE_APP_BASE_URL || 'https://ds-easy.vercel.app';

// Ensure the dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('[SSG] Build directory "dist" not found. Please run "npm run build" first.');
  process.exit(1);
}

// Load dist/index.html as template
const templatePath = path.join(distDir, 'index.html');
if (!fs.existsSync(templatePath)) {
  console.error('[SSG] Template "dist/index.html" not found.');
  process.exit(1);
}
const htmlTemplate = fs.readFileSync(templatePath, 'utf8');

// Define static pages
const pages = [
  {
    path: '',
    title: 'DSEasy - Dar es Salaam Stock Exchange Financial Dashboard',
    description: 'Real-time DSE stock market data, market indices, top gainers/losers, turnover, and volume analytics in a modern interactive dashboard.',
    image: '/og-image.png'
  },
  {
    path: 'glance',
    title: 'Daily Glance - DSEasy Order Book Intelligence',
    description: 'Live DSE order book intelligence, heatmap matrix, transaction-level metrics, and market depth analytics for retail investors.',
    image: '/og-image.png'
  },
  {
    path: 'analytics',
    title: 'Derived Analytics - DSEasy Advanced Market Metrics',
    description: 'Advanced financial metrics, sector breakdown, liquidity analysis, and derived DSE market indices for scientific stock tracking.',
    image: '/og-image.png'
  },
  {
    path: 'trends',
    title: 'Ticker Trends - DSEasy Stock Performance Charts',
    description: 'Interactive historical price charts, technical indicator overlays (RSI, MACD, Bollinger Bands), and volume trends for DSE listed companies.',
    image: '/og-image.png'
  },
  {
    path: 'compare',
    title: 'Compare Tickers - DSEasy Stock Performance Matrix',
    description: 'Compare historical returns, sector correlation, valuation multiples, and dividend yields for multiple DSE stock tickers side-by-side.',
    image: '/og-image.png'
  },
  {
    path: 'notifications',
    title: 'Smart Alerts & Notifications - DSEasy',
    description: 'Configure real-time in-app alerts and email notifications for custom price thresholds, percentage movements, and volume breakouts on the DSE.',
    image: '/og-image.png'
  },
  {
    path: 'settings',
    title: 'Preferences & Settings - DSEasy',
    description: 'Customize your DSEasy experience including dark mode, default landing page, number format formatting (full vs. abbreviated), and chart configurations.',
    image: '/og-image.png'
  }
];

// Helper to inject meta tags into the HTML template
function preRenderHtml(title, description, relativeImagePath, pagePath) {
  const encodedImagePath = relativeImagePath.split('/').map(encodeURIComponent).join('/');
  const fullUrl = `${baseDomain}/${pagePath}`.replace(/\/+$/, '');
  const absoluteImageUrl = `${baseDomain}${encodedImagePath}`;

  const seoMetaTags = `
    <!-- Primary SEO Meta Tags -->
    <meta name="title" content="${title}" />
    <meta name="description" content="${description}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${fullUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${absoluteImageUrl}" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${fullUrl}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${absoluteImageUrl}" />
  `;

  // 1. Replace the existing title
  let rendered = htmlTemplate.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);

  // 2. Inject meta tags right after <head> or before the title
  if (rendered.includes('<head>')) {
    rendered = rendered.replace('<head>', `<head>${seoMetaTags}`);
  } else {
    // Fallback inject
    rendered = rendered.replace('<title>', `${seoMetaTags}\n    <title>`);
  }

  return rendered;
}

// Generate static pages
console.log('[SSG] Pre-rendering static pages...');
for (const page of pages) {
  const fileContent = preRenderHtml(page.title, page.description, page.image, page.path);

  if (page.path === '') {
    // Root index.html in dist/
    fs.writeFileSync(templatePath, fileContent);
    console.log(`  [✓] Updated root index.html with default SEO & OG tags.`);
  } else {
    const dirPath = path.join(distDir, page.path);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const outputPath = path.join(dirPath, 'index.html');
    fs.writeFileSync(outputPath, fileContent);
    console.log(`  [✓] Generated ${page.path}/index.html`);
  }
}

// Dynamically discover all stock tickers from public/logos/ directory
let tickers = [];
if (fs.existsSync(publicLogosDir)) {
  const files = fs.readdirSync(publicLogosDir);
  tickers = files
    .filter(file => file.endsWith('.png') && file !== 'og-image.png')
    .map(file => path.basename(file, '.png'));
}

if (tickers.length === 0) {
  // Hardcoded fallback list if directory reading fails or is empty
  tickers = [
    'AFRIPRISE', 'CRDB', 'DCB', 'DSE', 'EABL', 'IEACLC ETF', 'JATU', 'JHL', 'KA',
    'KCB', 'MBP', 'MCB', 'MKCB', 'MUCOBA', 'NICO', 'NMB', 'NMG', 'PAL', 'SWALA',
    'SWIS', 'TBL', 'TCC', 'TCCL', 'TOL', 'TPCC', 'TTP', 'USL', 'VERTEX ETF',
    'VODA', 'YETU'
  ];
}

console.log(`[SSG] Discovered ${tickers.length} stock tickers. Pre-rendering ticker trend pages...`);

for (const ticker of tickers) {
  // Determine if a custom high-res logo exists, otherwise use standard logo
  const logoRelativePath = `/logos/${ticker}.png`;
  const highResLogoRelativePath = `/logos/high-res/${ticker}.png`;
  const highResLogoLocalPath = path.join(rootDir, 'public', 'logos', 'high-res', `${ticker}.png`);
  
  const ogImage = fs.existsSync(highResLogoLocalPath) ? highResLogoRelativePath : logoRelativePath;

  const title = `${ticker} Stock Price, Trends & Historical Chart - DSEasy`;
  const description = `Analyze historical price action, technical overlays (RSI, SMA), daily spreads, and volume breakouts for ${ticker} on the Dar es Salaam Stock Exchange.`;

  const encodedTicker = encodeURIComponent(ticker);
  const fileContent = preRenderHtml(title, description, ogImage, `trends/${encodedTicker}`);

  // Generate both UPPERCASE and lowercase paths for safety/compatibility
  const pathsToGenerate = [`trends/${encodedTicker}`, `trends/${encodedTicker.toLowerCase()}`];

  for (const p of pathsToGenerate) {
    const dirPath = path.join(distDir, p);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const outputPath = path.join(dirPath, 'index.html');
    fs.writeFileSync(outputPath, fileContent);
  }
}

console.log(`[SSG] SSG Pre-rendering completed successfully for all pages and ${tickers.length} tickers!`);
