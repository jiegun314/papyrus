# 📚 Papyrus · 个人书籍管理系统

> 纯 TypeScript 实现的书架管理工具：**豆瓣元数据导入 + SQLite 本地存储 + 个人书评与借阅管理**，配一个暖色纸张质感的小清新 Web 界面。

## ✨ 功能一览

- **豆瓣数据导入**
  - 按 ISBN 精确导入（支持 10/13 位，自动跳转解析）
  - 按书名 / 作者关键字搜索联想，一键入库
  - 自动抓取：封面（本地缓存）、内容简介、作者简介、目录、出版社、出版年、页数、定价、豆瓣评分与评价数
  - 同一本书自动去重（按豆瓣 subject id）
- **书架管理**
  - 关键字搜索（书名 / 作者 / ISBN / 出版社）、分类筛选、状态筛选
  - 手动录入 / 编辑书籍全部字段
- **个人书评**：星级评分 + 文字书评，随时增删
- **标签系统**：给书打多个标签，支持批量在弹窗中勾选 / 新建
- **分类系统**：自定义分类 + 颜色标识，重命名、删除
- **借阅管理**：一键借出 / 归还，借阅人、备注、时间记录，借阅历史查询
- **统计概览**：藏书总数、在架 / 借出、标签、分类、书评数一目了然

## 🚀 快速开始

```bash
# 1. 安装依赖（Node.js ≥ 18，建议 20+）
npm install --cache ./.npm-cache

# 2. 开发模式（热重载，默认端口 3000）
npm run dev
# 或指定端口
PORT=8080 npm run dev

# 3. 打开浏览器
open http://localhost:3000
```

首次启动会自动创建 `data/papyrus.db`（SQLite）并写入默认分类。

### 生产模式

```bash
npm run build    # 构建前端 app.js + 后端 dist/
npm start        # node dist/server/index.js
```

## 🗂 目录结构

```
papyrus/
├── src/
│   ├── shared/types.ts        # 前后端共享的类型定义
│   ├── server/
│   │   ├── index.ts           # 服务入口（优雅退出、端口监听）
│   │   ├── app.ts             # Express 应用组装
│   │   ├── db/
│   │   │   ├── schema.ts      # SQLite 建表语句 + 默认分类
│   │   │   └── index.ts       # 连接单例、行映射工具
│   │   ├── services/
│   │   │   ├── douban.ts      # 豆瓣抓取（搜索 / 详情 / ISBN 解析）
│   │   │   ├── cover.ts       # 封面下载与本地缓存
│   │   │   └── bookService.ts # 书籍 / 标签 / 书评 / 借阅业务
│   │   └── routes/
│   │       ├── books.ts       # /api/books 增删改查
│   │       ├── douban.ts      # /api/douban 豆瓣导入
│   │       └── meta.ts        # /api/categories|tags|lendings|stats
│   └── frontend/
│       ├── main.ts            # 前端主逻辑（视图 + 交互）
│       ├── api.ts             # API 封装
│       ├── ui.ts              # 弹窗 / Toast / 评分等 UI 工具
│       └── style.css          # 样式（暖纸主题）
├── public/                    # 静态资源（index.html 与构建产物）
└── data/                      # 运行时数据（SQLite + 封面缓存，不入库）
```

## 🗄 数据存储

- **数据库**：SQLite（`better-sqlite3`），默认 `data/papyrus.db`
  - WAL 模式 + 外键级联（删除书籍自动清理书评 / 借阅 / 标签关联）
- **封面**：抓取豆瓣封面后下载到 `data/covers/`，通过 `/covers/*` 静态服务访问（带豆瓣 Referer 绕过防盗链）

## 📖 API 一览

所有接口均为 JSON，错误统一返回 `{ "error": "..." }`。

### 书籍

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/books` | 列表，支持 `keyword` `categoryId` `tagId` `status(in\|out)` `limit` `offset` |
| GET | `/api/books/:id` | 详情（含分类、标签、书评、当前借阅） |
| POST | `/api/books` | 手动新建，body 为 `BookInput`（`title` 必填） |
| PUT | `/api/books/:id` | 更新书籍信息 |
| DELETE | `/api/books/:id` | 删除书籍（级联清理关联数据） |
| POST | `/api/books/:id/tags` | 设置标签，body `{ tags: string[] }` |
| POST | `/api/books/:id/category` | 设置分类，body `{ categoryId: number \| null }` |
| POST | `/api/books/:id/borrow` | 借出，body `{ borrower, note? }` |
| POST | `/api/books/:id/return` | 归还 |
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
| GET | `/api/lendings?status=borrowed\|returned` | 借阅记录 |
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

- **主题配色**：`src/frontend/style.css` 顶部的 CSS 变量 `--bg / --ink / --accent / --serif` 等，改一处全局生效
- **默认分类**：`src/server/db/schema.ts` 的 `DEFAULT_CATEGORIES`
- **搜索联想接口**：若豆瓣变更接口，只需改 `src/server/services/douban.ts` 的 `searchDouban`
- **端口**：环境变量 `PORT`

## 🧪 开发命令

```bash
npm run typecheck   # 前后端类型检查
npm run dev:client  # 仅前端监听打包（esbuild --watch，改动自动重建 public/app.js）
npm run build:client  # 一次性打包前端 → public/app.js + app.css
npm run build:server  # tsc 编译后端 → dist/
npm run build       # 二者全做
```

## 📄 License

MIT
