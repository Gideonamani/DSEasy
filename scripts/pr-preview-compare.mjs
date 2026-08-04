/**
 * PR Preview Compare — side-by-side QC launcher
 *
 * Resolves a PR's Vercel preview deployment URL (from the Vercel bot's PR
 * comment) and opens it next to production in two browser windows so you can
 * interact with both UIs before accepting the PR.
 *
 * Vercel preview deployments sit behind Deployment Protection (SSO wall) and
 * send X-Frame-Options: DENY, so they can't be embedded in iframes — this
 * opens two real OS browser windows instead. Position them side by side
 * manually (or use your OS's window-snap shortcut) for the comparison.
 *
 * Usage:
 *   node scripts/pr-preview-compare.mjs 194
 *   node scripts/pr-preview-compare.mjs 194 --route=/tickers/CRDB
 *
 * Requires: gh CLI authenticated (same as the rest of this repo's tooling).
 * For the fully automated version (screenshot diff, console/network checks),
 * see scripts/visual-diff.mjs and the /pr-ui-review skill.
 */
import { exec } from "child_process";
import { resolvePr, PROD_URL } from "./lib/resolvePreviewUrl.mjs";

const prNumber = process.argv[2];
const routeArg = process.argv.find((a) => a.startsWith("--route="));
const route = routeArg ? routeArg.slice("--route=".length) : "";

if (!prNumber || !/^\d+$/.test(prNumber)) {
  console.error("Usage: node scripts/pr-preview-compare.mjs <PR_NUMBER> [--route=/path]");
  process.exit(1);
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "win32" ? `start "" "${url}"` :
    platform === "darwin" ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, { shell: platform === "win32" ? "cmd.exe" : "/bin/sh" });
}

console.log(`Fetching PR #${prNumber} from Gideonamani/DSEasy...`);

let pr;
try {
  pr = resolvePr(prNumber);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const prodTarget = `${PROD_URL}${route}`;
const previewTarget = `${pr.previewUrl}${route}`;

console.log(`\nPR #${prNumber}: ${pr.title}`);
console.log(`Branch:  ${pr.headRefName}`);
console.log(`\nProd:    ${prodTarget}`);
console.log(`Preview: ${previewTarget}`);
console.log(
  `\nOpening both — the preview tab may prompt Vercel SSO login on first ` +
  `visit (deployment protection); sign in once and it'll stick for the session.\n`
);

openBrowser(prodTarget);
setTimeout(() => openBrowser(previewTarget), 500);
