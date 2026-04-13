import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const providersPath = path.join(process.cwd(), 'data', 'badge-providers.json');
const projectsPath = path.join(process.cwd(), 'data', 'site-projects.json');
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

  if (
    typeof projectsSource !== 'object' ||
    projectsSource === null ||
    typeof projectsSource.projects !== 'object' ||
    projectsSource.projects === null
  ) {
    throw new Error('data/site-projects.json must contain a projects object.');
  }

  const providers = providersSource.providers;
  const globalConfig =
    typeof projectsSource.global === 'object' && projectsSource.global !== null
      ? projectsSource.global
      : {};
  const projects = projectsSource.projects;
  const generatedProjects = {};
  const generatedProjectMeta = {};

  for (const [projectId, config] of Object.entries(projects)) {
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

    generatedProjects[projectId] = config.badges.map((badgeRef) =>
      resolveBadgeConfig(projectId, badgeRef, providers, variables),
    );

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
