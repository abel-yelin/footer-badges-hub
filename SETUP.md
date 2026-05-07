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

## 5. Configure badge templates and sites

Edit `data/badge-providers.json`:

- add one provider definition per badge platform
- use `{variableName}` placeholders inside `hrefTemplate`, `altTemplate`, `labelTemplate`, or `srcTemplate`

Edit `data/badge-sets.json`:

- use `{ "include": "all-providers" }` when every provider in `data/badge-providers.json` should be enabled for projects using that set
- add shared badge lists when multiple projects use the same providers in the same order
- keep one-off provider references inside the project file instead of making a set for every special case

Edit `data/site-projects.json`:

- configure global footer text
- optionally set `projectOrder` to keep generated output stable

Edit `data/projects/<project-id>.json`:

- define shared variables for that project
- list enabled badge sets and one-off providers in the desired order
- use `overrides` for provider-specific project exceptions

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

- Optionally run `npm run build:badges` locally to preview the generated file
- Optionally run `npm run report:badges` to inspect provider usage and project counts
- Push to `main`
- Wait for `Publish Footer Badges` to finish
- Confirm `badges.json` is reachable from GitHub Pages

## 8. Manual refresh

If needed, run the workflow:

- `Revalidate Footer Badge Consumers`

This calls every configured `revalidateUrl` without waiting for cache TTL expiry.
