/**
 * api/http.ts —— 统一请求封装与错误类型。
 * 所有后端接口调用都经由 request()，失败时抛出 ApiError。
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiErrorBody {
  error?: string;
  details?: unknown;
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const data = (await res.json()) as ApiErrorBody;
      if (data?.error) msg = data.error;
    } catch {
      /* 忽略非 JSON 错误响应 */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

/** 获取错误的可读信息 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
