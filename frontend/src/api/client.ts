import type {
  RunPipelineParams,
  RunPipelineResponse,
  LLMParamRequest,
  LLMParamResponse,
  LLMAgentRequest,
  LLMAgentResponse,
  SSEEvent,
} from '../types';

const BASE = '/api';

async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error (${res.status}): ${err}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  runPipeline: (params: RunPipelineParams) =>
    request<RunPipelineResponse>('/run_pipeline', params),

  /** 非流式：LLM 参数提取 */
  llmExtract: (data: LLMParamRequest) =>
    request<LLMParamResponse>('/llm_param', data),

  /** 非流式：LLM Agent 全流程执行 */
  llmAgent: (data: LLMAgentRequest) =>
    request<LLMAgentResponse>('/llm_agent', data),

  // ── 项目持久化 ──────────────────────────────────────────────

  /** 保存当前项目全部数据 */
  projectSave: (data: Record<string, unknown>) =>
    request<{ status: string; file: string }>('/project/save', data),

  /** 列出所有已保存项目 */
  projectList: () =>
    request<{ projects: { file: string; project_name: string; saved_at: string; mtime: number; size: number; description: string }[] }>('/project/list'),

  /** 加载指定项目 */
  projectLoad: (file: string) =>
    request<{ status: string; data: Record<string, unknown> }>('/project/load', { file }),

  /** 获取可用截面库和材料库（供表单下拉列表动态填充） */
  getSections: () =>
    request<{
      sections: Record<string, Record<string, number>>;
      materials: Record<string, Record<string, unknown>>;
      column_sections: string[];
      beam_sections: string[];
      material_grades: string[];
    }>('/sections'),

  /** 获取应力比颜色映射定义（表格和 3D 渲染共用） */
  getColormap: () =>
    request<{
      stops: { ratio: number; r: number; g: number; b: number; hex: string; label: string }[];
      thresholds: { max_ratio: number; dot: string; bg: string; label: string }[];
    }>('/colormap'),

  /**
   * 流式：LLM 对话（SSE）。
   * 通过 POST /api/llm/stream 获取 SSE 事件流。
   * 返回一个异步生成器，逐个产生 SSEEvent。
   */
  async *llmStream(data: {
    messages: { role: string; content: string }[];
    tools?: unknown[];
    llm_config?: Record<string, string>;
  }): AsyncGenerator<SSEEvent> {
    const res = await fetch(`${BASE}/llm/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`SSE stream error (${res.status})`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body for SSE stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        try {
          const event: SSEEvent = JSON.parse(trimmed.slice(6));
          yield event;
          if (event.type === 'done' || event.type === 'error') return;
        } catch {
          // skip malformed events
        }
      }
    }
  },
};
