# Feature: Open Graph Meta & Page-Specific OG Images

# Technical Specification: Open Graph Image Integration for DSEasy

To optimize DSEasy for social media sharing, Slack/Discord previews, and search engine crawlers, we need to implement page-specific Open Graph (OG) meta tags, specifically prioritizing dynamic or static `og:image` generation.

## 1. The Core Objective
When someone shares a link to a specific DSEasy page, the social card preview must display:
- **Title**: Page-specific title
- **Description**: An appealing summary of what can be found on that page.
- **OG Image**: A visually striking preview card representing the dashboard or ticker.

## 2. Proposed Architecture Options

### Option A: Static Pre-rendering (SSG)
We use a build-time tool like `vite-plugin-prerender` or a custom build script that generates static HTML directories for all main routes:
- `/index.html` (Dashboard)
- `/glance/index.html` (Daily Glance)
- `/analytics/index.html` (Analytics)

### Option B: Cloud Functions / Firebase Rewrite (Dynamic)
Since DSEasy uses Firebase Cloud Functions, we route page requests through a cloud function to replace placeholder meta tags dynamically.

### Option C: Baseline Default HTML Tags + React Helmet (Easiest)
We add high-quality general open graph tags to the root `index.html` and modify them dynamically in React code.
