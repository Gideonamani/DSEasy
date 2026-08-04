/**
 * Visual Diff — automated prod-vs-preview screenshot comparison
 *
 * The mechanical half of the /pr-ui-review skill: screenshots a set of
 * routes on both production and a PR's Vercel preview, pixel-diffs them,
 * and records any console errors / failed network requests that appear on
 * the preview but not on prod. Claude (via the skill) is responsible for
 * picking the route list from the PR's diff and for actually interacting
 * with the claimed new feature — this script only covers what's checkable
 * without understanding what the PR is supposed to do.
 *
 * Usage:
 *   node scripts/visual-diff.mjs <PR_NUMBER> [--routes=/,/tickers/CRDB] [--threshold=0.5]
 *
 * Requires:
 *   - gh CLI authenticated
 *   - VERCEL_AUTOMATION_BYPASS_SECRET env var, if the preview has Vercel
 *     Deployment Protection enabled (Project Settings -> Deployment
 *     Protection -> Protection Bypass for Automation). Without it, preview
 *     navigation will hit Vercel's SSO wall and every preview screenshot
 *     will just be the login page.
 *
 * Output: .pr-review/pr-<N>/
 *   <route-slug>.prod.png / .preview.png / .diff.png
 *   summary.json  — machine-readable results for the skill to read
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "fs";
import path from "path";
import { resolvePr, diffOutputDir, PROD_URL } from "./lib/resolvePreviewUrl.mjs";

const BYPASS_HEADER = "x-vercel-protection-bypass";
const BYPASS_COOKIE_HEADER = "x-vercel-set-bypass-cookie";
const DEFAULT_ROUTES = ["/"];
const DEFAULT_THRESHOLD_PCT = 0.5; // percent of pixels allowed to differ before flagging a route

function parseArgs() {
  const prNumber = process.argv[2];
  if (!prNumber || !/^\d+$/.test(prNumber)) {
    console.error("Usage: node scripts/visual-diff.mjs <PR_NUMBER> [--routes=/,/tickers/CRDB] [--threshold=0.5]");
    process.exit(1);
  }
  const routesArg = process.argv.find((a) => a.startsWith("--routes="));
  const thresholdArg = process.argv.find((a) => a.startsWith("--threshold="));
  return {
    prNumber,
    routes: routesArg ? routesArg.slice("--routes=".length).split(",").filter(Boolean) : DEFAULT_ROUTES,
    thresholdPct: thresholdArg ? Number(thresholdArg.slice("--threshold=".length)) : DEFAULT_THRESHOLD_PCT,
  };
}

function slugForRoute(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");
}

/**
 * Navigate one route in one context, capturing a full-page screenshot plus
 * console errors and failed requests observed during the visit.
 */
async function captureRoute(context, baseUrl, route, screenshotPath) {
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  const url = `${baseUrl}${route}`;
  let navError = null;
  try {
    // Not "networkidle": DSEasy holds a persistent Firestore connection, so
    // the network never goes idle and that wait mode times out on every
    // real page load. "load" plus a fixed settle delay is what actually
    // works here — this app doesn't reach a quiet network state by design.
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (err) {
    navError = err instanceof Error ? err.message : String(err);
  }

  await page.close();
  return { url, consoleErrors, failedRequests, navError };
}

/**
 * Pixel-diff two PNGs of possibly different dimensions by comparing over
 * their shared top-left region (full-page screenshots commonly differ in
 * height when content length changes — that's itself worth surfacing, not
 * a failure to diff).
 */
function diffScreenshots(prodPath, previewPath, diffPath) {
  if (!fs.existsSync(prodPath) || !fs.existsSync(previewPath)) {
    return { comparable: false, diffPixels: 0, totalPixels: 0, diffPct: null, dimensionMismatch: null };
  }

  const prodPng = PNG.sync.read(fs.readFileSync(prodPath));
  const previewPng = PNG.sync.read(fs.readFileSync(previewPath));

  const width = Math.min(prodPng.width, previewPng.width);
  const height = Math.min(prodPng.height, previewPng.height);
  const dimensionMismatch =
    prodPng.width !== previewPng.width || prodPng.height !== previewPng.height
      ? { prod: [prodPng.width, prodPng.height], preview: [previewPng.width, previewPng.height] }
      : null;

  const crop = (png) => {
    const out = new PNG({ width, height });
    PNG.bitblt(png, out, 0, 0, width, height, 0, 0);
    return out;
  };

  const a = crop(prodPng);
  const b = crop(previewPng);
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  return {
    comparable: true,
    diffPixels,
    totalPixels,
    diffPct: totalPixels ? (diffPixels / totalPixels) * 100 : 0,
    dimensionMismatch,
  };
}

async function main() {
  const { prNumber, routes, thresholdPct } = parseArgs();
  const bypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  console.log(`Resolving PR #${prNumber}...`);
  const pr = resolvePr(prNumber);
  console.log(`PR #${prNumber}: ${pr.title}`);
  console.log(`Preview: ${pr.previewUrl}`);
  if (!bypassToken) {
    console.warn(
      "\nWARNING: VERCEL_AUTOMATION_BYPASS_SECRET is not set. If this preview has " +
      "Deployment Protection enabled, preview screenshots will show the Vercel SSO " +
      "login page instead of the app. Set it up under Project Settings -> " +
      "Deployment Protection -> Protection Bypass for Automation, then:\n" +
      "  VERCEL_AUTOMATION_BYPASS_SECRET=<token> node scripts/visual-diff.mjs " + prNumber + "\n"
    );
  }

  const outDir = diffOutputDir(prNumber);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const prodContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const previewContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  if (bypassToken) {
    await previewContext.setExtraHTTPHeaders({
      [BYPASS_HEADER]: bypassToken,
      [BYPASS_COOKIE_HEADER]: "true",
    });
  }

  const results = [];

  for (const route of routes) {
    const slug = slugForRoute(route);
    console.log(`\n--- ${route} ---`);

    const prodShot = path.join(outDir, `${slug}.prod.png`);
    const previewShot = path.join(outDir, `${slug}.preview.png`);
    const diffShot = path.join(outDir, `${slug}.diff.png`);

    const [prodCapture, previewCapture] = await Promise.all([
      captureRoute(prodContext, PROD_URL, route, prodShot),
      captureRoute(previewContext, pr.previewUrl, route, previewShot),
    ]);

    const diff = diffScreenshots(prodShot, previewShot, diffShot);

    // Only flag console/network issues NEW on preview — prod's existing
    // noise (known third-party warnings etc.) isn't this PR's problem.
    const newConsoleErrors = previewCapture.consoleErrors.filter((e) => !prodCapture.consoleErrors.includes(e));
    const newFailedRequests = previewCapture.failedRequests.filter((r) => !prodCapture.failedRequests.includes(r));

    const flagged = (diff.comparable && diff.diffPct > thresholdPct) || newConsoleErrors.length > 0 || newFailedRequests.length > 0 || !!previewCapture.navError || !!prodCapture.navError;

    const result = {
      route,
      slug,
      prodUrl: prodCapture.url,
      previewUrl: previewCapture.url,
      prodNavError: prodCapture.navError,
      previewNavError: previewCapture.navError,
      diff,
      newConsoleErrors,
      newFailedRequests,
      flagged,
    };
    results.push(result);

    if (prodCapture.navError) {
      console.log(`  ✗ prod navigation failed: ${prodCapture.navError}`);
    }
    if (previewCapture.navError) {
      console.log(`  ✗ preview navigation failed: ${previewCapture.navError}`);
    } else if (!diff.comparable) {
      console.log("  ⚠ could not compare screenshots (missing file)");
    } else {
      const glyph = diff.diffPct > thresholdPct ? "⚠" : "✓";
      console.log(`  ${glyph} pixel diff: ${diff.diffPct.toFixed(2)}% (${diff.diffPixels}/${diff.totalPixels}px)`);
      if (diff.dimensionMismatch) {
        console.log(`  ⚠ dimension mismatch: prod ${diff.dimensionMismatch.prod.join("x")} vs preview ${diff.dimensionMismatch.preview.join("x")}`);
      }
    }
    if (newConsoleErrors.length) console.log(`  ✗ new console errors: ${newConsoleErrors.length}`);
    if (newFailedRequests.length) console.log(`  ✗ new failed requests: ${newFailedRequests.length}`);
  }

  await browser.close();

  const summary = {
    prNumber,
    title: pr.title,
    headRefName: pr.headRefName,
    prodUrl: PROD_URL,
    previewUrl: pr.previewUrl,
    thresholdPct,
    generatedAt: new Date().toISOString(),
    results,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

  const flaggedCount = results.filter((r) => r.flagged).length;
  console.log(`\n${flaggedCount === 0 ? "✓" : "⚠"} ${flaggedCount}/${results.length} route(s) flagged. Full report: ${path.join(outDir, "summary.json")}`);

  process.exit(flaggedCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("visual-diff failed:", err);
  process.exit(1);
});
