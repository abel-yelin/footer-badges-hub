---
name: footer-badges-install
description: Install and integrate @luolink/footer-badges into an existing Next.js project that already has a footer. Use when Codex needs to add the footer badge system, preserve the site's existing footer layout, discover the right footer and layout files automatically, add runtime badge fetching, add the revalidate route, configure fallback badges, or wire the required environment variables for a project that consumes footer-badges-hub.
---

# Footer Badges Install

Install the footer badge system into an existing project without replacing the project's current footer.

## Workflow

1. Run `scripts/scan_next_footer_project.py <repo-path>` before editing.
2. Use the scan result to identify:
   - package manager
   - whether the repo uses the Next.js App Router
   - likely footer files
   - likely layout files
   - likely env example files
3. Inspect only the most relevant candidates from the scan output.
4. Confirm which layout actually renders the site's main footer.
5. Run `scripts/scaffold_footer_badges_integration.py <repo-path> --project-id <project-id> --install`.
6. Let the scaffold script install `@luolink/footer-badges`, create fallback config, create the revalidate route, create `FooterBadgesSlotServer`, patch the preferred layout, and update the env example.
7. Prefer the generated `FooterBadgesSlotServer` pattern for one-shot integration because it avoids rewriting the existing footer internals.
8. Only patch the existing footer directly when the user explicitly wants tighter visual integration inside the footer itself.
10. Verify the env example contains:
    - `FOOTER_BADGES_CONFIG_URL`
    - `FOOTER_BADGES_PROJECT_ID`
    - `FOOTER_BADGES_REVALIDATE_SECONDS`
    - `FOOTER_BADGES_REVALIDATE_TOKEN`
11. Validate the touched files with the repo's formatter, type checker, or other local checks.

## Automation

Use the bundled scan script first:

```bash
python <skill-path>/scripts/scan_next_footer_project.py <repo-path>
```

Treat the scan output as the default edit plan unless direct inspection shows a better target.

Then run the scaffold script:

```bash
python <skill-path>/scripts/scaffold_footer_badges_integration.py <repo-path> --project-id <project-id> --install
```

Use `--dry-run` first when you want a non-destructive preview.

## Rules

- Preserve the existing footer layout, links, branding, and information architecture.
- Only add the badge module; do not rewrite the entire footer unless the user explicitly asks.
- Prefer the site's existing layout and styling patterns.
- Keep badge rendering isolated so future SDK upgrades stay low-friction.
- If the project is not a Next.js App Router project, stop and explain the mismatch clearly.
- If scan results show multiple footer or layout candidates, inspect the smallest set needed and choose the one already used by the main marketing pages.

## Integration Shape

- Use `getRemoteFooterBadges()` on the server.
- Use `FooterBadgesMarquee` only for the badge area.
- Prefer a dedicated `FooterBadgesSlotServer` wrapper inserted immediately after the existing footer in the main layout.
- Use `handleFooterBadgesRevalidate()` for the refresh API.
- Keep a local fallback array so remote fetch failures do not break the footer.

Read [references/integration-patterns.md](references/integration-patterns.md) before editing. Reuse those patterns and adapt them to the target repo instead of inventing a new structure.
