# 📚 Papyrus · 个人书籍管理系统

> React 19 + TypeScript 的个人书架管理工具：**豆瓣 / Amazon / Open Library 三数据源元数据导入 + SQLite 本地存储 + 实体书 / 电子书载体类型 + 个人书评与阅读状态管理**，配一个暖色纸张质感的小清新 Web 界面。前端按功能模块化组织，后端为 Express + better-sqlite3，前后端共享 `src/shared/types.ts` 类型。

## ✨ 功能一览

- **数据导入（三数据源）**
  - **豆瓣**：按 ISBN 精确导入（支持 10/13 位，自动 302 跳转解析）、按书名 / 作者关键字搜索联想一键入库
  - **Amazon**：中文 / 英文书皆可，按 ASIN / ISBN 或搜索结果导入，无需登录凭证
  - **Open Library**：公开书目云（openlibrary.org），按书名 / 作者关键字搜索或 ISBN 精确导入，自动聚合作品与英文版次信息
  - 自动抓取：封面（本地缓存）、内容简介、作者简介、目录、出版社、出版年、页数、装帧、定价、评分与评价数
  - 同一本书自动去重（按豆瓣 subject id / Amazon ASIN / Open Library work key）
- **书架管理**
  - 关键字搜索（书名 / 作者 / ISBN / 出版社）、分类 / 阅读状态 / 载体类型筛选
  - 手动录入 / 编辑书籍全部字段；封面与电子书支持本地上传
- **书籍载体类型**：每本书标记 **实体书 / 电子书**，书架、清单、详情、统计全程区分
- **电子书文件**：上传 PDF / EPUB / MOBI / AZW3 / TXT 等到本地，详情页在线预览、一键下载（自动命名的「书名(作者).扩展名」）
- **阅读状态**：每本书可标记 **未读 / 阅读中 / 已读 / 放弃**，封面角标 + 书架筛选 + 统计一目了然
- **个人书评**：星级评分 + 文字书评，随时增删
- **标签系统**：给书打多个标签，支持批量在弹窗中勾选 / 新建
- **分类系统**：自定义分类 + 颜色标识，重命名、删除
- **统计概览**：左侧统计卡按「藏书 / 载体 / 阅读状态」分组展示，总数、实体书 / 电子书、状态分布、标签、分类、书评数一目了然

## 🚀 快速开始

```bash
# 1. 安装依赖（Node.js ≥ 20.19，建议 22+）
npm install --cache ./.npm-cache

# 2. 开发模式（Vite HMR 5173 + 后端 tsx watch 3000）
npm run dev

# 3. 打开浏览器（推荐 Chrome）
open http://localhost:5173
```

说明：

- 开发时页面由 **Vite dev server**（`http://localhost:5173`）提供，`/api` 与 `/covers` 自动代理到后端 `3000`；
- 后端可用环境变量 `PORT` 指定端口（默认 3000）；
- 首次启动会自动创建 `data/papyrus.db`（SQLite）并写入默认分类。

### 生产模式

```bash
npm run build    # vite build → dist/client；tsc → dist/server
npm start        # node dist/server/index.js（Express 同时托管 API 与 dist/client）
# 打开 http://localhost:3000
```

## ⚙️ 部署详解

> 一句话：**开发用 `npm run dev`；生产用 `npm run build && npm start`，单进程 Express 同时托管 API 与前端静态资源**。运行时数据全部落在 `data/` 目录，迁移时整体拷贝即可。

### 📋 前置要求

| 项 | 要求 |
|---|---|
| Node.js | `>= 20.19`（建议 22 LTS，ESM 项目） |
| 包管理器 | npm（可加 `--cache ./.npm-cache` 走本地缓存，避免重复下载） |
| 网络 | 导入豆瓣 / Amazon / Open Library 数据需能访问对应站点；封面下载带 Referer 防盗链 |
| 端口 | 默认 `3000`（后端，生产同时提供 Web 资源） |

### 🛠 开发模式（本地开发 / 调试）

```bash
npm install --cache ./.npm-cache
npm run dev
# 浏览器访问 http://localhost:5173
```

- `npm run dev` 通过 `scripts/dev.mjs` 并行拉起后端（`tsx watch src/server/index.ts`，监听 `3000`）与前端 Vite dev server（监听 `5173`，HMR）。
- Vite 已把 `/api`、`/covers` 代理到后端；凡带 `.ts/.tsx` 扩展名的 `/api` 请求按前端源码模块处理，避免和真实 API 前缀冲突。
- 只用后端：`npm run dev:server`；只用前端：`npm run dev:client`。

### 📦 生产构建与运行

```bash
npm run build      # 等价于 npm run build:client && npm run build:server
npm start          # 等价于 npm run build && node dist/server/index.js
```

- `build:client`：`vite build` → `dist/client`（React 静态资源，含 SPA 兜底）。
- `build:server`：`tsc -p tsconfig.server.json` → `dist/server`（ESM，NodeNext）。
- 启动后单进程在 `PORT`（默认 3000）同时提供：
  - `http://localhost:3000/` → 前端页面（`dist/client`，未命中静态文件的 GET 一律回退 `index.html`）
  - `/api/*` → 后端 JSON 接口
  - `/covers/*` → 本地封面缓存（30 天强缓存）
  - `/ebooks/*` → 电子书在线预览文件
- 健康检查：`GET /api/health` 返回 `{ "ok": true }`。

> ⚠️ 生产请确保 `PORT` 未被占用；首次启动自动建库并写入默认分类。

### 🗄 数据持久化与备份

运行时数据全部位于项目根 `data/`（已被 `.gitignore` 排除）：

```text
data/
├── papyrus.db       # SQLite 主库（WAL 模式）
├── papyrus.db-wal   # WAL 日志（-journal / -shm 同理）
├── covers/          # 豆瓣 / Amazon / Open Library 封面本地缓存
└── ebooks/          # 上传的电子书文件
```

**备份**：关闭服务后整体拷贝 `data/`，或仅 `papyrus.db` + `covers/` + `ebooks/`；恢复时放回原路径即可。

> 提示：SQLite 开了 WAL 模式，主库之外还有 `-wal` / `-shm` 文件，备份时应一并拷贝（或先停进程再拷贝），否则可能备份到不一致状态。

### 🔄 常驻运行（systemd / PM2）

**systemd**（`/etc/systemd/system/papyrus.service`）：

```ini
[Unit]
Description=Papyrus book manager
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/papyrus
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node dist/server/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now papyrus
journalctl -u papyrus -f   # 查看日志
```

**PM2**：

```bash
npm install -g pm2
NODE_ENV=production PORT=3000 pm2 start node --name papyrus -- dist/server/index.js
pm2 save && pm2 startup
```

> 常驻场景应直接 `node dist/server/index.js`（先 `npm run build` 一次）；用 `npm start` 会在每次重启前重新构建。

### 🌐 Nginx 反向代理（绑定 80 / 443 + HTTPS）

```nginx
server {
    listen 80;
    server_name your.domain.com;

    # 电子书上身体积较大，留出阈值（服务端默认 ≤ 100MB）
    client_max_body_size 110m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```

### 🐳 Docker 部署（可选）

仓库未内置 Dockerfile，可按需自建（示例）：

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --cache ./.npm-cache
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# 运行时数据目录（SQLite + covers + ebooks）挂到宿主机持久化
VOLUME /app/data
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
```

```bash
docker build -t papyrus .
docker run -d -p 3000:3000 -v /path/to/data:/app/data papyrus
```

### 🔌 环境变量 / 端口

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `3000` | 后端监听端口（生产同时提供前端资源） |
| `NODE_ENV` | — | 建议生产设为 `production` |

- 前端开发端口由 `vite.config.ts` 的 `server.port` 固定为 `5173`，可改 Vite 配置调整。
- 端口被占用时，后端会打印排查提示：`lsof -nP -iTCP:<PORT> -sTCP:LISTEN` 查看 PID → `kill <pid>`，或 `PORT=<新端口> npm run dev`。

### ❓ 常见问题

- **导入失败 / 403**：豆瓣有 800ms 反爬节流，偶发 403 请稍后重试；封面已带 Referer，若仍失败可在详情弹窗点「重新下载封面」。
- **上传电子书 / 大图超限**：服务端默认封面 ≤ 20MB、电子书 ≤ 100MB；经 Nginx 部署记得同步调大 `client_max_body_size`。
- **反向代理后刷新子路由 404**：SPA 兜底已处理（未命中静态文件回退 `index.html`）；确认 Nginx `location /` 代理到后端，而非直接指向静态目录。
- **页面空白 / API 失效**：多因后端未启动或端口被占；先 `curl http://localhost:<PORT>/api/health` 确认后端状态。

## 🗂 目录结构

```text
papyrus/
├── src/
│   ├── shared/types.ts              # 前后端共享的类型定义
│   ├── server/                      # Express 后端（按分层模块化）
│   │   ├── index.ts                 # 服务入口（优雅退出、端口监听、未捕获兜底）
│   │   ├── app.ts                   # Express 组装 + dist/client 生产托管 + /covers /ebooks 静态
│   │   ├── db/                      # schema.ts（建表 + 默认分类）+ 连接单例 + 目录常量
│   │   ├── services/                # douban / amazon / openLibrary / cover / ebook / bookService
│   │   └── routes/                  # books / douban / amazon / openLibrary / meta
│   └── client/                      # ★ React 19 SPA（Vite 构建）
│       ├── index.html               # Vite 入口（root = src/client）
│       ├── main.tsx                 # React 挂载
│       ├── app/                     # 应用外壳（App、路由、全局刷新）
│       ├── api/                     # fetch 封装 + books / douban / amazon / openLibrary / meta 分域接口
│       ├── components/              # 通用 UI：Modal / Toast / 评分 / 封面…
│       ├── features/                # ★ 按功能模块化
│       │   ├── shelf/               #   书架主页（分组统计卡 + 筛选栏 + 网格）
│       │   ├── books/               #   书籍卡片 / 详情 / 表单 / 载体类型 / 标签
│       │   ├── douban/              #   导入：选数据源 + 搜索预览 + 手动录入
│       │   ├── tags/                #   标签管理
│       │   └── categories/          #   分类管理
│       ├── lib/                     # 展示格式化与常量（bookType / readingStatus / format）
│       └── styles/style.css         # 暖纸主题（CSS 变量集中管理）
├── scripts/dev.mjs                  # 开发模式并行启动后端 + 前端
├── vite.config.ts                   # Vite 配置（root / 代理 / 输出目录）
├── dist/                            # 构建产物（server + client，不入库）
└── data/                            # 运行时数据（SQLite + covers + ebooks，不入库）
```

## 🗄 数据存储

- **数据库**：SQLite（`better-sqlite3`），默认 `data/papyrus.db`
  - WAL 模式 + 外键级联（删除书籍自动清理书评 / 标签关联）
  - 启动时自动迁移旧库结构（借出状态 `status` → 阅读状态 `reading_status`），并自动补写默认分类
- **封面**：抓取豆瓣 / Amazon / Open Library 封面后下载到 `data/covers/`，通过 `/covers/*` 静态服务访问（带对应 Referer 绕过防盗链，30 天强缓存）
- **电子书**：上传文件保存在 `data/ebooks/`，通过 `/ebooks/*` 在线预览，下载走 `/api/books/:id/ebook/download`

## 📖 API 一览

所有接口均为 JSON；上传类接口（封面 / 电子书）直接以文件二进制作为请求体，成功返回对应访问路径。错误统一返回 `{ "error": "..." }`。

### 书籍

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/books` | 列表，参数：`keyword` `categoryId` `tagId` `readingStatus(unread\|reading\|read\|abandoned)` `bookType(physical\|ebook)` `hasReview` `hasTag` `hasCategory` `limit` `offset` |
| GET | `/api/books/:id` | 详情（含分类、标签、书评、载体类型、电子书、阅读状态） |
| POST | `/api/books` | 手动新建，body 为 `BookInput`（`title` 必填；含 `bookType`） |
| PUT | `/api/books/:id` | 更新书籍信息（含阅读状态 `readingStatus`、载体类型 `bookType`） |
| DELETE | `/api/books/:id` | 删除书籍（级联清理关联数据） |
| POST | `/api/books/upload-cover` | 本地上传封面图片（body 为图片二进制，`Content-Type: image/*`，≤ 20MB），返回 `{ coverPath }` |
| POST | `/api/books/upload-ebook` | 本地上传电子书（body 为文件二进制 ≤ 100MB），返回 `{ ebookPath, ebookFilename, ebookSize }` |
| GET | `/api/books/:id/ebook/download` | 下载电子书（`Content-Disposition: attachment`，自动命名「书名(作者).扩展名」） |
| POST | `/api/books/:id/cover` | 重新下载豆瓣 / Amazon 封面（导入失败可手动重试） |
| POST | `/api/books/:id/tags` | 设置标签，body `{ tags: string[] }` |
| POST | `/api/books/:id/category` | 设置分类，body `{ categoryId: number \| null }` |
| POST | `/api/books/:id/reviews` | 写书评，body `{ rating?, content }` |
| PUT | `/api/reviews/:rid` | 更新书评 |
| DELETE | `/api/reviews/:rid` | 删除书评 |

### 豆瓣

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/douban/search?q=关键词` | 搜索联想（JSON） |
| GET | `/api/douban/book?isbn=xxx` 或 `?id=xxx` | 抓取详情预览（不保存） |
| POST | `/api/douban/save` | 抓取并保存，body `{ isbn }` / `{ id }` / `{ searchResult }`，可带 `bookType` |

### Amazon

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/amazon/search?q=关键词` | 英文书搜索（解析结果卡片） |
| GET | `/api/amazon/book?asin=xxx` 或 `?isbn=xxx` | 抓取详情预览（不保存） |
| POST | `/api/amazon/save` | 抓取并保存，body `{ asin }` / `{ isbn }` / `{ searchResult }`，可带 `bookType` |

### Open Library

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/ol/search?q=关键词` | 书名 / 作者 / ISBN 搜索（自动识别 ISBN 走精确匹配） |
| GET | `/api/ol/book?key=xxx` 或 `?isbn=xxx`（可带 `cover_i`） | 抓取详情预览（不保存） |
| POST | `/api/ol/save` | 抓取并保存，body `{ key }` / `{ isbn }` / `{ searchResult }`，可带 `bookType` |

### 元数据

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/categories` | 分类列表（含各分类书籍数） |
| POST | `/api/categories` | 新增分类 `{ name, color }` |
| PUT | `/api/categories/:id` | 更新分类 `{ name?, color? }` |
| DELETE | `/api/categories/:id` | 删除分类（书籍变为未分类） |
| GET | `/api/tags` | 标签列表（含各标签书籍数） |
| DELETE | `/api/tags/:id` | 删除标签 |
| GET | `/api/stats` | 统计概览（含总量 / 载体 / 阅读状态分布） |

## 🌐 数据源说明

两个数据源均无稳定官方 API，本项目直接抓取页面 / 接口解析（`cheerio`）；Open Library 则走其公开检索接口：

- **豆瓣**（`src/server/services/douban.ts`）
  - 搜索联想：`https://book.douban.com/j/subject_suggest?q=xxx`（JSON）
  - 详情：抓取 `book.douban.com/subject/{id}/` 的 HTML
  - ISBN：请求 `book.douban.com/isbn/{isbn}/` 跟随 302 跳转得到 subject id
- **Amazon**（`src/server/services/amazon.ts`）
  - 搜索：解析 `amazon.com/s?k=xxx` 的搜索结果卡片
  - 详情：按 ASIN / ISBN 抓取商品页，解析封面、书名、作者、出版社、出版年、ISBN 等
- **Open Library**（`src/server/services/openLibrary.ts`）
  - 搜索：`https://openlibrary.org/search.json?q=xxx`（自动识别 ISBN 走 `isbn:` 精确匹配）
  - 详情：`https://openlibrary.org/search.json?q=key:<work_key>`；ISBN、封面（`covers.openlibrary.org`）与版次信息来自其书目云

**反爬策略应对**：

- 所有请求带浏览器 User-Agent；封面下载带对应站点的 `Referer`（豆瓣 / `m.media-amazon.com` / `openlibrary.org`）
- 豆瓣抓取间隔 **800ms 节流**，避免频率过高被 403
- 偶发 403 时请稍后重试，或降低并发导入频率；封面失败可在详情弹窗手动「重新下载封面」

## 🎨 定制指南

- **主题配色**：`src/client/styles/style.css` 顶部的 CSS 变量 `--bg / --ink / --accent / --serif` 等，改一处全局生效
- **前端功能模块**：每个页面/弹窗对应 `src/client/features/<功能>/` 下的一个目录，互不耦合
- **默认分类**：`src/server/db/schema.ts` 的 `DEFAULT_CATEGORIES`
- **载体类型 / 阅读状态文案**：`src/client/lib/bookType.ts`、`src/client/lib/readingStatus.ts` 中的常量与展示映射
- **导入源切换 / 搜索接口**：豆瓣改 `src/server/services/douban.ts`、Amazon 改 `src/server/services/amazon.ts`、Open Library 改 `src/server/services/openLibrary.ts`
- **上传体积限制**：`src/server/app.ts` 的 `express.json({ limit: '2mb' })`；封面上传 `routes/books.ts` 的 `raw({ limit: '20mb' })`；电子书 `raw({ limit: '100mb' })`，可按需调整
- **端口**：后端环境变量 `PORT`（默认 3000）；前端开发端口由 `vite.config.ts` 的 `server.port` 控制（默认 5173）

## 🧪 开发命令

```bash
npm run dev           # 并行启动：后端 tsx watch + 前端 Vite（HMR）
npm run typecheck     # 前后端类型检查（server + client 两个 tsconfig）
npm run dev:server    # 仅后端（tsx watch，3000）
npm run dev:client    # 仅前端 Vite dev server（5173）
npm run build:client  # 构建 React 前端 → dist/client
npm run build:server  # tsc 编译后端 → dist/server
npm run build         # 二者全做
```

## 🐞 VS Code 调试

```text
Debug Server (tsx)        调试后端源码（src/server/index.ts）
Debug Server (compiled)   调试编译产物（dist/server/index.js，preLaunch 自动 build:server）
Debug Frontend (Chrome)   先 `npm run dev`，再对 http://localhost:5173 做前端断点调试
Debug Full Stack          一次启动：preLaunch 构建 → 启动 tsx 后端 → Chrome 打开 http://localhost:3000
```

## 📄 License

MIT
