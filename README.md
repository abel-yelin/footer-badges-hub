# Footer Badges Hub

This scaffold is a standalone central repository template for shared footer
badge config across many sites.

It publishes a backward-compatible `badges.json` plus per-project badge JSON
files to GitHub Pages, then notifies all subscribed sites to revalidate their
runtime footer badge cache after each update.

## Files

- `data/badge-providers.json`: reusable badge provider templates
- `data/badge-sets.json`: shared ordered badge sets reused by projects
- `data/site-projects.json`: global footer text and project output order
- `data/projects/*.json`: per-site footer text, variables, enabled badge sets/providers, and overrides
- `scripts/build-badges.mjs`: generates the final `badges.json`
- `scripts/report-badges.mjs`: prints a local maintenance report
- `badges.json`: generated legacy output containing all projects
- `dist/projects/*.json`: generated per-project outputs for smaller runtime fetches
- `site-targets.json`: the list of sites to notify after config changes
- `scripts/notify-sites.mjs`: posts revalidate requests to all configured sites
- `.github/workflows/publish-badges.yml`: publishes `badges.json` to GitHub Pages
- `.github/workflows/revalidate-sites.yml`: manually or automatically notifies all sites
- `SETUP.md`: copy-paste setup checklist for the standalone repo
- `package.json`: minimal Node metadata for the repo

## Recommended repository setup

1. Create a dedicated GitHub repository, for example `footer-badges-hub`.
2. Copy this entire directory into that repository root.
3. Enable GitHub Pages with `GitHub Actions` as the source.
4. Add the repository secret `SITE_REVALIDATE_TOKENS_JSON`.
5. Follow `SETUP.md` to register all consuming sites.

Example `SITE_REVALIDATE_TOKENS_JSON` secret value:

```json
{
  "stampmaker": "your-stampmaker-token",
  "mp3tourl": "your-mp3tourl-token",
  "videotourl": "your-videotourl-token"
}
```

## Published badge URL

After Pages is enabled, the published config will be available at:

```txt
https://abel-yelin.github.io/footer-badges-hub/badges.json
```

Existing sites can point `FOOTER_BADGES_CONFIG_URL` to that address.

For new or upgraded sites, prefer the per-project URL so each site fetches only
its own badges:

```txt
https://abel-yelin.github.io/footer-badges-hub/projects/<project-id>.json
```

## Site requirements

Each site should expose a protected runtime revalidate endpoint matching the
current project implementation:

```txt
POST /api/revalidate-footer-badges
Authorization: Bearer <FOOTER_BADGES_REVALIDATE_TOKEN>
```

## Update flow

1. Edit `data/badge-providers.json`, `data/badge-sets.json`, `data/site-projects.json`, or a file under `data/projects/`
2. Run `npm run build:badges` if you want to preview `badges.json` and `dist/projects/*.json` locally
3. Push to `main`
4. GitHub Actions regenerates `badges.json` and `dist/projects/*.json`
5. GitHub Pages republishes the full and per-project JSON files
6. The workflow notifies all configured sites
7. Each site revalidates the `footer-badges` cache tag immediately

Without notification, sites still update automatically after their configured
runtime cache TTL expires.

## Maintenance workflow

- Add a new badge platform in `data/badge-providers.json`.
- Use `{ "include": "all-providers" }` in `data/badge-sets.json` when every provider should be enabled for all projects.
- Add a reusable badge sequence in `data/badge-sets.json` when only some sites share the same list.
- Add one project file under `data/projects/<project-id>.json` for each site.
- Keep each project file explicit: set `footer.copyright`, define the site's placeholder variables, then reference shared badge sets.
- Use `overrides` inside a project badge set when one site needs different alt text, label, image, target, width, or height.
- Run `npm run report:badges` to see project badge counts, unused providers, and enabled revalidate targets.

Example project file:

```json
{
  "id": "mp3tourl",
  "footer": {
    "copyright": "© {currentYear} Googlies Media"
  },
  "variables": {
    "siteName": "mp3tourl",
    "siteSlug": "mp3tourl",
    "listingSlug": "mp3tourl",
    "domain": "www.mp3tourl.com",
    "domainRankDomain": "mp3tourl.com",
    "verifiedDrSlug": "mp3tourl-com",
    "startupFameSlug": "mp3tourl",
    "siteUrlEncoded": "https%3A%2F%2Fwww.mp3tourl.com%2F",
    "aidirsSlug": "mp3tourl",
    "huntifyAiSlug": "mp3tourl",
    "aiAgentsDirectorySlug": "mp3-to-url",
    "aiAgentsDirectoryAlt": "MP3 to URL - Featured AI Agent on AI Agents Directory"
  },
  "badges": [
    {
      "set": "all-providers",
      "overrides": {
        "verifieddr": {
          "target": "_blank"
        }
      }
    }
  ]
}
```
