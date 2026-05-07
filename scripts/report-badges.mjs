import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const dataDir = path.join(process.cwd(), 'data');
const providersPath = path.join(dataDir, 'badge-providers.json');
const badgeSetsPath = path.join(dataDir, 'badge-sets.json');
const projectsPath = path.join(dataDir, 'site-projects.json');
const projectsDirPath = path.join(dataDir, 'projects');
const targetsPath = path.join(process.cwd(), 'site-targets.json');

async function readJson(filePath) {
  const source = await fs.readFile(filePath, 'utf8');
  return JSON.parse(source);
}

async function readJsonIfExists(filePath, fallbackValue) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return fallbackValue;
    }

    throw error;
  }
}

function normalizeBadgeSets(rawBadgeSets, providers) {
  const badgeSets = {};

  for (const [setId, badgeRefs] of Object.entries(rawBadgeSets)) {
    if (Array.isArray(badgeRefs)) {
      badgeSets[setId] = badgeRefs;
      continue;
    }

    if (
      typeof badgeRefs === 'object' &&
      badgeRefs !== null &&
      badgeRefs.include === 'all-providers'
    ) {
      badgeSets[setId] = Object.keys(providers);
      continue;
    }

    throw new Error(
      `Badge set "${setId}" must be an array or { "include": "all-providers" }.`,
    );
  }

  return badgeSets;
}

async function loadProjectFiles() {
  let entries = [];

  try {
    entries = await fs.readdir(projectsDirPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }

  const projects = {};
  const projectFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of projectFiles) {
    const filePath = path.join(projectsDirPath, entry.name);
    const source = await readJson(filePath);
    const fileProjectId = path.basename(entry.name, '.json');
    const projectId = source.id ?? fileProjectId;

    if (projectId !== fileProjectId) {
      throw new Error(
        `Project file "${entry.name}" must use id "${fileProjectId}" or omit id.`,
      );
    }

    const { id: _id, ...config } = source;
    projects[projectId] = config;
  }

  return projects;
}

function mergeProjectSources(legacyProjects, fileProjects) {
  const projects = {};

  for (const [projectId, config] of Object.entries(legacyProjects)) {
    projects[projectId] = config;
  }

  for (const [projectId, config] of Object.entries(fileProjects)) {
    if (Object.prototype.hasOwnProperty.call(projects, projectId)) {
      throw new Error(`Project "${projectId}" is defined more than once.`);
    }

    projects[projectId] = config;
  }

  return projects;
}

function getProjectEntries(projects, projectOrder = []) {
  const remainingProjectIds = new Set(Object.keys(projects));
  const entries = [];

  for (const projectId of projectOrder) {
    if (!remainingProjectIds.has(projectId)) {
      throw new Error(`projectOrder references unknown project "${projectId}".`);
    }

    entries.push([projectId, projects[projectId]]);
    remainingProjectIds.delete(projectId);
  }

  for (const projectId of [...remainingProjectIds].sort()) {
    entries.push([projectId, projects[projectId]]);
  }

  return entries;
}

function collectProviderIds(projectId, badgeRefs, badgeSets, stack = []) {
  const providerIds = [];

  for (const badgeRef of badgeRefs) {
    if (
      typeof badgeRef === 'object' &&
      badgeRef !== null &&
      typeof badgeRef.set === 'string'
    ) {
      const setId = badgeRef.set;

      if (stack.includes(setId)) {
        throw new Error(
          `Project "${projectId}" contains a circular badge set reference: ${[
            ...stack,
            setId,
          ].join(' -> ')}.`,
        );
      }

      const setBadgeRefs = badgeSets[setId];
      if (!Array.isArray(setBadgeRefs)) {
        throw new Error(`Project "${projectId}" references unknown badge set "${setId}".`);
      }

      providerIds.push(
        ...collectProviderIds(projectId, setBadgeRefs, badgeSets, [...stack, setId]),
      );
      continue;
    }

    if (typeof badgeRef === 'string') {
      providerIds.push(badgeRef);
      continue;
    }

    if (
      typeof badgeRef === 'object' &&
      badgeRef !== null &&
      typeof badgeRef.provider === 'string'
    ) {
      providerIds.push(badgeRef.provider);
      continue;
    }

    throw new Error(`Project "${projectId}" contains an invalid badge reference.`);
  }

  return providerIds;
}

async function main() {
  const providersSource = await readJson(providersPath);
  const badgeSetsSource = await readJsonIfExists(badgeSetsPath, { sets: {} });
  const projectsSource = await readJson(projectsPath);
  const fileProjects = await loadProjectFiles();
  const targetsSource = await readJsonIfExists(targetsPath, { sites: [] });

  const providers = providersSource.providers ?? {};
  const badgeSets = normalizeBadgeSets(badgeSetsSource.sets ?? {}, providers);
  const legacyProjects =
    typeof projectsSource.projects === 'object' && projectsSource.projects !== null
      ? projectsSource.projects
      : {};
  const projects = mergeProjectSources(legacyProjects, fileProjects);
  const projectEntries = getProjectEntries(
    projects,
    Array.isArray(projectsSource.projectOrder) ? projectsSource.projectOrder : [],
  );

  const usage = new Map(Object.keys(providers).map((providerId) => [providerId, []]));
  const unknownProviders = new Map();

  console.log(`Providers: ${Object.keys(providers).length}`);
  console.log(`Badge sets: ${Object.keys(badgeSets).length}`);
  console.log(`Projects: ${projectEntries.length}`);
  console.log('');
  console.log('Project badge counts:');

  for (const [projectId, config] of projectEntries) {
    const providerIds = collectProviderIds(projectId, config.badges ?? [], badgeSets);
    console.log(`- ${projectId}: ${providerIds.length}`);

    for (const providerId of providerIds) {
      if (!usage.has(providerId)) {
        const projectsUsingUnknown = unknownProviders.get(providerId) ?? [];
        projectsUsingUnknown.push(projectId);
        unknownProviders.set(providerId, projectsUsingUnknown);
        continue;
      }

      usage.get(providerId).push(projectId);
    }
  }

  const unusedProviderIds = [...usage.entries()]
    .filter(([, projectIds]) => projectIds.length === 0)
    .map(([providerId]) => providerId)
    .sort();

  console.log('');
  console.log(
    `Unused providers: ${unusedProviderIds.length ? unusedProviderIds.join(', ') : 'none'}`,
  );

  if (unknownProviders.size > 0) {
    console.log('');
    console.log('Unknown providers:');
    for (const [providerId, projectIds] of [...unknownProviders.entries()].sort()) {
      console.log(`- ${providerId}: ${projectIds.join(', ')}`);
    }
  }

  if (Array.isArray(targetsSource.sites)) {
    const enabledCount = targetsSource.sites.filter((site) => site.enabled !== false).length;
    console.log('');
    console.log(`Revalidate targets: ${enabledCount}/${targetsSource.sites.length} enabled`);
  }
}

await main();
