import { create } from 'zustand';

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

export interface LlmApiConfig {
  provider: 'deepseek' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface PipelineStepInfo {
  step: string;
  nodes?: number;
  elements?: number;
  load_cases?: string[];
  max_disp?: number;
  passed?: number;
  failed?: number;
  path?: string;
}

interface AppState {
  // Step control
  currentStep: StepType;
  setStep: (step: StepType) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Input mode
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;

  // Engineering params
  engineeringParams: Record<string, unknown>;
  setEngineeringParams: (params: Record<string, unknown>) => void;

  // LLM
  llmConfig: LlmApiConfig;
  setLlmConfig: (config: LlmApiConfig) => void;
  llmPrompt: string;
  setLlmPrompt: (prompt: string) => void;
  llmResponse: string;
  setLlmResponse: (response: string) => void;

  // Pipeline
  pipelineSteps: PipelineStepInfo[];
  setPipelineSteps: (steps: PipelineStepInfo[]) => void;
  pipelineActiveIndex: number;
  setPipelineActiveIndex: (index: number) => void;
  pipelineProgress: number;
  setPipelineProgress: (progress: number) => void;

  // 3D Data
  threeDData: unknown | null;
  setThreeDData: (data: unknown | null) => void;
  deformationScale: number;
  setDeformationScale: (scale: number) => void;
  showDeformed: boolean;
  setShowDeformed: (show: boolean) => void;
  showColorMap: boolean;
  setShowColorMap: (show: boolean) => void;
  showLoads: boolean;
  setShowLoads: (show: boolean) => void;

  // Results
  codeCheckResults: unknown | null;
  setCodeCheckResults: (results: unknown | null) => void;
  analysisResults: unknown | null;
  setAnalysisResults: (results: unknown | null) => void;
  reportUrl: string;
  setReportUrl: (url: string) => void;

  // Loading / Error
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Model animation
  modelBuildProgress: number;
  setModelBuildProgress: (progress: number) => void;

  // Scene settings
  displayMode: 'shaded' | 'wireframe' | 'xray';
  setDisplayMode: (mode: 'shaded' | 'wireframe' | 'xray') => void;
  sectionPlane: number;
  setSectionPlane: (v: number) => void;
  explodeFactor: number;
  setExplodeFactor: (v: number) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  showShadows: boolean;
  setShowShadows: (v: boolean) => void;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  isOrthographic: boolean;
  setIsOrthographic: (v: boolean) => void;
  selectedElement: number | null;
  setSelectedElement: (id: number | null) => void;
  // Auto-demo mode
  autoDemo: boolean;
  setAutoDemo: (v: boolean) => void;

  // Dock panel system
  dockPanels: { left: string[]; right: string[] };
  panelHeights: Record<string, number>;
  collapsedDocked: Record<string, boolean>;
  dockPanel: (id: string, side: 'left' | 'right') => void;
  undockPanel: (id: string) => void;
  setPanelHeight: (id: string, height: number) => void;
  setCollapsedDocked: (id: string, collapsed: boolean) => void;
}

const STEPS: StepType[] = [
  'opening', 'input', 'modeling', 'loads', 'analysis', 'check', 'report', 'explore',
];

function loadLlmConfig(): LlmApiConfig {
  try {
    const raw = localStorage.getItem('caiao_llm_config');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { provider: 'deepseek', apiKey: '', baseUrl: '', model: '' };
}

export const useStore = create<AppState>((set, get) => ({
  currentStep: 'opening',
  setStep: (step) => {
    const updates: Partial<AppState> = { currentStep: step };
    if (step === 'modeling') {
      updates.sectionPlane = 0;
      updates.explodeFactor = 0;
    }
    set(updates);
  },
  nextStep: () => {
    const { currentStep } = get();
    const idx = STEPS.indexOf(currentStep);
    if (idx >= STEPS.length - 1) return;
    const next = STEPS[idx + 1];

    // 从 input → modeling 时初始化流水线
    if (currentStep === 'input' && next === 'modeling') {
      const { engineeringParams, pipelineSteps } = get();
      // 未填表单时使用默认参数（快速演示）
      if (Object.keys(engineeringParams).length === 0) {
        const defaults: Record<string, unknown> = {
          grid_x: [6, 6, 6], grid_y: [6, 6, 6], num_stories: 4,
          story_heights: [4.5, 3.6, 3.6, 3.6],
          column_section: 'HW400x400x13x21', beam_section: 'HM390x300x10x16',
          material: 'Q355', name: '办公楼', dead_load: 2.0, live_load: 3.0,
          wind_pressure: 0.45, seismic_intensity: 0.08,
        };
        set({ engineeringParams: defaults });
      }
      // 初始化流水线步骤（表单或 LLM 可能已设置）
      if (pipelineSteps.length === 0) {
        const stepNames = ['模型生成', '荷载施加', '有限元分析', '规范校核', '报告生成'];
        set({ pipelineSteps: stepNames.map(s => ({ step: s })), pipelineActiveIndex: 0 });
      }
    }

    // 进入建模步骤时重置场景状态，避免残留
    if (next === 'modeling' || next === 'loads') {
      set({ sectionPlane: 0, explodeFactor: 0 });
    }

    set({ currentStep: next });
  },
  prevStep: () => {
    const { currentStep } = get();
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) set({ currentStep: STEPS[idx - 1] });
  },

  inputMode: 'engineering',
  setInputMode: (mode) => set({ inputMode: mode }),

  engineeringParams: {},
  setEngineeringParams: (params) => set({ engineeringParams: params }),

  llmConfig: loadLlmConfig(),
  setLlmConfig: (config) => {
    localStorage.setItem('caiao_llm_config', JSON.stringify(config));
    set({ llmConfig: config });
  },
  llmPrompt: '',
  setLlmPrompt: (prompt) => set({ llmPrompt: prompt }),
  llmResponse: '',
  setLlmResponse: (response) => set({ llmResponse: response }),

  pipelineSteps: [],
  setPipelineSteps: (steps) => set({ pipelineSteps: steps }),
  pipelineActiveIndex: -1,
  setPipelineActiveIndex: (index) => set({ pipelineActiveIndex: index }),
  pipelineProgress: 0,
  setPipelineProgress: (progress) => set({ pipelineProgress: progress }),

  threeDData: null,
  setThreeDData: (data) => set({ threeDData: data }),
  deformationScale: 1,
  setDeformationScale: (scale) => set({ deformationScale: scale }),
  showDeformed: false,
  setShowDeformed: (show) => set({ showDeformed: show }),
  showColorMap: true,
  setShowColorMap: (show) => set({ showColorMap: show }),
  showLoads: false,
  setShowLoads: (show) => set({ showLoads: show }),

  codeCheckResults: null,
  setCodeCheckResults: (results) => set({ codeCheckResults: results }),
  analysisResults: null,
  setAnalysisResults: (results) => set({ analysisResults: results }),
  reportUrl: '',
  setReportUrl: (url) => set({ reportUrl: url }),

  isRunning: false,
  setIsRunning: (running) => set({ isRunning: running }),
  error: null,
  setError: (error) => set({ error: error }),

  modelBuildProgress: 0,
  setModelBuildProgress: (progress: number) => set({ modelBuildProgress: progress }),

  // Scene settings
  displayMode: 'shaded',
  setDisplayMode: (mode) => set({ displayMode: mode }),
  sectionPlane: 0,
  setSectionPlane: (v) => set({ sectionPlane: v }),
  explodeFactor: 0,
  setExplodeFactor: (v) => set({ explodeFactor: v }),
  showGrid: true,
  setShowGrid: (v) => set({ showGrid: v }),
  showShadows: true,
  setShowShadows: (v) => set({ showShadows: v }),
  autoRotate: false,
  setAutoRotate: (v) => set({ autoRotate: v }),
  isOrthographic: false,
  setIsOrthographic: (v) => set({ isOrthographic: v }),
  selectedElement: null,
  setSelectedElement: (id) => set({ selectedElement: id }),
  autoDemo: false,
  setAutoDemo: (v) => set({ autoDemo: v }),

  // Dock panel system
  dockPanels: { left: [], right: [] },
  panelHeights: {},
  collapsedDocked: {},
  dockPanel: (id, side) => set(state => {
    const left = state.dockPanels.left.filter(x => x !== id);
    const right = state.dockPanels.right.filter(x => x !== id);
    if (side === 'left') left.push(id);
    else right.push(id);
    return { dockPanels: { left, right } };
  }),
  undockPanel: (id) => set(state => ({
    dockPanels: {
      left: state.dockPanels.left.filter(x => x !== id),
      right: state.dockPanels.right.filter(x => x !== id),
    },
  })),
  setPanelHeight: (id, height) => set(state => ({
    panelHeights: { ...state.panelHeights, [id]: height },
  })),
  setCollapsedDocked: (id, collapsed) => set(state => ({
    collapsedDocked: { ...state.collapsedDocked, [id]: collapsed },
  })),
}));
