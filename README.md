# 📚 Papyrus · 个人书籍管理系统

> React 19 + TypeScript 的个人书架管理工具：**豆瓣元数据导入 + SQLite 本地存储 + 个人书评与阅读状态管理**，配一个暖色纸张质感的小清新 Web 界面。前端按功能模块化组织，后端为 Express + better-sqlite3，前后端共享 `src/shared/types.ts` 类型。

## ✨ 功能一览

- **豆瓣数据导入**
  - 按 ISBN 精确导入（支持 10/13 位，自动跳转解析）
  - 按书名 / 作者关键字搜索联想，一键入库
  - 自动抓取：封面（本地缓存）、内容简介、作者简介、目录、出版社、出版年、页数、定价、豆瓣评分与评价数
  - 同一本书自动去重（按豆瓣 subject id）
- **书架管理**
  - 关键字搜索（书名 / 作者 / ISBN / 出版社）、分类筛选、阅读状态筛选
  - 手动录入 / 编辑书籍全部字段
- **阅读状态**：每本书可标记 **未读 / 阅读中 / 已读 / 放弃**，封面角标与书架筛选、统计一目了然
- **个人书评**：星级评分 + 文字书评，随时增删
- **标签系统**：给书打多个标签，支持批量在弹窗中勾选 / 新建
- **分类系统**：自定义分类 + 颜色标识，重命名、删除
- **统计概览**：藏书总数、未读 / 阅读中 / 已读 / 放弃分布、标签、分类、书评数一目了然

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

## 🗂 目录结构

```text
papyrus/
├── src/
│   ├── shared/types.ts              # 前后端共享的类型定义
│   ├── server/                      # Express 后端（按分层模块化）
│   │   ├── index.ts                 # 服务入口（优雅退出、端口监听）
│   │   ├── app.ts                   # Express 组装 + dist/client 生产托管
│   │   ├── db/                      # schema.ts + 连接单例
│   │   ├── services/                # douban / cover / bookService
│   │   └── routes/                  # books / douban / meta
│   └── client/                      # ★ React 19 SPA（Vite 构建）
│       ├── index.html               # Vite 入口（root = src/client）
│       ├── main.tsx                 # React 挂载
│       ├── app/                     # 应用外壳（App、路由、全局刷新）
│       ├── api/                     # fetch 封装 + books / douban / meta 分域接口
│       ├── components/              # 通用 UI：Modal / Toast / 评分 / 封面…
│       ├── features/                # ★ 按功能模块化
│       │   ├── shelf/               #   书架主页（统计卡 + 筛选栏 + 网格）
│       │   ├── books/               #   书籍卡片 / 详情 / 表单 / 阅读状态 / 标签
│       │   ├── douban/              #   豆瓣导入（搜索 + 预览 + 手动录入）
│       │   ├── tags/                #   标签管理
│       │   └── categories/          #   分类管理
│       ├── lib/                     # 展示格式化工具
│       └── styles/style.css         # 暖纸主题（CSS 变量集中管理）
├── vite.config.ts                   # Vite 配置（root / 代理 / 输出目录）
├── dist/                            # 构建产物（server + client，不入库）
└── data/                            # 运行时数据（SQLite + 封面缓存，不入库）
```

## 🗄 数据存储

- **数据库**：SQLite（`better-sqlite3`），默认 `data/papyrus.db`
  - WAL 模式 + 外键级联（删除书籍自动清理书评 / 标签关联）
  - 启动时自动迁移旧库结构（借出状态 `status` → 阅读状态 `reading_status`）
- **封面**：抓取豆瓣封面后下载到 `data/covers/`，通过 `/covers/*` 静态服务访问（带豆瓣 Referer 绕过防盗链）

## 📖 API 一览

所有接口均为 JSON，错误统一返回 `{ "error": "..." }`。

### 书籍

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/books` | 列表，支持 `keyword` `categoryId` `tagId` `readingStatus(unread\|reading\|read\|abandoned)` `limit` `offset` |
| GET | `/api/books/:id` | 详情（含分类、标签、书评、阅读状态） |
| POST | `/api/books` | 手动新建，body 为 `BookInput`（`title` 必填） |
| PUT | `/api/books/:id` | 更新书籍信息（含阅读状态 `readingStatus`） |
| DELETE | `/api/books/:id` | 删除书籍（级联清理关联数据） |
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
| POST | `/api/douban/save` | 抓取并保存，body `{ isbn }` 或 `{ id }` 或 `{ searchResult }` |

### 元数据

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/categories` | 分类列表（含各分类书籍数） |
| POST | `/api/categories` | 新增分类 `{ name, color }` |
| PUT | `/api/categories/:id` | 更新分类 `{ name?, color? }` |
| DELETE | `/api/categories/:id` | 删除分类（书籍变为未分类） |
| GET | `/api/tags` | 标签列表（含各标签书籍数） |
| DELETE | `/api/tags/:id` | 删除标签 |
| GET | `/api/stats` | 统计概览 |

## 🌐 豆瓣数据源说明

- 豆瓣没有稳定的官方 API，本项目使用：
  - **搜索联想**：`https://book.douban.com/j/subject_suggest?q=xxx`（JSON）
  - **详情**：直接抓取 `book.douban.com/subject/{id}/` 的 HTML（`cheerio` 解析）
  - **ISBN**：请求 `book.douban.com/isbn/{isbn}/` 跟随 302 跳转得到 subject id
- 反爬策略应对：
  - 所有请求带浏览器 User-Agent；封面下载带 `Referer: https://book.douban.com/`
  - 抓取间隔 **800ms 节流**，避免频率过高被 403
  - 偶发 403 时请稍后重试，或降低并发导入频率

## 🎨 定制指南

- **主题配色**：`src/client/styles/style.css` 顶部的 CSS 变量 `--bg / --ink / --accent / --serif` 等，改一处全局生效
- **前端功能模块**：每个页面/弹窗对应 `src/client/features/<功能>/` 下的一个目录，互不耦合
- **默认分类**：`src/server/db/schema.ts` 的 `DEFAULT_CATEGORIES`
- **搜索联想接口**：若豆瓣变更接口，只需改 `src/server/services/douban.ts` 的 `searchDouban`
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
