/**
 * Shared helper: resolve a DSEasy PR's Vercel preview deployment URL and
 * basic metadata via the gh CLI. Used by both pr-preview-compare.mjs
 * (manual side-by-side) and visual-diff.mjs (automated screenshot diff).
 */
import { execSync } from "child_process";

export const REPO = "Gideonamani/DSEasy";
export const PROD_URL = "https://ds-easy.vercel.app";

/**
 * @param {string|number} prNumber
 * @returns {{title: string, body: string, headRefName: string, previewUrl: string, url: string}}
 */
export function resolvePr(prNumber) {
  const out = execSync(
    `gh pr view ${prNumber} -R ${REPO} --json title,body,url,comments,headRefName`,
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  const pr = JSON.parse(out);

  const previewUrl = findPreviewUrl(pr.comments);
  if (!previewUrl) {
    throw new Error(
      `No Vercel preview URL found in PR #${prNumber}'s comments yet. ` +
      `The Vercel bot posts it shortly after the first push — check ${pr.url} and retry.`
    );
  }

  return {
    title: pr.title,
    body: pr.body ?? "",
    headRefName: pr.headRefName,
    url: pr.url,
    previewUrl,
  };
}

/** @param {{body: string}[]} comments */
function findPreviewUrl(comments) {
  for (const c of comments) {
    // Vercel bot comment embeds the preview URL as a markdown link (and also
    // inside a base64 [vc]: metadata blob — the plain link is enough here).
    const m = c.body.match(/https:\/\/ds-easy-[a-z0-9-]+\.vercel\.app/i);
    if (m) return m[0];
  }
  return null;
}

/** @param {string|number} prNumber */
export function diffOutputDir(prNumber) {
  return `.pr-review/pr-${prNumber}`;
}
