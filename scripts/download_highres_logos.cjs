const fs = require('fs');
const path = require('path');
const https = require('https');

// Domain mapping for all 30 tickers
const domainMap = {
  'AFRIPRISE': 'afriprise.co.tz',
  'CRDB': 'crdbbank.co.tz',
  'DCB': 'dcb.co.tz',
  'DSE': 'dse.co.tz',
  'EABL': 'eabl.com',
  'IEACLC ETF': 'itrust.co.tz',
  'JATU': 'jatu.co.tz',
  'JHL': 'jubileeinsurance.com',
  'KA': 'kenya-airways.com',
  'KCB': 'kcbgroup.com',
  'MBP': 'mbeyacement.com',
  'MCB': 'mcb.co.tz',
  'MKCB': 'mkombozibank.co.tz',
  'MUCOBA': 'mucobatz.com',
  'NICO': 'nicotanzania.co.tz',
  'NMB': 'nmbbank.co.tz',
  'NMG': 'nationmedia.com',
  'PAL': 'precisionairtz.com',
  'SWALA': 'swalaoilandgas.com',
  'SWIS': 'swissport.com',
  'TBL': 'tbl.co.tz',
  'TCC': 'jti.com', // TCC is part of JTI
  'TCCL': 'simbacement.co.tz',
  'TOL': 'tolgases.com',
  'TPCC': 'twigacement.com',
  'TTP': 'tatepa.com',
  'USL': 'uchumi.com',
  'VERTEX ETF': 'vertex.co.tz',
  'VODA': 'vodacom.co.tz',
  'YETU': 'yetumicrofinance.co.tz'
};

const brokenLogosToOverwrite = ['AFRIPRISE', 'DCB', 'IEACLC ETF', 'SWIS', 'VERTEX ETF'];

const baseOutputDir = path.join(__dirname, '..', 'public', 'logos');
const highResDir = path.join(baseOutputDir, 'high-res');

if (!fs.existsSync(highResDir)) {
  fs.mkdirSync(highResDir, { recursive: true });
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects manually if needed, but Clearbit usually 302 redirects to actual image
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
         downloadImage(res.headers.location, dest).then(resolve).catch(reject);
         return;
      }
      
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else {
        res.resume();
        reject(new Error(`Status Code: ${res.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Starting high-res logo download via Clearbit...');
  
  for (const [ticker, domain] of Object.entries(domainMap)) {
    const highResPath = path.join(highResDir, `${ticker}.png`);
    const imgUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=256`;
    
    console.log(`[DL] Fetching ${ticker} from ${domain}...`);
    try {
       await downloadImage(imgUrl, highResPath);
       console.log(`[SUCCESS] Saved high-res ${ticker}.png`);
       
       // Overwrite broken ones in the base folder too
       if (brokenLogosToOverwrite.includes(ticker)) {
           const basePath = path.join(baseOutputDir, `${ticker}.png`);
           fs.copyFileSync(highResPath, basePath);
           console.log(`[OVERWRITE] Fixed base ${ticker}.png`);
       }
       
    } catch (err) {
       console.log(`[FAIL] Could not get high-res for ${ticker}: ${err.message}`);
    }

    // Gentle delay
    await new Promise(r => setTimeout(r, 400));
  }
  
  console.log('Finished. Please check public/logos/high-res/');
}

run();
