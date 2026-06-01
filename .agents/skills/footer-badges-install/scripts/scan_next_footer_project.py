#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
import sys


FOOTER_HINTS = ('footer.tsx', 'Footer.tsx', 'footer.jsx', 'Footer.jsx')
LAYOUT_HINTS = ('layout.tsx', 'layout.jsx')
ENV_HINTS = (
    'env.example',
    '.env.example',
    '.env.local.example',
    '.env.production.example',
)
PACKAGE_MANAGER_FILES = {
    'pnpm': 'pnpm-lock.yaml',
    'npm': 'package-lock.json',
    'bun': 'bun.lockb',
    'yarn': 'yarn.lock',
}
EXCLUDED_DIRS = {
    '.git',
    '.next',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.vercel',
    '.open-next',
}
SEARCH_ROOTS = (
    'src',
    'app',
    'components',
)


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def find_files(root: Path, names: tuple[str, ...]) -> list[Path]:
    matches: list[Path] = []
    search_roots = [root / part for part in SEARCH_ROOTS if (root / part).exists()]
    if not search_roots:
        search_roots = [root]

    for base in search_roots:
        for current_root, dirnames, filenames in os.walk(base):
            dirnames[:] = [name for name in dirnames if name not in EXCLUDED_DIRS]
            current = Path(current_root)
            for filename in filenames:
                if filename in names:
                    matches.append(current / filename)

    return sorted(
        [
            path
            for path in matches
            if not any(part in EXCLUDED_DIRS for part in path.parts)
        ]
    )


def detect_package_manager(root: Path) -> str | None:
    for manager, lockfile in PACKAGE_MANAGER_FILES.items():
        if (root / lockfile).exists():
            return manager
    return None


def detect_app_router(root: Path) -> bool:
    app_dir = root / 'src' / 'app'
    if app_dir.exists():
        return True
    app_dir = root / 'app'
    return app_dir.exists()


def score_layout_candidate(path: Path, root: Path) -> tuple[int, int]:
    relative = rel(path, root)
    score = 0

    try:
        content = path.read_text(encoding='utf-8')
    except OSError:
        return (-1, 999999)

    if '<Footer' in content:
        score += 100
    if 'FooterServer' in content:
        score += 60
    if '(marketing)' in relative:
        score += 30
    if '/layout.tsx' in relative or relative.endswith('layout.tsx'):
        score += 5

    return (score, len(relative))


def pick_preferred_layout(layouts: list[Path], root: Path) -> str | None:
    if not layouts:
        return None
    ranked = sorted(layouts, key=lambda path: (-score_layout_candidate(path, root)[0], score_layout_candidate(path, root)[1]))
    best = ranked[0]
    if score_layout_candidate(best, root)[0] <= 0:
        return None
    return rel(best, root)


def pick_preferred_footer(footers: list[Path], root: Path) -> str | None:
    if not footers:
        return None
    ranked = sorted(footers, key=lambda path: (0 if 'layout' in path.parts else 1, len(rel(path, root))))
    return rel(ranked[0], root)


def pick_preferred_env(envs: list[Path], root: Path) -> str | None:
    if not envs:
        return None
    ranked = sorted(envs, key=lambda path: (0 if path.name == 'env.example' else 1, len(rel(path, root))))
    return rel(ranked[0], root)


def main() -> int:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()

    footer_paths = find_files(root, FOOTER_HINTS)
    layout_paths = find_files(root, LAYOUT_HINTS)
    env_paths = find_files(root, ENV_HINTS)

    footer_candidates = [rel(path, root) for path in footer_paths]
    layout_candidates = [rel(path, root) for path in layout_paths]
    env_candidates = [rel(path, root) for path in env_paths]

    result = {
        'root': str(root),
        'packageManager': detect_package_manager(root),
        'hasAppRouter': detect_app_router(root),
        'footerCandidates': footer_candidates[:20],
        'layoutCandidates': layout_candidates[:20],
        'envExampleCandidates': env_candidates[:20],
        'preferredFiles': {
            'footer': pick_preferred_footer(footer_paths, root),
            'layout': pick_preferred_layout(layout_paths, root),
            'envExample': pick_preferred_env(env_paths, root),
            'fallbackConfig': 'src/config/footer-badges.ts',
            'revalidateRoute': 'src/app/api/revalidate-footer-badges/route.ts',
            'badgeSlotServer': 'src/components/footer-badges-slot-server.tsx',
        },
    }

    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
