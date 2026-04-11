# @abel/footer-badges

这是一个可发布的内部 SDK 模板，用来把 footer badge 的接入逻辑从业务项目中抽离出来。

它解决 4 件事：

- 运行时读取远程 `badges.json`
- 解析和校验指定 `projectId` 的 badge
- 提供一个可直接使用的流动展示 React 组件
- 提供一个可复用的 revalidate handler

## 目录结构

```txt
src/
  index.ts
  types.ts
  constants.ts
  core/
    validate-footer-badges.ts
    extract-project-footer-badges.ts
  next/
    get-remote-footer-badges.ts
    handle-footer-badges-revalidate.ts
  react/
    footer-badges-marquee.tsx
```

## 对外 API

- `FOOTER_BADGES_CACHE_TAG`
- `isFooterBadge()`
- `extractProjectFooterBadges()`
- `getRemoteFooterBadges()`
- `handleFooterBadgesRevalidate()`
- `FooterBadgesMarquee`

## 安装

```bash
pnpm add @abel/footer-badges
```

## 服务端读取远程 badge

```ts
import { getRemoteFooterBadges } from '@abel/footer-badges';

const badges = await getRemoteFooterBadges({
  configUrl: process.env.FOOTER_BADGES_CONFIG_URL,
  projectId: process.env.FOOTER_BADGES_PROJECT_ID ?? 'stampmaker',
  fallbackBadges: [],
  revalidateSeconds: 3600,
});
```

## React 渲染

```tsx
import { FooterBadgesMarquee } from '@abel/footer-badges';

<FooterBadgesMarquee badges={badges} />
```

如果你不想自动滚动，也可以在业务项目里自己封装一层，或者未来扩展第二个静态组件。

## 老项目怎么接入

老项目已经有自己的 footer 时，不要用 SDK 替换整个 footer。正确方式是保留原有 footer，只把 badge 区块接进去。

标准接入只需要 4 步。

### 1. 安装 SDK

```bash
pnpm add @abel/footer-badges
```

### 2. 给项目准备 fallback badge 配置

建议在项目里保留一个本地兜底文件，例如 `src/config/footer-badges.ts`：

```ts
import type { FooterBadge } from '@abel/footer-badges';

export const FOOTER_BADGES_FALLBACK: FooterBadge[] = [];
```

如果远程配置拉取失败，页面仍然可以正常渲染。

### 3. 在服务端读取 badge，并传给你现有的 footer

```tsx
import { getRemoteFooterBadges } from '@abel/footer-badges';
import { FOOTER_BADGES_FALLBACK } from '@/config/footer-badges';
import { Footer } from '@/components/footer';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const badges = await getRemoteFooterBadges({
    configUrl: process.env.FOOTER_BADGES_CONFIG_URL,
    projectId: process.env.FOOTER_BADGES_PROJECT_ID ?? 'my-site',
    fallbackBadges: FOOTER_BADGES_FALLBACK,
    revalidateSeconds: Number(
      process.env.FOOTER_BADGES_REVALIDATE_SECONDS ?? 3600
    ),
  });

  return (
    <>
      {children}
      <Footer badges={badges} />
    </>
  );
}
```

### 4. 在你现有 footer 里插入 badge 模块

```tsx
import type { FooterBadge } from '@abel/footer-badges';
import { FooterBadgesMarquee } from '@abel/footer-badges';

export function Footer({ badges }: { badges: FooterBadge[] }) {
  return (
    <footer>
      <div>{/* 原有 footer 内容 */}</div>
      <FooterBadgesMarquee badges={badges} className="mt-3" />
    </footer>
  );
}
```

重点是：

- 原有 footer 布局、链接、品牌样式全部保留
- SDK 只负责 badge 数据和 badge 渲染
- 不同网站模板不同也没有问题

## 老项目接入时需要的环境变量

```env
FOOTER_BADGES_CONFIG_URL=https://abel-yelin.github.io/footer-badges-hub/badges.json
FOOTER_BADGES_PROJECT_ID=your-project-id
FOOTER_BADGES_REVALIDATE_SECONDS=3600
FOOTER_BADGES_REVALIDATE_TOKEN=replace-with-your-token
```

其中：

- `FOOTER_BADGES_CONFIG_URL`：中心配置地址
- `FOOTER_BADGES_PROJECT_ID`：当前站点在远程配置里的项目标识
- `FOOTER_BADGES_REVALIDATE_SECONDS`：服务端缓存时间
- `FOOTER_BADGES_REVALIDATE_TOKEN`：供 hub 调用刷新接口使用

## Next.js revalidate 路由

为了兼容 Next 15 和 Next 16 不同版本对 `revalidateTag` 的签名差异，SDK 不直接强绑 `revalidateTag()`，而是要求项目把自己的 revalidate 函数传进来。

```ts
import { handleFooterBadgesRevalidate } from '@abel/footer-badges';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return handleFooterBadgesRevalidate(request, NextResponse, {
    revalidate: (tag) => revalidateTag(tag, 'max'),
  });
}
```

如果你的 Next 版本还是旧签名，也只需要调整这一行，不需要改 SDK。

老项目建议直接新增一个路由文件，例如 `src/app/api/revalidate-footer-badges/route.ts`：

```ts
import { handleFooterBadgesRevalidate } from '@abel/footer-badges';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return handleFooterBadgesRevalidate(request, NextResponse, {
    revalidate: (tag) => revalidateTag(tag, 'max'),
  });
}
```

这样 `footer-badges-hub` 在 badge 更新后，就可以统一调用：

```txt
POST /api/revalidate-footer-badges
```

不需要你每次重新 build 每个站点。

## 站点仍然自己控制什么

SDK 不会接管整个 footer。业务项目仍然自己控制：

- badge 在 footer 的位置
- 外层排版
- 主题
- 边框、间距、容器背景

SDK 只负责 badge 这一小块能力。

## 构建与发布

```bash
npm run build
```

构建后产物输出到 `dist/`，包通过 `exports` 对外暴露。

## 推荐搭配

- 内容源：`footer-badges-hub`
- 站点接入：`@abel/footer-badges`

也就是：

- hub 负责统一 badge 模板和网站变量
- SDK 负责各网站低摩擦接入
