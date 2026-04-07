import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const targetsPath = path.join(process.cwd(), 'site-targets.json');

function normalizeTokenMap() {
  const raw = process.env.SITE_REVALIDATE_TOKENS_JSON ?? '{}';

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    throw new Error('SITE_REVALIDATE_TOKENS_JSON is not valid JSON.');
  }
}

async function readTargets() {
  const source = await fs.readFile(targetsPath, 'utf8');
  const parsed = JSON.parse(source);

  if (!Array.isArray(parsed.sites)) {
    throw new Error('site-targets.json must contain a sites array.');
  }

  return parsed.sites;
}

async function notifySite(site, tokenMap) {
  if (site.enabled === false) {
    return {
      name: site.name,
      status: 'skipped',
      reason: 'disabled',
    };
  }

  if (typeof site.name !== 'string' || typeof site.revalidateUrl !== 'string') {
    throw new Error('Each site must define name and revalidateUrl.');
  }

  const token =
    (typeof site.tokenKey === 'string' ? tokenMap[site.tokenKey] : undefined) ??
    undefined;

  if (typeof token !== 'string' || token.length === 0) {
    return {
      name: site.name,
      status: 'skipped',
      reason: `missing token for key "${site.tokenKey ?? ''}"`,
    };
  }

  const response = await fetch(site.revalidateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      name: site.name,
      status: 'failed',
      reason: `HTTP ${response.status}: ${body}`.slice(0, 400),
    };
  }

  return {
    name: site.name,
    status: 'ok',
  };
}

async function main() {
  const tokenMap = normalizeTokenMap();
  const sites = await readTargets();
  const results = await Promise.all(
    sites.map((site) => notifySite(site, tokenMap)),
  );

  let okCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const result of results) {
    if (result.status === 'ok') {
      okCount += 1;
      console.log(`OK ${result.name}`);
      continue;
    }

    if (result.status === 'skipped') {
      skippedCount += 1;
      console.warn(`SKIPPED ${result.name}: ${result.reason}`);
      continue;
    }

    failedCount += 1;
    console.error(`FAILED ${result.name}: ${result.reason}`);
  }

  console.log(
    `SUMMARY ok=${okCount} failed=${failedCount} skipped=${skippedCount}`,
  );

  if (okCount === 0 && failedCount > 0) {
    process.exitCode = 1;
  }
}

await main();
