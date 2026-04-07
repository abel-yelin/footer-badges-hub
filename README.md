# Footer Badges Hub

This scaffold is a standalone central repository template for shared footer
badge config across many sites.

It publishes `badges.json` to GitHub Pages and can notify all subscribed sites
 to revalidate their runtime footer badge cache after each update.

## Files

- `data/badge-providers.json`: reusable badge provider templates
- `data/site-projects.json`: per-site variables and enabled provider list
- `scripts/build-badges.mjs`: generates the final `badges.json`
- `badges.json`: generated output consumed by all sites
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

Point each site's `FOOTER_BADGES_CONFIG_URL` to that address.

## Site requirements

Each site should expose a protected runtime revalidate endpoint matching the
current project implementation:

```txt
POST /api/revalidate-footer-badges
Authorization: Bearer <FOOTER_BADGES_REVALIDATE_TOKEN>
```

## Update flow

1. Edit `data/badge-providers.json` or `data/site-projects.json`
2. Run `npm run build:badges` if you want to preview the generated output locally
3. Push to `main`
4. GitHub Actions regenerates `badges.json`
5. GitHub Pages republishes `badges.json`
6. The workflow notifies all configured sites
7. Each site revalidates the `footer-badges` cache tag immediately

Without notification, sites still update automatically after their configured
runtime cache TTL expires.
