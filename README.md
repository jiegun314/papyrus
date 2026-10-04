# 📚 Papyrus · 个人书籍管理系统

> React 19 + TypeScript 的个人书架管理工具：**豆瓣 / Amazon / Open Library 三数据源元数据导入 + SQLite 本地存储 + 实体书 / 电子书载体类型 + 个人书评与阅读状态管理**，配一个暖色纸张质感的小清新 Web 界面。前端按功能模块化组织（图标统一用 **Lucide**），后端为 Express + better-sqlite3，前后端共享 `src/shared/types.ts` 类型。

## ✨ 功能一览

- **数据导入（三数据源）**
  - **豆瓣**：按 ISBN 精确导入（支持 10/13 位，自动 302 跳转解析）、按书名 / 作者关键字搜索联想一键入库
  - **Amazon**：中文 / 英文书皆可，按 ASIN / ISBN 或搜索结果导入，无需登录凭证
  - **Open Library**：公开书目云（openlibrary.org），按书名 / 作者关键字搜索或 ISBN 精确导入，自动聚合作品与英文版次信息
  - 自动抓取：封面（本地缓存）、内容简介、作者简介、目录、出版社、出版年、页数、装帧、定价、评分与评价数
  - 同一本书自动去重（按豆瓣 subject id / Amazon ASIN / Open Library work key）
- **书架管理**
  - 关键字搜索（书名 / 作者 / ISBN / 出版社）、分类 / 阅读状态 / 载体类型筛选
  - 排序：按 书籍名称 / 作者名称 / 豆瓣评分 / 出版时间 排列，可切换由高到低与由低到高；无评分 / 无出版日期的书籍固定排在末尾
  - 手动录入 / 编辑书籍全部字段；封面与电子书支持本地上传
- **书籍载体类型**：每本书标记 **实体书 / 电子书**，书架、清单、详情、统计全程区分
- **电子书文件**：上传 PDF / EPUB / MOBI / AZW3 / TXT 等到本地，详情页在线预览、一键下载（自动命名的「书名(作者).扩展名」）
- **阅读状态**：每本书可标记 **未读 / 阅读中 / 已读 / 放弃**，封面角标 + 书架筛选 + 统计一目了然
- **个人书评**：星级评分 + 文字书评，随时增删
- **标签系统**：给书打多个标签，支持批量在弹窗中勾选 / 新建
- **分类系统**：自定义分类 + 颜色标识，重命名、删除
- **统计概览**：左侧统计卡按「藏书 / 载体 / 阅读状态」分组展示，总数、实体书 / 电子书、状态分布、标签、分类、书评数一目了然
- **一键精简视图**：筛选栏最左侧的「◧ 收起统计」按钮可一键隐藏左侧统计列，把空间全让给书籍列表 —— 宽屏隐藏全部四组（藏书 / 载体 / 阅读状态 / 服务器，书墙由 5 列增至 6 列），窄屏隐藏上方三组统计（服务器面板保留在书墙之后）；状态记在 `localStorage`，刷新后保持
- **服务器状态**：左侧「阅读状态」下方常驻服务器面板 —— **当前局域网 IP 与访问地址（点击复制）、在线 / 今日 / 累计访问数、基本服务配置（端口 / 协议 / 运行时长 / Node / 系统）、功能模块与组件版本**；启动时终端也会打印可直连的局域网地址，方便手机等远端设备访问

## 🚀 快速开始

```bash
# 1. 安装依赖（Node.js ≥ 24，建议 24 LTS / 26）
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

> 📱 若要在**安卓真机上启用「扫码识别 ISBN」**（调起摄像头），需要让开发服务器以 **HTTPS** 提供页面 —— 具体见下文「HTTPS 与摄像头扫码（开发 & 正式）」。

## 🏷️ v0.2.5 发布说明

> 本版聚焦**远端访问的便利性**与**界面一致性**：新增服务器状态面板与「一键精简视图」，筛选栏在手机上重排为规整网格，全站图标统一为 Lucide，顶部导航新增随路由滑动的高亮块。

### 本版更新

- **服务器状态面板（新增）**：左侧统计列新增「服务器」分组，展示**当前局域网 IP 与访问地址（点击即复制）、在线 / 今日 / 累计访问数、基本服务配置（端口 / 协议 / 已运行时长 / Node / 系统）**，以及功能模块与运行环境版本明细；启动日志同时打印 `本机访问` 与 `局域网` 地址，手机等远端设备可直接访问。
- **访问统计接口（新增）**：`GET /api/server-info` 返回 IP、端口、运行环境、模块版本与访问统计；`POST /api/server-info/heartbeat` 接收浏览器心跳。无账号体系，故以「浏览器会话」为口径统计在线数，今日 / 累计计数落盘 `data/server-stats.json`。
- **一键精简视图（新增）**：筛选栏最左侧「收起统计」按钮可一键隐藏左侧统计列 —— 宽屏收起全部四组（书墙由 5 列增至 6 列），窄屏收起上方三组统计（服务器信息仍保留在书墙之后）；偏好记忆在 `localStorage`。
- **图标统一为 Lucide**：新增依赖 `lucide-react`，替换全站 emoji / 文字符号图标（搜索、关闭、星标、分页箭头、空状态、按钮内图标等），并统一「图标与文字等高居中」规则。
- **顶部导航**：书架 / 标签 / 分类三个入口改为**真正居中**（左右两栏等宽），按钮由胶囊改为**小圆角方形**，新增随路由**平滑滑动**的蓝色高亮块，并为每个入口配上语义图标（书架 `Library` / 标签 `Tags` / 分类 `FolderTree`，与页标题一致）。
- **添加书籍按钮**：改为圆形加号图标按钮，鼠标悬停浮出「添加书籍」气泡。
- **手机端布局**：筛选栏由「自由换行」改为**规整两列网格**（搜索独占一行 / 两个筛选并排 / 排序独占一行），不再出现参差与溢出；左侧统计卡高度收窄（单卡 76px → 54px，统计区少占约 88px）；窄屏下服务器状态自动移到所有模块最下方。
- **左侧统计列宽度**：改为「内容 176px + 滚动条槽位 11px」并用 `scrollbar-gutter: stable` 常驻槽位 —— 展开「模块版本 · 详情」出现滚动条时，内容宽度不再变化。

> 历史版本（v0.1.0 / v0.2.0）见 GitHub Releases。

### 获取发布包

| 产物 | 说明 |
|---|---|
| 源码归档 *Source code*（tar.gz / zip） | GitHub 在 `v0.2.5` 标签自动生成，**不含 `dist/`，需自行构建** |
| 预构建包 `papyrus-v0.2.5.tar.gz` | 源码 + `dist/`（含 `npm run build` 产物），**仍需 `npm install` 安装依赖**，可跳过构建 |

> ⚠️ 依赖中的 `better-sqlite3` 是**原生模块**，因此发布包**不包含 `node_modules`**，请在目标机器上重新 `npm install`；13.x 起该包自带全平台预编译产物（Node-API），安装时无需本地编译工具链。

### 安装与运行（生产）

```bash
# 1. 解压（任选其一）
tar -xzf papyrus-v0.2.5.tar.gz && cd papyrus-v0.2.5
# 或：下载 GitHub 的「Source code (tar.gz)」自动归档后解压

# 2. 安装依赖（Node.js ≥ 24，建议 24 LTS / 26）
npm install --cache ./.npm-cache

# 3. 构建（源码归档必备 / 预构建包已含 dist/ 可跳过）
npm run build

# 4. 启动（单进程 Express 同时托管 API 与前端页面）
npm start                 # 或预构建包直接： node dist/server/index.js
# 打开 http://localhost:3000
```

### 首次运行与数据迁移

- 首次启动自动创建 `data/papyrus.db`（SQLite）并写入默认分类；封面缓存在 `data/covers/`、电子书在 `data/ebooks/`。
- 升级 / 迁移时**整体拷贝 `data/` 目录**即可（数据库文件为 `data/papyrus.db`）。
- 生产请确认 `PORT`（默认 3000）未被占用；健康检查 `GET /api/health` 返回 `{ "ok": true }`。

### 摄像头扫码（需要 HTTPS）

在**安卓真机 / 非 localhost 环境**使用「扫码识别 ISBN」需 HTTPS（`getUserMedia` 安全上下文约束）：

```bash
npm run certs     # 生成本地自签名 HTTPS 证书到 certs/
```

然后通过 HTTPS 访问服务（详见上文「HTTPS 与摄像头扫码（开发 & 正式）」）；`http://localhost:3000` 属本机安全上下文，可直接扫码。

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
| Node.js | `>= 24`（建议 24 LTS / 26，ESM 项目） |
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

### 🔒 HTTPS 与摄像头扫码（开发 & 正式）

> 浏览器规定：**只有 HTTPS（或 localhost）才能调用摄像头**（`getUserMedia`）。所以「扫码识别 ISBN 条形码」功能必须跑在 HTTPS 下。
>
> 开发环境默认是 `http://localhost:5173`（本机 localhost 属于安全上下文，Mac 上能正常扫码）；但**安卓真机**访问开发机时用的是 `http://<局域网IP>`，**不是安全上下文**，浏览器会直接禁用摄像头 —— 因此需要给开发服务器加 HTTPS。

#### 🧪 调试 / 开发环境

1. 生成一张本地自签名证书（含 `localhost`、`127.0.0.1` 和当前局域网 IP 的 SAN）：

   ```bash
   npm run certs          # 首次生成一次；换 Wi-Fi / IP 变化后重新生成：npm run certs -- --force
   ```

   产物：`certs/{key,cert}.pem`（已被 `.gitignore` 忽略，不会入库）。

2. 启动开发服务器（Vite 检测到证书后自动切到 **HTTPS** 并监听局域网网卡）：

   ```bash
   npm run dev
   ```

   终端会显示：

   ```
   ➜  Local:   https://localhost:5173/
   ➜  Network: https://192.168.71.223:5173/  en0
   ```

3. **安卓真机**：与电脑连同一 Wi-Fi，浏览器打开 `https://<局域网IP>:5173`（例如 `https://192.168.71.223:5173`）。这是自签名证书，手机先点「高级 → 继续前往 …（不安全）」进入即可，随后可正常授权摄像头扫码。

> 💡 若安卓 Chrome 对自签名证书**仍拒绝授权摄像头**，两条更稳的路：
>
> - **mkcert**（推荐）：生成由本地 CA 签发的证书（会自动签发一张 CA），并把 CA 证书导入手机「设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书」。此后不再出现警告，必定可用摄像头。
> - **adb reverse（零证书）**：手机开 USB 调试连电脑，执行 `adb reverse tcp:5173 tcp:5173`，手机访问 `http://localhost:5173` —— 手机上的 localhost 始终是安全上下文，无需 HTTPS。
>
> 只启动前端调试并用证书：`npm run dev:client` 同样会自动读取证书并切到 HTTPS。

#### 🚀 正式 / 生产环境

生产是**单进程 Express 同时托管 API 与前端**（`dist/client`），默认监听 **HTTP** `http://localhost:3000`。要启用 HTTPS，推荐把 **TLS 终止放到 Express 前面**（由域名 / 平台签发正式证书），浏览器即视为安全上下文：

- **云平台托管**（Render / Vercel / Railway / 各类轻量服务器托管等）：在平台侧打开 HTTPS 即可，无需自签证书。
- **Nginx / Traefik / Caddy 反向代理**：由代理提供 `https://你的域名` 的证书，把流量转发到本机 `http://localhost:3000`。以 Nginx 为例：

  ```nginx
  server {
    listen 443 ssl;
    server_name your.domain.com;

    ssl_certificate     /etc/letsencrypt/live/your.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;

    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ```

  之后访问 `https://your.domain.com`，安卓 / 手机等设备即可正常使用「扫码识别 ISBN」。

### 🗄 数据持久化与备份

运行时数据全部位于项目根 `data/`（已被 `.gitignore` 排除）：

```text
data/
├── papyrus.db       # SQLite 主库（WAL 模式）
├── papyrus.db-wal   # WAL 日志（-journal / -shm 同理）
├── server-stats.json # 服务器状态面板的累计 / 每日访问计数
├── covers/          # 豆瓣 / Amazon / Open Library 封面本地缓存
└── ebooks/          # 上传的电子书文件
```

**备份**：关闭服务后整体拷贝 `data/`，或仅 `papyrus.db` + `covers/` + `ebooks/`；恢复时放回原路径即可。`server-stats.json` 只存访问计数，删掉即重新从 0 开始统计。

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
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --cache ./.npm-cache
COPY . .
RUN npm run build

FROM node:24-alpine
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

### 🖥 服务器状态与局域网访问

服务启动后，终端会直接列出可用的访问地址，左侧书架页的服务器面板也会同步展示（两者取同一份数据）：

```text
    本机访问 : http://localhost:3000
    局域网   : http://192.168.1.10:3000
```

面板内容：

| 区块 | 说明 |
|---|---|
| 当前 IP | 本机所有局域网 IPv4（内网网段优先），点击即复制 |
| 访问地址 | 当前浏览器所在地址（含协议与端口），点击即复制；局域网 http 下已做 `execCommand` 兜底 |
| 访问统计 | **在线**（最近 120 秒内有心跳的浏览器会话）/ **今日** / **累计** |
| 基本服务配置 | 端口、协议、已运行时长、Node 版本、操作系统 |
| 模块版本 · 详情 | 主机名、数据目录、数据库文件、应用版本，以及功能模块清单与运行环境 / 组件版本 |

**排布规则**：宽屏（> 920px）为「左侧统计列 + 右侧书籍区」双栏布局，面板固定在**左侧「阅读状态」分组下方**并随列吸顶；窄屏（≤ 920px）双栏塌陷为纵向堆叠，面板自动移到**所有模块的最下方**（书籍网格与分页之后），用一条分隔线与上方内容区隔。两处渲染的是同一个组件，同一时刻只挂载一个实例。

左侧统计列的宽度拆成两段算：**内容 176px + 滚动条槽位 11px = 总宽 187px**，并用 `scrollbar-gutter: stable` 常驻槽位。这样展开「模块版本 · 详情」导致列内出现滚动条时，内容宽度仍是 176px，卡片与文字不会整体重排（槽位宽按 thin 滚动条的常见值取 11px；若平台滚动条更宽，内容会等比窄几像素，但「出现滚动条时宽度不变」在所有平台都成立）。窄屏下列为 `width: auto` + `overflow: visible`，不预留槽位。

**一键收起**：筛选栏最左侧的「◧ 收起统计」按钮把状态写入 `localStorage.papyrus.sideHidden`，并给 `.shelf-layout` 加上 `is-side-hidden`，一键隐藏整列。宽屏下隐藏全部四组（书墙由 5 列变 6 列）；窄屏下 `.shelf-side` 里只有上方三组统计，服务器面板作为 `.shelf-server-bottom` 独立渲染，因此不受影响、仍留在书墙之后。隐藏只影响显示，服务器面板的心跳统计照常运行。

> 说明：Papyrus 是局域网个人应用，**没有账号登录体系**。因此「访问数」以**浏览器会话**为口径：每个标签页生成一个 sessionId（存 `sessionStorage`），页面挂载时上报一次、之后每 30 秒心跳一次。同一标签页刷新不重复计数，关闭标签页后重新打开算一次新访问。在线数只存在于内存（进程重启后重新计算），今日 / 累计数落盘 `data/server-stats.json`，重启不丢失。

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
│   │   ├── index.ts                 # 服务入口（优雅退出、端口监听、局域网地址打印）
│   │   ├── app.ts                   # Express 组装 + dist/client 生产托管 + /covers /ebooks 静态
│   │   ├── config.ts                # 运行时配置（PORT）
│   │   ├── db/                      # schema.ts（建表 + 默认分类）+ 连接单例 + 目录常量
│   │   ├── services/                # douban / amazon / openLibrary / cover / ebook / bookService / serverInfo / serverSessions
│   │   └── routes/                  # books / douban / amazon / openLibrary / meta / serverInfo
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
│       ├── assets/fonts/            # 品牌标题字体 Cinzel Decorative（woff2 + OFL 授权）
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
| GET | `/api/server-info` | 服务器状态（局域网 IP / 端口 / 运行环境 / 模块版本 / 访问统计） |
| POST | `/api/server-info/heartbeat` | 访问心跳 `{ sessionId }`，返回在线 / 今日 / 累计访问数 |

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
- **左上角品牌标题**：纯文字 `Papyrus`，字体为自托管的 [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative)（古典罗马体，大写带装饰花饰；SIL OFL 1.1，授权文本见 `src/client/assets/fonts/OFL.txt`）。woff2 放在 `src/client/assets/fonts/`，由 `style.css` 顶部的 `@font-face` 引入，**不依赖外部 CDN**，局域网 / 离线同样可用；想换字体只需替换该文件与 `@font-face` 的 `src`，再改 `.brand-title` 的 `font-family`。注意 Cinzel 的小写会渲染成小型大写字母，故标题写作 `Papyrus` 更美观
- **图标**：全部使用 [`lucide-react`](https://lucide.dev) 组件（搜索、关闭、星标、分页箭头、空状态、按钮内图标等），不再使用 emoji / 文字符号。导航与对应页标题成对使用同一图标（书架 `Library` / 标签 `Tags` / 分类 `FolderTree`），图标统一 15px、文字 14.5px 且 `line-height: 1`，保证两者等高并垂直居中。`style.css` 里 `svg.lucide` 统一了 `flex: none` + 垂直居中，容器普遍用 `inline-flex + align-items:center + gap`；需要旋转动画（加载中 / 刷新中）加 `.spin` 类；页面标题带图标用 `.view-title-icon`，按钮带图标用 `.btn-with-icon`
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
npm run certs         # 生成本地 HTTPS 自签名证书（certs/，供安卓真机扫码调试）
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
