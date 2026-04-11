# Integration Patterns

Use these patterns as the default implementation shape when integrating `@luolink/footer-badges`.

Run the scan script first:

```bash
python <skill-path>/scripts/scan_next_footer_project.py <repo-path>
```

Use its JSON output to choose the repo's real footer file, layout file, and env example file before editing.

After scanning, run the scaffold script to automate the repetitive setup work:

```bash
python <skill-path>/scripts/scaffold_footer_badges_integration.py <repo-path> --project-id <project-id> --install
```

The scaffold script:

- installs `@luolink/footer-badges`
- creates `src/config/footer-badges.ts`
- creates `src/app/api/revalidate-footer-badges/route.ts`
- creates `src/components/footer-badges-slot-server.tsx`
- patches the preferred layout to render `FooterBadgesSlotServer` after the existing footer
- appends the required footer badge env vars to the first detected env example file
- leaves only deployment and visual verification as follow-up work

## 1. Install the package

Prefer the package manager already detected by the scan script.

```bash
pnpm add @luolink/footer-badges
```

## 2. Add fallback config

Create `src/config/footer-badges.ts` if the repo does not already have one. The scaffold script does this automatically.

```ts
import type { FooterBadge } from '@luolink/footer-badges';

export const FOOTER_BADGES_FALLBACK: FooterBadge[] = [];
```

## 3. Load badges on the server

Prefer a dedicated server wrapper component so the existing footer does not need to be rewritten for the first integration pass.

```tsx
import { getRemoteFooterBadges } from '@luolink/footer-badges';
import { FOOTER_BADGES_FALLBACK } from '@/config/footer-badges';
import { FooterBadgesMarquee } from '@luolink/footer-badges';

export async function FooterBadgesSlotServer() {
  const badges = await getRemoteFooterBadges({
    configUrl: process.env.FOOTER_BADGES_CONFIG_URL,
    projectId: process.env.FOOTER_BADGES_PROJECT_ID ?? 'my-site',
    fallbackBadges: FOOTER_BADGES_FALLBACK,
    revalidateSeconds: Number(
      process.env.FOOTER_BADGES_REVALIDATE_SECONDS ?? 3600
    ),
  });

  if (badges.length === 0) {
    return null;
  }

  return <FooterBadgesMarquee badges={badges} className="w-full" />;
}
```

## 4. Attach the slot after the existing footer

Do not replace the footer. Attach the slot immediately after the footer component in the chosen layout.

```tsx
import { FooterBadgesSlotServer } from '@/components/footer-badges-slot-server';

<Footer />
<FooterBadgesSlotServer />
```

## 5. Add the revalidate route

Create `src/app/api/revalidate-footer-badges/route.ts`. The scaffold script does this automatically.

```ts
import { handleFooterBadgesRevalidate } from '@luolink/footer-badges';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return handleFooterBadgesRevalidate(request, NextResponse, {
    revalidate: (tag) => revalidateTag(tag, 'max'),
  });
}
```

If the target repo is on an older Next.js signature, adapt only the `revalidate` callback.

## 6. Add environment variables

Add these variables to the repo's env example and deployment environment. The scaffold script adds them to the first detected env example file.

```env
FOOTER_BADGES_CONFIG_URL=https://abel-yelin.github.io/footer-badges-hub/badges.json
FOOTER_BADGES_PROJECT_ID=your-project-id
FOOTER_BADGES_REVALIDATE_SECONDS=3600
FOOTER_BADGES_REVALIDATE_TOKEN=replace-with-your-token
```

## 7. Validate

After editing:

- format the touched files
- run a targeted type check if possible
- verify the footer still renders normally
- verify the badge section appears without breaking the old footer layout
