# Setup Checklist

## 1. Create the repository

- Create a new GitHub repository such as `footer-badges-hub`
- Copy the contents of this scaffold into the repository root

## 2. Enable GitHub Pages

- Open `Settings -> Pages`
- Set `Source` to `GitHub Actions`

## 3. Configure secrets

Add this repository secret:

- `SITE_REVALIDATE_TOKENS_JSON`

Example value:

```json
{
  "stampmaker": "stampmaker-secret",
  "mp3tourl": "mp3tourl-secret",
  "videotourl": "videotourl-secret"
}
```

## 4. Configure target sites

Edit `site-targets.json`:

- `name`: human-readable site name
- `enabled`: set `false` to temporarily skip a site
- `revalidateUrl`: full `POST` endpoint on the target site
- `tokenKey`: key used to resolve the token from `SITE_REVALIDATE_TOKENS_JSON`

## 5. Configure badge projects

Edit `badges.json`:

- add one key per project under `projects`
- use the same project key as each site's `FOOTER_BADGES_PROJECT_ID`

## 6. Configure each consumer site

Every site needs:

- `FOOTER_BADGES_CONFIG_URL`
- `FOOTER_BADGES_PROJECT_ID`
- `FOOTER_BADGES_REVALIDATE_TOKEN`

Example:

```env
FOOTER_BADGES_CONFIG_URL="https://abel-yelin.github.io/footer-badges-hub/badges.json"
FOOTER_BADGES_PROJECT_ID="stampmaker"
FOOTER_BADGES_REVALIDATE_TOKEN="stampmaker-secret"
FOOTER_BADGES_REVALIDATE_SECONDS="3600"
```

## 7. Publish

- Push to `main`
- Wait for `Publish Footer Badges` to finish
- Confirm `badges.json` is reachable from GitHub Pages

## 8. Manual refresh

If needed, run the workflow:

- `Revalidate Footer Badge Consumers`

This calls every configured `revalidateUrl` without waiting for cache TTL expiry.
