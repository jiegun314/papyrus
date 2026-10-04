/**
 * server/config.ts
 * ------------------------------------------------------------------
 * 运行时配置常量。单独成文件，便于入口（index.ts）与服务器信息接口
 * （services/serverInfo.ts）共用同一份端口配置，避免两处各写一遍默认值。
 */

/** HTTP 服务端口，可用环境变量 PORT 覆盖（默认 3000） */
export const PORT = Number(process.env.PORT) || 3000;
