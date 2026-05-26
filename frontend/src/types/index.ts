// ── 3D Data Types ──────────────────────────────────────────────

export interface ThreeDNode {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface ThreeDElement {
  id: number;
  node_i: number;
  node_j: number;
  type: 'column' | 'beam';
  section: string;
}

export interface ColorMapEntry {
  color: string;
  stress_ratio: number;
  stability_ratio: number;
  pass: boolean;
}

export interface LoadArrow {
  position: [number, number, number];
  direction: [number, number, number];
  magnitude: number;
  type: 'dead' | 'live' | 'wind' | 'seismic';
}

export interface Support {
  node_id: number;
  dof: [boolean, boolean, boolean, boolean, boolean, boolean];
}

export interface ThreeDData {
  metadata?: Record<string, unknown>;
  nodes: ThreeDNode[];
  elements: ThreeDElement[];
  sections?: Record<string, unknown>[];
  color_map?: Record<string, ColorMapEntry>;
  deformed_nodes: ThreeDNode[] | null;
  deformation_scale: number;
  load_case?: string;
  max_displacement?: number;
  bounding_box: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
  };
  section_dimensions?: Record<string, { height: number; width: number }>;
  load_arrows?: LoadArrow[];
  supports?: Support[];
}

// ── Pipeline Types ─────────────────────────────────────────────

export type StepType =
  | 'opening'
  | 'input'
  | 'modeling'
  | 'loads'
  | 'analysis'
  | 'check'
  | 'report'
  | 'explore';

export type InputMode = 'engineering' | 'llm';

export interface PipelineNode {
  id: string;
  label: string;
  icon: string;
  step: StepType;
}

// ── API Types ──────────────────────────────────────────────────

export interface RunPipelineParams {
  grid_x: number[];
  grid_y: number[];
  num_stories: number;
  story_heights: number[];
  column_section?: string;
  beam_section?: string;
  material?: string;
  name?: string;
  dead_load?: number;
  live_load?: number;
  wind_pressure?: number;
  seismic_intensity?: number;
}

export interface LLMConfig {
  /** API Key — 可选，服务端 LLM_API_KEY 环境变量优先级更高 */
  api_key?: string;
  model?: string;
  base_url?: string;
}

export interface LLMParamRequest {
  prompt: string;
  /** LLM 配置覆盖 — 可选，CAIAO 化后端优先使用环境变量 */
  llm_config?: LLMConfig;
}

export interface LLMAgentRequest {
  prompt: string;
  llm_config?: LLMConfig;
  max_iterations?: number;
}

export interface RunPipelineResponse {
  status: string;
  model: Record<string, unknown>;
  analysis_result?: Record<string, unknown>;
  code_check?: Record<string, unknown>;
  three_d_data?: ThreeDData;
  report_url?: string;
}

export interface LLMAgentStep {
  tool: string;
  input: string;
  output: string;
}

export interface LLMAgentResponse {
  status: string;
  steps: LLMAgentStep[];
  final_response: string;
  three_d_data?: ThreeDData;
  report_url?: string;
}

export interface LLMParamResponse {
  status: string;
  params: RunPipelineParams;
  raw_llm_output: string;
}

export interface CodeCheckElement {
  id: number;
  type: 'column' | 'beam';
  section: string;
  story: number;
  node_i: number;
  node_j: number;
  stress_ratio: number;
  stability_ratio: number;
  deflection_ratio: number;
  slenderness_ratio: number;
  pass: boolean;
  messages?: string[];
}

/** SSE 流式事件类型 */
export type SSEEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_call'; name: string; arguments: string }
  | { type: 'done' }
  | { type: 'error'; content: string };
