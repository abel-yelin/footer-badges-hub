#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
import shutil

from scan_next_footer_project import (
    detect_app_router,
    detect_package_manager,
    find_files,
    rel,
    ENV_HINTS,
    FOOTER_HINTS,
    LAYOUT_HINTS,
    pick_preferred_env,
    pick_preferred_layout,
)


DEFAULT_PACKAGE = '@luolink/footer-badges'
DEFAULT_CONFIG_URL = 'https://abel-yelin.github.io/footer-badges-hub/badges.json'
DEFAULT_TOKEN = 'replace-with-your-token'


def write_file(path: Path, content: str, dry_run: bool) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def ensure_env_block(content: str, project_id: str, config_url: str, token: str) -> str:
    block = (
        f'FOOTER_BADGES_CONFIG_URL={config_url}\n'
        f'FOOTER_BADGES_PROJECT_ID={project_id}\n'
        'FOOTER_BADGES_REVALIDATE_SECONDS=3600\n'
        f'FOOTER_BADGES_REVALIDATE_TOKEN={token}\n'
    )
    if 'FOOTER_BADGES_CONFIG_URL=' in content:
        return content
    separator = '' if content.endswith('\n') or content == '' else '\n'
    return f'{content}{separator}{block}'


def install_package(root: Path, manager: str, package_name: str, dry_run: bool) -> str:
    executables = {
        'pnpm': shutil.which('pnpm') or shutil.which('pnpm.cmd') or 'pnpm',
        'npm': shutil.which('npm') or shutil.which('npm.cmd') or 'npm',
        'bun': shutil.which('bun') or shutil.which('bun.cmd') or 'bun',
        'yarn': shutil.which('yarn') or shutil.which('yarn.cmd') or 'yarn',
    }
    commands = {
        'pnpm': [executables['pnpm'], 'add', package_name],
        'npm': [executables['npm'], 'install', package_name],
        'bun': [executables['bun'], 'add', package_name],
        'yarn': [executables['yarn'], 'add', package_name],
    }
    command = commands[manager]
    if not dry_run:
        subprocess.run(command, cwd=root, check=True)
    return ' '.join(command)


def relative_import(from_file: Path, to_file: Path) -> str:
    rel_path = to_file.relative_to(
        Path(
            *(
                []
                if to_file.anchor != from_file.anchor
                else [from_file.anchor]
            )
        )
    )
    relative = Path(
        *(
            __import__('os').path.relpath(to_file, from_file.parent).replace('\\', '/').split('/')
        )
    ).as_posix()
    if not relative.startswith('.'):
        relative = f'./{relative}'
    if relative.endswith('.tsx'):
        relative = relative[:-4]
    elif relative.endswith('.ts'):
        relative = relative[:-3]
    return relative


def build_slot_component_content(
    package_name: str,
    fallback_import: str,
    project_id: str,
) -> str:
    return (
        f"import {{ FooterBadgesMarquee, getRemoteFooterBadges }} from '{package_name}';\n"
        f"import {{ FOOTER_BADGES_FALLBACK }} from '{fallback_import}';\n\n"
        'export async function FooterBadgesSlotServer() {\n'
        '  const badges = await getRemoteFooterBadges({\n'
        "    configUrl: process.env.FOOTER_BADGES_CONFIG_URL,\n"
        f"    projectId: process.env.FOOTER_BADGES_PROJECT_ID ?? '{project_id}',\n"
        '    fallbackBadges: FOOTER_BADGES_FALLBACK,\n'
        '    revalidateSeconds: Number(\n'
        "      process.env.FOOTER_BADGES_REVALIDATE_SECONDS ?? 3600\n"
        '    ),\n'
        '  });\n\n'
        '  if (badges.length === 0) {\n'
        '    return null;\n'
        '  }\n\n'
        '  return (\n'
        '    <div className="border-t">\n'
        '      <div className="mx-auto flex max-w-7xl px-4 py-4 sm:px-6 lg:px-8">\n'
        '        <FooterBadgesMarquee badges={badges} className="w-full" />\n'
        '      </div>\n'
        '    </div>\n'
        '  );\n'
        '}\n'
    )


def patch_layout_with_badge_slot(
    layout_path: Path,
    slot_component_path: Path,
    dry_run: bool,
) -> dict[str, str | bool]:
    original = layout_path.read_text(encoding='utf-8')
    if 'FooterBadgesSlotServer' in original:
        return {'patched': False, 'reason': 'layout already references FooterBadgesSlotServer'}

    import_path = relative_import(layout_path, slot_component_path)
    import_line = f"import {{ FooterBadgesSlotServer }} from '{import_path}';\n"

    if import_line not in original:
        import_block_match = re.search(r'^(import .*\n)+', original, re.MULTILINE)
        if not import_block_match:
            raise RuntimeError('Could not locate import block in layout file.')
        updated = (
            original[: import_block_match.end()]
            + import_line
            + original[import_block_match.end() :]
        )
    else:
        updated = original

    footer_tag_patterns = [
        r'(<FooterServer\s*/>)',
        r'(<Footer\s*/>)',
        r'(<[A-Z][A-Za-z0-9_]*Footer[A-Za-z0-9_]*\s*/>)',
    ]

    replaced = False
    for pattern in footer_tag_patterns:
        match = re.search(pattern, updated)
        if match:
            snippet = match.group(1)
            replacement = (
                '<>\n'
                f'              {snippet}\n'
                '              <FooterBadgesSlotServer />\n'
                '            </>'
            )
            updated = updated.replace(snippet, replacement, 1)
            replaced = True
            break

    if not replaced:
        raise RuntimeError('Could not find a self-closing footer tag to attach FooterBadgesSlotServer.')

    if not dry_run:
        layout_path.write_text(updated, encoding='utf-8')

    return {'patched': True, 'reason': 'inserted FooterBadgesSlotServer after existing footer tag'}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('repo_path')
    parser.add_argument('--project-id', required=True)
    parser.add_argument('--package-name', default=DEFAULT_PACKAGE)
    parser.add_argument('--config-url', default=DEFAULT_CONFIG_URL)
    parser.add_argument('--token-placeholder', default=DEFAULT_TOKEN)
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--layout-file')
    args = parser.parse_args()

    root = Path(args.repo_path).resolve()
    if not detect_app_router(root):
        raise SystemExit('Target repo is not using the Next.js App Router.')

    package_manager = detect_package_manager(root)
    if not package_manager:
        raise SystemExit('Could not detect package manager.')

    footer_paths = find_files(root, FOOTER_HINTS)
    layout_paths = find_files(root, LAYOUT_HINTS)
    env_paths = find_files(root, ENV_HINTS)

    preferred_layout = args.layout_file or pick_preferred_layout(layout_paths, root)
    if not preferred_layout:
        raise SystemExit('Could not determine a preferred layout file. Pass --layout-file explicitly.')

    preferred_env = pick_preferred_env(env_paths, root)
    env_path = root / (preferred_env if preferred_env else 'env.example')
    fallback_path = root / 'src' / 'config' / 'footer-badges.ts'
    route_path = root / 'src' / 'app' / 'api' / 'revalidate-footer-badges' / 'route.ts'
    slot_component_path = root / 'src' / 'components' / 'footer-badges-slot-server.tsx'
    layout_path = root / preferred_layout

    fallback_content = (
        f"import type {{ FooterBadge }} from '{args.package_name}';\n\n"
        'export const FOOTER_BADGES_FALLBACK: FooterBadge[] = [];\n'
    )
    route_content = (
        f"import {{ handleFooterBadgesRevalidate }} from '{args.package_name}';\n"
        "import { revalidateTag } from 'next/cache';\n"
        "import { NextResponse } from 'next/server';\n"
        "import type { NextRequest } from 'next/server';\n\n"
        'export async function POST(request: NextRequest) {\n'
        '  return handleFooterBadgesRevalidate(request, NextResponse, {\n'
        "    revalidate: (tag) => revalidateTag(tag, 'max'),\n"
        '  });\n'
        '}\n'
    )

    fallback_import_for_slot = relative_import(slot_component_path, fallback_path)
    slot_content = build_slot_component_content(
        args.package_name,
        fallback_import_for_slot,
        args.project_id,
    )

    existing_env = env_path.read_text(encoding='utf-8') if env_path.exists() else ''
    env_content = ensure_env_block(
        existing_env,
        args.project_id,
        args.config_url,
        args.token_placeholder,
    )

    installed_command = None
    if args.install:
        installed_command = install_package(root, package_manager, args.package_name, args.dry_run)

    write_file(fallback_path, fallback_content, args.dry_run)
    if not route_path.exists() or args.dry_run:
        write_file(route_path, route_content, args.dry_run)
    write_file(slot_component_path, slot_content, args.dry_run)
    write_file(env_path, env_content, args.dry_run)

    layout_patch_result = patch_layout_with_badge_slot(
        layout_path,
        slot_component_path,
        args.dry_run,
    )

    result = {
        'root': str(root),
        'packageManager': package_manager,
        'installCommand': installed_command,
        'preferredLayout': preferred_layout,
        'footerCandidates': [rel(path, root) for path in footer_paths[:20]],
        'layoutCandidates': [rel(path, root) for path in layout_paths[:20]],
        'writtenFiles': {
            'fallbackConfig': rel(fallback_path, root),
            'revalidateRoute': rel(route_path, root),
            'badgeSlotServer': rel(slot_component_path, root),
            'envExample': rel(env_path, root),
        },
        'layoutPatch': layout_patch_result,
        'nextManualSteps': [
            'optionally move FooterBadgesSlotServer into the footer component later if the repo needs tighter visual integration',
            'deploy env vars to the hosting platform',
            'verify the badge rail renders after the existing footer',
        ],
        'dryRun': args.dry_run,
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
