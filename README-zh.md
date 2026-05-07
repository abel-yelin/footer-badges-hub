# Footer Badges Hub 中文执行手册

这份文档按可执行顺序整理。你只需要按下面步骤操作，就可以把“统一维护一套 footer badge，所有网站共用，并且无需重新 build 即可更新”的方案落地。

---

## 一、目标说明

你要搭建的是一个“中心配置仓库”，作用如下：

- 统一维护所有网站的 badge 模板和站点变量
- 把兼容旧接入的 `badges.json` 和按站点拆分的 JSON 发布到 GitHub Pages
- 各个网站运行时读取自己的远程配置
- 更新 badge 后，通过 GitHub Action 主动通知所有网站刷新缓存
- 不需要每个网站重新 build

---

## 二、你现在已经有什么

当前项目里已经完成了以下能力：

- 网站支持运行时读取远程 footer badge 配置
- 网站支持本地 fallback，远程失败不会挂
- 网站支持 `POST /api/revalidate-footer-badges` 刷新 badge 缓存

中心仓库模板在这里：

- [scaffolds/footer-badges-hub](/d:/workplace/stampmaker/stampmaker/scaffolds/footer-badges-hub)

你接下来要做的，就是把这个目录单独变成一个新的 GitHub 仓库。

---

## 三、第一步：创建中心仓库

1. 在 GitHub 上新建一个仓库  
   推荐仓库名：`footer-badges-hub`

2. 把下面这个目录里的所有文件复制到新仓库根目录：

```txt
scaffolds/footer-badges-hub
```

3. 推送到新仓库的 `main` 分支

复制后的仓库根目录里应至少包含这些文件：

- `data/badge-providers.json`
- `data/badge-sets.json`
- `data/projects/`
- `data/site-projects.json`
- `badges.json`
- `dist/projects/*.json`
- `site-targets.json`
- `.github/workflows/publish-badges.yml`
- `.github/workflows/revalidate-sites.yml`
- `scripts/notify-sites.mjs`
- `README.md`
- `README-zh.md`
- `SETUP.md`

---

## 四、第二步：开启 GitHub Pages

1. 打开这个新仓库
2. 进入 `Settings`
3. 点击左侧 `Pages`
4. 在 `Source` 里选择：

```txt
GitHub Actions
```

5. 保存

完成后，这个仓库就可以通过 workflow 自动把 `badges.json` 和每个站点自己的 JSON 发布到 GitHub Pages。

---

## 五、第三步：确认发布地址

GitHub Pages 启用后，最终 badge 配置地址通常是：

```txt
https://<你的 GitHub 组织或用户名>.github.io/<仓库名>/badges.json
```

例如：

```txt
https://abel-yelin.github.io/footer-badges-hub/badges.json
```

旧接入可以继续使用这个全集地址。新接入或升级后的站点，优先使用按站点拆分的地址：

```txt
https://<你的 GitHub 组织或用户名>.github.io/<仓库名>/projects/<project-id>.json
```

例如：

```txt
https://abel-yelin.github.io/footer-badges-hub/projects/stampmaker.json
```

这个地址后面要配置到每个网站的：

```txt
FOOTER_BADGES_CONFIG_URL
```

---

## 六、第四步：配置 badge 模板和站点变量

编辑中心仓库里的：

- `data/badge-providers.json`
- `data/badge-sets.json`
- `data/site-projects.json`
- `data/projects/<project-id>.json`

### `badge-providers.json` 作用

- 维护每一个 badge 平台的标准模板
- 使用占位符变量，例如 `{siteSlug}`、`{listingSlug}`、`{domain}`
- 一个平台只定义一次，所有网站复用

示例：

```json
{
  "findly": {
    "hrefTemplate": "https://findly.tools/{siteSlug}?utm_source={siteSlug}",
    "alt": "Featured on Findly.tools",
    "src": "https://findly.tools/badges/findly-tools-badge-light.svg",
    "width": 175,
    "height": 55
  }
}
```

### `badge-sets.json` 作用

- 维护可复用的 badge 顺序列表
- 多个网站共用同一套 badge 时，只需要引用同一个 set
- 公共 badge 增删改时，只改一个地方

示例：

```json
{
  "sets": {
    "all-providers": {
      "include": "all-providers"
    }
  }
}
```

### `site-projects.json` 作用

- 维护全局 footer 文案（如版权）
- 维护 `projectOrder`，保证生成后的项目顺序稳定
- 不再把所有网站变量堆在一个大文件里

示例：

```json
{
  "global": {
    "footer": {
      "copyrightTemplate": "© {currentYear} {domain}"
    }
  },
  "projectOrder": ["stampmaker", "pdftourl"]
}
```

### `data/projects/<project-id>.json` 作用

- 维护单个网站的变量
- 决定该网站启用哪些 badge set 或单个 badge provider
- 用 `overrides` 处理某个网站的特殊 alt、label、src、target、width、height

示例：

```json
{
  "id": "stampmaker",
  "variables": {
    "siteSlug": "stampmaker",
    "listingSlug": "stamp-maker",
    "domain": "www.stampmaker.io"
  },
  "badges": [
    {
      "set": "all-providers"
    }
  ]
}
```

### 最终维护原则

- badge 平台规则写在 `data/badge-providers.json`
- 公共 badge 顺序写在 `data/badge-sets.json`
- 全局配置和项目顺序写在 `data/site-projects.json`
- 网站变量写在 `data/projects/<project-id>.json`
- 不再手工维护完整 `badges.json`
- `badges.json` 和 `dist/projects/*.json` 都由脚本自动生成

### 本地生成命令

```txt
npm run build:badges
```

执行后会自动生成新的 `badges.json`，以及每个站点自己的 `dist/projects/<project-id>.json`。

### 本地维护报表

```txt
npm run report:badges
```

执行后可以看到 provider 数量、badge set 数量、每个项目的 badge 数量、未被使用的 provider、以及通知目标数量。

---

## 七、第五步：配置需要通知刷新的站点

编辑中心仓库里的：

- `site-targets.json`

当前你已经有这些站点：

- `https://www.stampmaker.io/api/revalidate-footer-badges`
- `https://www.pdftourl.net/api/revalidate-footer-badges`
- `https://www.mp3tourl.com/api/revalidate-footer-badges`
- `https://www.videotourl.com/api/revalidate-footer-badges`
- `https://googlies.online/api/revalidate-footer-badges`

### 当前配置含义

```json
{
  "name": "stampmaker",
  "enabled": true,
  "revalidateUrl": "https://www.stampmaker.io/api/revalidate-footer-badges",
  "tokenKey": "stampmaker"
}
```

字段说明：

- `name`：站点名称，仅用于日志显示
- `enabled`：是否启用这条通知
- `revalidateUrl`：目标网站的 badge 刷新接口
- `tokenKey`：从 GitHub Secret 里取 token 的 key

### 后续新增网站时

只需要继续往 `sites` 数组里追加一项即可。

---

## 八、第六步：给中心仓库配置 GitHub Secret

打开中心仓库：

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. 新建一个 Secret：

```txt
SITE_REVALIDATE_TOKENS_JSON
```

值写成一个 JSON，例如：

```json
{
  "stampmaker": "your-stampmaker-token",
  "mp3tourl": "your-mp3tourl-token",
  "videotourl": "your-videotourl-token"
}
```

注意：

- 这里的 key 必须和 `site-targets.json` 里的 `tokenKey` 一致
- value 必须和每个网站自己的 `FOOTER_BADGES_REVALIDATE_TOKEN` 一致

---

## 九、第七步：给每个网站配置环境变量

每个消费 badge 的网站都需要配置以下环境变量。

### stampmaker.io

```env
FOOTER_BADGES_CONFIG_URL="https://abel-yelin.github.io/footer-badges-hub/projects/stampmaker.json"
FOOTER_BADGES_PROJECT_ID="stampmaker"
FOOTER_BADGES_REVALIDATE_TOKEN="your-stampmaker-token"
FOOTER_BADGES_REVALIDATE_SECONDS="3600"
```

### pdftourl.net

```env
FOOTER_BADGES_CONFIG_URL="https://abel-yelin.github.io/footer-badges-hub/projects/pdftourl.json"
FOOTER_BADGES_PROJECT_ID="pdftourl"
FOOTER_BADGES_REVALIDATE_TOKEN="your-pdftourl-token"
FOOTER_BADGES_REVALIDATE_SECONDS="3600"
```

### mp3tourl.com

```env
FOOTER_BADGES_CONFIG_URL="https://abel-yelin.github.io/footer-badges-hub/projects/mp3tourl.json"
FOOTER_BADGES_PROJECT_ID="mp3tourl"
FOOTER_BADGES_REVALIDATE_TOKEN="your-mp3tourl-token"
FOOTER_BADGES_REVALIDATE_SECONDS="3600"
```

### videotourl.com

```env
FOOTER_BADGES_CONFIG_URL="https://abel-yelin.github.io/footer-badges-hub/projects/videotourl.json"
FOOTER_BADGES_PROJECT_ID="videotourl"
FOOTER_BADGES_REVALIDATE_TOKEN="your-videotourl-token"
FOOTER_BADGES_REVALIDATE_SECONDS="3600"
```

### googlies.online

```env
FOOTER_BADGES_CONFIG_URL="https://abel-yelin.github.io/footer-badges-hub/projects/googlies.json"
FOOTER_BADGES_PROJECT_ID="googlies"
FOOTER_BADGES_REVALIDATE_TOKEN="your-googlies-token"
FOOTER_BADGES_REVALIDATE_SECONDS="3600"
```

---

## 十、第八步：确保每个网站都已经接入运行时 badge 方案

这一点非常重要。

每个网站都必须已经具备这 3 个能力：

1. 运行时读取 `FOOTER_BADGES_CONFIG_URL`
2. 根据 `FOOTER_BADGES_PROJECT_ID` 读取对应项目配置
3. 支持接口：

```txt
POST /api/revalidate-footer-badges
```

如果某个网站还没接入这套逻辑，那么中心仓库即使通知它，它也不会更新。

---

## 十一、第九步：首次发布中心配置

当你完成了：

- `data/badge-providers.json`
- `data/badge-sets.json`
- `data/site-projects.json`
- `data/projects/`
- `site-targets.json`
- `SITE_REVALIDATE_TOKENS_JSON`
- 各网站环境变量

之后，执行：

1. 提交中心仓库代码
2. push 到 `main`

GitHub Actions 会自动执行：

- `Publish Footer Badges`

它会做两件事：

1. 先自动生成 `badges.json` 和 `dist/projects/*.json`
2. 把这些 JSON 发布到 GitHub Pages
3. 自动调用所有站点的 `/api/revalidate-footer-badges`

---

## 十二、第十步：验证是否成功

### 1. 验证 GitHub Pages 是否成功发布

打开：

```txt
https://abel-yelin.github.io/footer-badges-hub/badges.json
```

也可以检查单站点配置：

```txt
https://abel-yelin.github.io/footer-badges-hub/projects/stampmaker.json
```

确认返回的是你最新的 JSON 内容。

### 2. 验证 GitHub Action 是否成功通知站点

查看中心仓库 workflow：

- `Publish Footer Badges`

里面的 `notify-sites` job 应该能看到类似日志：

```txt
OK stampmaker
OK pdftourl
OK mp3tourl
OK videotourl
OK googlies
```

### 3. 验证网站页面是否刷新

分别打开：

- `https://www.stampmaker.io`
- `https://www.pdftourl.net`
- `https://www.mp3tourl.com`
- `https://www.videotourl.com`
- `https://googlies.online`

查看 footer badge 是否更新。

---

## 十三、以后每次更新 badge 的标准流程

以后你只需要做这几步：

1. 修改中心仓库 `data/badge-providers.json`、`data/badge-sets.json`、`data/site-projects.json` 或 `data/projects/<project-id>.json`
2. 提交并 push 到 `main`
3. 等 GitHub Action 自动完成
4. 检查各站点 footer 是否更新

整个过程中：

- 不需要每个站点重新 build
- 不需要每个站点手工改代码
- 不需要每个站点分别部署

---

## 十四、如果某个网站没有更新，怎么排查

按下面顺序检查：

1. 中心仓库的 `data/projects/<project-id>.json` 是否存在，且 `data/site-projects.json` 的 `projectOrder` 是否需要追加该项目
2. 该网站的 `FOOTER_BADGES_PROJECT_ID` 是否正确
3. 该网站的 `FOOTER_BADGES_CONFIG_URL` 是否正确
4. 中心仓库的 `site-targets.json` 是否包含该网站
5. `SITE_REVALIDATE_TOKENS_JSON` 里的 token 是否与该网站一致
6. 该网站的 `/api/revalidate-footer-badges` 是否可访问
7. GitHub Action 日志里是否显示 `OK`

---

## 十五、你现在应该先做什么

按顺序执行：

1. 新建 GitHub 仓库 `footer-badges-hub`
2. 把 `scaffolds/footer-badges-hub` 里的内容复制进去
3. 启用 GitHub Pages
4. 配置 `SITE_REVALIDATE_TOKENS_JSON`
5. 给所有消费站点配置环境变量
6. push 中心仓库到 `main`
7. 检查 Pages 和 Action 结果
8. 验证所有站点 footer 是否更新

---

## 十六、补充建议

建议你后续统一使用以下命名规则：

- 项目 key：
  - `stampmaker`
  - `pdftourl`
  - `mp3tourl`
  - `videotourl`
  - `googlies`

- token key：
  - `stampmaker`
  - `pdftourl`
  - `mp3tourl`
  - `videotourl`
  - `googlies`

这样配置最不容易出错。

---

## 十七、如果你下一步还要我继续做

我可以继续帮你做下面任意一项：

1. 给 `mp3tourl.com` 接入同样的运行时 badge 系统
2. 给 `videotourl.com` 接入同样的运行时 badge 系统
3. 直接帮你生成中心仓库第一版可提交的完整文件内容
4. 帮你写一份“GitHub 上怎么点按钮”的更细致图文步骤
