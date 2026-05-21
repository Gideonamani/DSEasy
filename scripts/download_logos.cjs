/**
 * Downloads low-res ticker logos from dse.co.tz into public/logos/.
 *
 * Source: https://dse.co.tz/storage/securities/<TICKER>/Logo/<TICKER>.{jpg,png}
 * These are the logos the DSE itself publishes for listed securities.
 *
 * Run manually (e.g. when a new ticker is listed) with:
 *   node scripts/download_logos.cjs
 *
 * For sharper logos see scripts/download_highres_logos.cjs which falls back
 * to favicon services.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const tickers = [
  'AFRIPRISE', 'CRDB', 'DCB', 'DSE', 'EABL', 'IEACLC ETF', 'JATU', 'JHL', 'KA',
  'KCB', 'MBP', 'MCB', 'MKCB', 'MUCOBA', 'NICO', 'NMB', 'NMG', 'PAL', 'SWALA',
  'SWIS', 'TBL', 'TCC', 'TCCL', 'TOL', 'TPCC', 'TTP', 'USL', 'VERTEX ETF',
  'VODA', 'YETU'
];

const outputDir = path.join(__dirname, '..', 'public', 'logos');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirects
          downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      } else {
          res.resume(); // consume response data to free up memory
          reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Starting logo download from DSE...');
  for (const ticker of tickers) {
    const outputPath = path.join(outputDir, `${ticker}.png`);
    const encoded = encodeURIComponent(ticker);

    // DSE URL pattern
    const imgUrl = `https://dse.co.tz/storage//securities/${encoded}/Logo/${encoded}.jpg`;
    console.log(`[DL] Attempting to download for ${ticker} from ${imgUrl}`);

    try {
       await downloadImage(imgUrl, outputPath);
       console.log(`[SUCCESS] Saved ${ticker}.png`);
    } catch (err) {
       console.log(`[FAIL] Error downloading image for ${ticker}: ${err.message}`);

       // Fallback to .png just in case some are pngs on the server
       const fallbackUrl = `https://dse.co.tz/storage//securities/${encoded}/Logo/${encoded}.png`;
       try {
           console.log(`[DL-FALLBACK] Attempting ${fallbackUrl}`);
           await downloadImage(fallbackUrl, outputPath);
           console.log(`[SUCCESS] Saved ${ticker}.png via fallback`);
       } catch (errFallback) {
           console.log(`[FAIL] Completely failed for ${ticker}: ${errFallback.message}`);
       }
    }

    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('Finished downloading logos. Please review them in public/logos/.');
}

run();
