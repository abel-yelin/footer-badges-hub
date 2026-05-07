import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const providersPath = path.join(process.cwd(), 'data', 'badge-providers.json');
const badgeSetsPath = path.join(process.cwd(), 'data', 'badge-sets.json');
const projectsPath = path.join(process.cwd(), 'data', 'site-projects.json');
const projectsDirPath = path.join(process.cwd(), 'data', 'projects');
const outputPath = path.join(process.cwd(), 'badges.json');

function replacePlaceholders(value, variables, context) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const resolved = variables[key];

    if (resolved === undefined || resolved === null || resolved === '') {
      throw new Error(`Missing variable "${key}" while building ${context}.`);
    }

    return String(resolved);
  });
}

function getOverrideValue(override, key, fallback) {
  return Object.prototype.hasOwnProperty.call(override, key)
    ? override[key]
    : fallback;
}

function resolveProjectFooter(config, globalConfig, variables) {
  const globalFooter =
    typeof globalConfig.footer === 'object' && globalConfig.footer !== null
      ? globalConfig.footer
      : {};
  const projectFooter =
    typeof config.footer === 'object' && config.footer !== null
      ? config.footer
      : {};

  const projectExplicit = getOverrideValue(
    projectFooter,
    'copyright',
    null,
  );
  if (typeof projectExplicit === 'string' && projectExplicit.trim() !== '') {
    return {
      copyright: replacePlaceholders(
        projectExplicit,
        variables,
        'project.footer.copyright',
      ),
    };
  }

  const template = getOverrideValue(
    projectFooter,
    'copyrightTemplate',
    getOverrideValue(
      globalFooter,
      'copyrightTemplate',
      getOverrideValue(globalConfig, 'footerCopyright', null),
    ),
  );

  if (typeof template !== 'string' || template.trim() === '') {
    return null;
  }

  return {
    copyright: replacePlaceholders(
      template,
      variables,
      'project.footer.copyrightTemplate',
    ),
  };
}

function applyTemplate(providerId, provider, variables, override = {}) {
  const badge = {
    href: replacePlaceholders(
      getOverrideValue(override, 'href', provider.hrefTemplate),
      variables,
      `${providerId}.href`,
    ),
    alt: replacePlaceholders(
      getOverrideValue(
        override,
        'alt',
        provider.altTemplate ?? provider.alt,
      ),
      variables,
      `${providerId}.alt`,
    ),
  };
  const targetValue = getOverrideValue(override, 'target', provider.target);
  const relValue = getOverrideValue(override, 'rel', provider.rel);

  const srcValue = getOverrideValue(
    override,
    'src',
    provider.srcTemplate ?? provider.src ?? null,
  );
  const labelValue = getOverrideValue(
    override,
    'label',
    provider.labelTemplate ?? provider.label ?? null,
  );
  const widthValue = getOverrideValue(override, 'width', provider.width);
  const heightValue = getOverrideValue(override, 'height', provider.height);

  if (srcValue) {
    badge.src = replacePlaceholders(srcValue, variables, `${providerId}.src`);
  }

  if (labelValue) {
    badge.label = replacePlaceholders(
      labelValue,
      variables,
      `${providerId}.label`,
    );
  }

  if (targetValue) {
    badge.target = replacePlaceholders(
      targetValue,
      variables,
      `${providerId}.target`,
    );
  }

  if (relValue) {
    badge.rel = replacePlaceholders(relValue, variables, `${providerId}.rel`);
  }

  if (widthValue !== undefined && widthValue !== null) {
    badge.width = widthValue;
  }

  if (heightValue !== undefined && heightValue !== null) {
    badge.height = heightValue;
  }

  if (!badge.src && !badge.label) {
    throw new Error(
      `Badge "${providerId}" must resolve to either an image badge or a text badge.`,
    );
  }

  return badge;
}

function resolveBadgeConfig(projectId, badgeRef, providers, variables) {
  if (typeof badgeRef === 'string') {
    const provider = providers[badgeRef];

    if (!provider) {
      throw new Error(`Project "${projectId}" references unknown provider "${badgeRef}".`);
    }

    return applyTemplate(badgeRef, provider, variables);
  }

  if (
    typeof badgeRef !== 'object' ||
    badgeRef === null ||
    typeof badgeRef.provider !== 'string'
  ) {
    throw new Error(`Project "${projectId}" contains an invalid badge reference.`);
  }

  const provider = providers[badgeRef.provider];

  if (!provider) {
    throw new Error(
      `Project "${projectId}" references unknown provider "${badgeRef.provider}".`,
    );
  }

  return applyTemplate(
    badgeRef.provider,
    provider,
    variables,
    badgeRef.override ?? {},
  );
}

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

async function loadBadgeSets(providers) {
  const source = await readJsonIfExists(badgeSetsPath, { sets: {} });

  if (
    typeof source !== 'object' ||
    source === null ||
    typeof source.sets !== 'object' ||
    source.sets === null
  ) {
    throw new Error('data/badge-sets.json must contain a sets object.');
  }

  const badgeSets = {};

  for (const [setId, badgeRefs] of Object.entries(source.sets)) {
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

function getBadgeProviderId(badgeRef) {
  if (typeof badgeRef === 'string') {
    return badgeRef;
  }

  if (
    typeof badgeRef === 'object' &&
    badgeRef !== null &&
    typeof badgeRef.provider === 'string'
  ) {
    return badgeRef.provider;
  }

  return null;
}

function mergeBadgeRefOverride(badgeRef, override) {
  if (typeof override !== 'object' || override === null) {
    throw new Error('Badge set overrides must be objects.');
  }

  if (typeof badgeRef === 'string') {
    return {
      provider: badgeRef,
      override,
    };
  }

  return {
    ...badgeRef,
    override: {
      ...(badgeRef.override ?? {}),
      ...override,
    },
  };
}

function expandBadgeReferences(projectId, badgeRefs, badgeSets, stack = []) {
  const expanded = [];

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

      const overrideMap = badgeRef.overrides ?? {};
      if (
        typeof overrideMap !== 'object' ||
        overrideMap === null ||
        Array.isArray(overrideMap)
      ) {
        throw new Error(
          `Project "${projectId}" badge set "${setId}" overrides must be an object.`,
        );
      }

      const expandedSetRefs = expandBadgeReferences(projectId, setBadgeRefs, badgeSets, [
        ...stack,
        setId,
      ]);

      for (const setBadgeRef of expandedSetRefs) {
        const providerId = getBadgeProviderId(setBadgeRef);
        const override =
          providerId && Object.prototype.hasOwnProperty.call(overrideMap, providerId)
            ? overrideMap[providerId]
            : null;

        expanded.push(
          override ? mergeBadgeRefOverride(setBadgeRef, override) : setBadgeRef,
        );
      }

      continue;
    }

    expanded.push(badgeRef);
  }

  return expanded;
}

async function main() {
  const providersSource = await readJson(providersPath);
  const projectsSource = await readJson(projectsPath);

  if (
    typeof providersSource !== 'object' ||
    providersSource === null ||
    typeof providersSource.providers !== 'object' ||
    providersSource.providers === null
  ) {
    throw new Error('data/badge-providers.json must contain a providers object.');
  }

  const badgeSets = await loadBadgeSets(providersSource.providers);
  const fileProjects = await loadProjectFiles();

  if (typeof projectsSource !== 'object' || projectsSource === null) {
    throw new Error('data/site-projects.json must contain an object.');
  }

  const providers = providersSource.providers;
  const globalConfig =
    typeof projectsSource.global === 'object' && projectsSource.global !== null
      ? projectsSource.global
      : {};
  const legacyProjects =
    typeof projectsSource.projects === 'object' && projectsSource.projects !== null
      ? projectsSource.projects
      : {};
  const projects = mergeProjectSources(legacyProjects, fileProjects);
  const projectEntries = getProjectEntries(
    projects,
    Array.isArray(projectsSource.projectOrder) ? projectsSource.projectOrder : [],
  );
  const generatedProjects = {};
  const generatedProjectMeta = {};

  if (projectEntries.length === 0) {
    throw new Error('No project configs found in data/site-projects.json or data/projects/.');
  }

  for (const [projectId, config] of projectEntries) {
    if (
      typeof config !== 'object' ||
      config === null ||
      !Array.isArray(config.badges)
    ) {
      throw new Error(`Project "${projectId}" must define a badges array.`);
    }

    const variables = {
      projectId,
      currentYear: new Date().getFullYear(),
      ...(config.variables ?? {}),
    };

    generatedProjects[projectId] = expandBadgeReferences(
      projectId,
      config.badges,
      badgeSets,
    ).map((badgeRef) => resolveBadgeConfig(projectId, badgeRef, providers, variables));

    const projectFooter = resolveProjectFooter(config, globalConfig, variables);
    if (projectFooter) {
      generatedProjectMeta[projectId] = {
        footer: projectFooter,
      };
    }
  }

  const generated = {
    version: 3,
    projects: generatedProjects,
    projectMeta: generatedProjectMeta,
  };

  await fs.writeFile(`${outputPath}\n`.trim(), `${JSON.stringify(generated, null, 2)}\n`);

  console.log(
    `Generated badges.json for ${Object.keys(generatedProjects).length} projects.`,
  );
}

await main();
