import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import {
  Send, Settings, MessageSquare, ChevronDown, ChevronUp, Sparkles, Bot, Cpu, Key,
  Grid3X3, Layers, Building2, Ruler, Weight, Wind, Gauge,
  CheckCircle2, AlertCircle, Info, BookTemplate, ArrowRight,
  Loader2, Zap, FolderOpen, Download,
} from 'lucide-react';
import ApiSettingsModal from './ApiSettingsModal';
import { api } from '../api/client';
import type { RunPipelineParams } from '../types';
import { parseDesignParams } from '../utils/parseDesignParams';

// ── Shared: generate mock results from engineering params ────────

function generateMockResults(store: ReturnType<typeof useStore.getState>, params: RunPipelineParams) {
  const nx = params.grid_x.length;
  const ny = params.grid_y.length;
  const nz = params.num_stories;
  const nCol = (nx + 1) * (ny + 1);
  const totalNodes = nCol * (nz + 1);
  const totalCols = nCol * nz;
  const totalBeams = nz * ((ny + 1) * nx + (nx + 1) * ny);
  const totalElements = totalCols + totalBeams;
  // ~10% elements fail with stress ratios around 0.85-1.1
  const failed = Math.max(1, Math.round(totalElements * 0.1));
  const passed = totalElements - failed;

  const mockElements: Array<Record<string, unknown>> = [];
  let eid = 0;
  // Columns — story k+1 (1-based), bottom at z_levels[k-1] (or 0 for k=0)
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        eid++;
        const sr = 0.4 + Math.random() * 0.5;
        mockElements.push({
          id: eid, type: '柱', story: k + 1,
          stress_ratio: +(sr).toFixed(3),
          stability_ratio: +(sr * 0.9).toFixed(3),
          deflection_ratio: +(Math.random() * 0.15).toFixed(3),
          pass: sr <= 1.0,
        });
      }
    }
  }
  // Beams — at each floor level k (1..nz), beam serves story k+1
  for (let k = 1; k <= nz; k++) {
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i < nx; i++) {
        eid++;
        const sr = 0.5 + Math.random() * 0.55;
        mockElements.push({
          id: eid, type: 'X向梁', story: k + 1,
          stress_ratio: +(sr).toFixed(3),
          stability_ratio: +(sr * 0.85).toFixed(3),
          deflection_ratio: +(Math.random() * 0.4).toFixed(3),
          pass: sr <= 1.0,
        });
      }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i <= nx; i++) {
        eid++;
        const sr = 0.5 + Math.random() * 0.55;
        mockElements.push({
          id: eid, type: 'Y向梁', story: k + 1,
          stress_ratio: +(sr).toFixed(3),
          stability_ratio: +(sr * 0.85).toFixed(3),
          deflection_ratio: +(Math.random() * 0.4).toFixed(3),
          pass: sr <= 1.0,
        });
      }
  }

  // Force some elements to fail for realism
  const failIndices = new Set<number>();
  while (failIndices.size < failed) failIndices.add(Math.floor(Math.random() * totalElements));
  failIndices.forEach(i => {
    if (mockElements[i]) {
      mockElements[i].stress_ratio = +(1.0 + Math.random() * 0.15).toFixed(3);
      mockElements[i].pass = false;
    }
  });

  store.setCodeCheckResults({
    summary: { total_elements: totalElements, passed, failed,
      max_stress_ratio: 1.12, max_deflection_ratio: 0.45 },
    elements: mockElements,
  });
  store.setAnalysisResults({
    max_displacement: 12.5,
    engine: 'Matrix Method',
    summary: { max_displacement: 12.5 },
  });
  store.setPipelineSteps([
    { step: '模型生成', nodes: totalNodes, elements: totalElements },
    { step: '荷载施加', load_cases: ['恒载', '活载', '风载', '地震'] },
    { step: '有限元分析', max_disp: 12.5 },
    { step: '规范校核', passed, failed },
    { step: '报告生成' },
  ]);
  store.setPipelineActiveIndex(4);
  store.setPipelineProgress(100);
}

// ── Shared: run pipeline in background and populate store ────────

function runPipelineBackground(params: RunPipelineParams) {
  const store = useStore.getState();

  api.runPipeline(params).then(result => {
    store.setIsRunning(false);
    if (result.status === 'success') {
      store.setLastRunParams(params as unknown as Record<string, unknown>);
      store.setThreeDData(result.three_d_data ?? null);
      store.setCodeCheckResults(result.code_check ?? null);
      store.setAnalysisResults(result.analysis_result ?? null);
      store.setReportUrl(result.report_url ?? '');

      store.setPipelineSteps([
        { step: '模型生成', nodes: ((result.model as Record<string, unknown>)?.nodes as Array<unknown>)?.length, elements: ((result.model as Record<string, unknown>)?.elements as Array<unknown>)?.length },
        { step: '荷载施加' },
        { step: '有限元分析', max_disp: ((result.analysis_result as Record<string, unknown>)?.summary as Record<string, unknown>)?.max_displacement },
        { step: '规范校核', passed: ((result.code_check as Record<string, unknown>)?.summary as Record<string, unknown>)?.passed, failed: ((result.code_check as Record<string, unknown>)?.summary as Record<string, unknown>)?.failed },
        { step: '报告生成', path: result.report_url },
      ]);
      store.setPipelineActiveIndex(4);
      store.setPipelineProgress(100);
    } else {
      store.setError(result.message || '流水线运行失败');
    }
  }).catch(err => {
    store.setIsRunning(false);
    store.setError(`流水线失败: ${err.message || err}`);
    console.warn('Backend unreachable:', err);
  });
}

// ── Template Presets ──────────────────────────────────────────────

interface Preset {
  label: string;
  icon: string;
  desc: string;
  params: RunPipelineParams;
}

const PRESETS: Preset[] = [
  {
    label: '标准办公楼', icon: '🏢', desc: '4层 · 6m×6m柱网 · Q355',
    params: {
      grid_x: [6, 6, 6], grid_y: [6, 6, 6], num_stories: 4,
      story_heights: [4.5, 3.6, 3.6, 3.6],
      column_section: 'HW400x400x13x21', beam_section: 'HM390x300x10x16',
      material: 'Q355', name: '办公楼',
      dead_load: 2.0, live_load: 3.0, wind_pressure: 0.45, seismic_intensity: 0.08,
    },
  },
  {
    label: '轻型厂房', icon: '🏭', desc: '2层 · 9m×6m柱网 · Q235',
    params: {
      grid_x: [9, 9, 9], grid_y: [6, 6], num_stories: 2,
      story_heights: [6.0, 4.5],
      column_section: 'HW350x350x12x19', beam_section: 'HM340x250x9x14',
      material: 'Q235', name: '厂房',
      dead_load: 1.5, live_load: 5.0, wind_pressure: 0.55, seismic_intensity: 0.05,
    },
  },
  {
    label: '高层框架', icon: '🏗️', desc: '8层 · 4.5m层高 · Q355',
    params: {
      grid_x: [8, 8], grid_y: [8, 8], num_stories: 8,
      story_heights: [4.5, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2],
      column_section: 'HW400x400x13x21', beam_section: 'HM390x300x10x16',
      material: 'Q355', name: '高层建筑',
      dead_load: 2.5, live_load: 3.5, wind_pressure: 0.65, seismic_intensity: 0.12,
    },
  },
];

// ── InputPanel (container) ──────────────────────────────────────

export default function InputPanel() {
  const { inputMode, setInputMode } = useStore();
  const [expanded, setExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Animated background grid */}
      <div className="animated-grid-bg">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <pattern id="inputGrid" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="rgba(0,212,255,0.15)" />
            </pattern>
            <pattern id="inputGridLarge" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="rgba(50,240,140,0.08)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#inputGrid)" />
          <rect width="100%" height="100%" fill="url(#inputGridLarge)" />
        </svg>
      </div>

      <div
        className={`
          w-[480px] min-w-[480px] h-full flex flex-col relative z-10
          transition-all duration-500 ease-out
          ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}
          ${expanded ? '' : 'w-[64px] min-w-[64px]'}
        `}
      >
        {/* Glass panel base */}
        <div className="absolute inset-0 bg-[#0a0b0d]/80 backdrop-blur-2xl border-r border-white/5" />

        {/* Glow accent line */}
        <div className="glow-accent absolute top-0 left-0 right-0" />

        {/* Header tabs */}
        <div className="relative flex items-center border-b border-white/5">
          <button onClick={() => { setInputMode('engineering'); setExpanded(true); }}
            className={`flex-1 py-4 text-xs font-medium flex items-center justify-center gap-2 transition-all duration-300
              ${inputMode === 'engineering'
                ? 'text-cyan border-b-2 border-cyan bg-gradient-to-b from-cyan/5 to-transparent'
                : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Settings size={15} className={inputMode === 'engineering' ? 'text-cyan' : ''} />
            {expanded && '工程参数'}
            {expanded && inputMode === 'engineering' && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
            )}
          </button>
          <button onClick={() => { setInputMode('llm'); setExpanded(true); }}
            className={`flex-1 py-4 text-xs font-medium flex items-center justify-center gap-2 transition-all duration-300
              ${inputMode === 'llm'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-gradient-to-b from-purple-500/5 to-transparent'
                : 'text-gray-500 hover:text-gray-300'}`}
          >
            <MessageSquare size={15} className={inputMode === 'llm' ? 'text-purple-400' : ''} />
            {expanded && 'LLM 对话'}
            {expanded && inputMode === 'llm' && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3.5 py-4 text-gray-500 hover:text-gray-300 border-l border-white/5 hover:bg-white/5 transition-colors"
            title={expanded ? '折叠' : '展开'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {/* Content area */}
        {expanded && (
          <div className="relative flex-1 min-h-0">
            {inputMode === 'engineering' ? <EngineeringForm /> : <LLMChat />}
          </div>
        )}

        {/* Bottom branding */}
        {expanded && (
          <div className="relative px-5 py-3 border-t border-white/5">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="text-sm font-medium tracking-tight">
                <span className="text-cyan/50">Xuanwu</span><span className="text-gray-500">AI</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-500/50 animate-pulse" />
                就绪
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Engineering Form ────────────────────────────────────────────

function EngineeringForm() {
  const store = useStore();
  const { setEngineeringParams, setError, setPipelineSteps, setPipelineActiveIndex } = store;

  const [form, setForm] = useState({
    grid_x: '6,6,6', grid_y: '6,6,6', num_stories: '4',
    story_heights: '4.5,3.6,3.6,3.6', column_section: 'HW400x400x13x21',
    beam_section: 'HM390x300x10x16', material: 'Q355',
    dead_load: '2.0', live_load: '3.0', wind_pressure: '0.45',
    seismic_intensity: '0.08', name: '办公楼',
  });

  const [activePreset, setActivePreset] = useState<number | null>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ── 导入已有项目 ──────────────────────────────────────────────
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [projectList, setProjectList] = useState<{ file: string; project_name: string; saved_at: string; mtime: number; size: number }[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [importingProject, setImportingProject] = useState(false);
  const importRef = useRef<HTMLDivElement>(null);
  const hasImportedResults = useRef(false);
  const formModifiedAfterImport = useRef(false);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await api.projectList();
      setProjectList(res.projects || []);
    } catch {
      setProjectList([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const importProject = useCallback(async (filename: string) => {
    setImportingProject(true);
    try {
      const res = await api.projectLoad(filename);
      const data = res.data as Record<string, unknown>;
      const input = data?.input || {};
      const geo = input.geometry || {};
      const sec = input.sections || {};
      const loads = input.loads || {};
      const output = data?.output || {};
      const outSummary = output.summary || {};

      setForm({
        grid_x: (geo.grid_x || [6, 6, 6]).join(','),
        grid_y: (geo.grid_y || [6, 6, 6]).join(','),
        num_stories: String(geo.num_stories || 4),
        story_heights: (geo.story_heights || [4.5, 3.6, 3.6, 3.6]).join(','),
        column_section: sec.column || 'HW400x400x13x21',
        beam_section: sec.beam || 'HM390x300x10x16',
        material: sec.material || 'Q355',
        dead_load: String(loads.dead_load ?? 2.0),
        live_load: String(loads.live_load ?? 3.0),
        wind_pressure: String(loads.wind_pressure ?? 0.45),
        seismic_intensity: String(loads.seismic_intensity ?? 0.08),
        name: data?.metadata?.project_name || '',
      });
      setActivePreset(null);
      setValidationErrors({});
      setShowImportDropdown(false);

      // 加载已有输出数据到 store，避免重复计算
      const elements = output.code_check_elements || [];
      if (elements.length > 0 || outSummary.total_elements > 0) {
        const store = useStore.getState();
        store.setCodeCheckResults({
          summary: {
            total_elements: outSummary.total_elements ?? elements.length,
            passed: outSummary.passed_count ?? 0,
            failed: outSummary.failed_count ?? 0,
            max_stress_ratio: outSummary.max_stress_ratio ?? 0,
            max_deflection_ratio: outSummary.max_deflection_ratio ?? 0,
          },
          elements,
        });
        store.setAnalysisResults({
          max_displacement: null,
          engine: '已导入',
          summary: { max_displacement: null },
        });
        store.setPipelineSteps([
          { step: '模型生成', elements: outSummary.total_elements },
          { step: '荷载施加' },
          { step: '有限元分析' },
          { step: '规范校核', passed: outSummary.passed_count, failed: outSummary.failed_count },
          { step: '报告生成' },
        ]);
        store.setPipelineActiveIndex(4);
        store.setPipelineProgress(100);
        hasImportedResults.current = true;
        formModifiedAfterImport.current = false;
      }
    } catch {
      // 加载失败静默处理
    } finally {
      setImportingProject(false);
    }
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (importRef.current && !importRef.current.contains(e.target as Node)) {
        setShowImportDropdown(false);
      }
    };
    if (showImportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showImportDropdown]);

  // ── 后端连接状态检测（积极重连） ────────────────────────────
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkBackend = useCallback(async () => {
    try {
      const res = await api.health();
      if (res.status === 'ok') {
        setBackendStatus(prev => {
          if (prev !== 'connected') {
            useStore.getState().setError(null); // 后端恢复后清除报错
          }
          return 'connected';
        });
        setRetryCount(0);
      }
    } catch {
      setBackendStatus('disconnected');
    }
  }, []);

  // 持续检测后端连接，永不停止
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional backend health check loop */
    checkBackend();
    const interval = setInterval(() => {
      checkBackend();
      setRetryCount(c => c + 1);
    }, 3000);
    /* eslint-enable react-hooks/set-state-in-effect */
    retryTimerRef.current = interval;
    return () => clearInterval(interval);
  }, [checkBackend]);

  // Validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const nx = form.grid_x.split(',').map(Number);
    const ny = form.grid_y.split(',').map(Number);
    if (nx.some(isNaN) || nx.length < 1) errors.grid_x = '请输入有效的柱距';
    if (ny.some(isNaN) || ny.length < 1) errors.grid_y = '请输入有效的柱距';
    const ns = Number(form.num_stories);
    if (isNaN(ns) || ns < 1 || ns > 20) errors.num_stories = '层数应在 1-20 之间';
    const sh = form.story_heights.split(',').map(Number);
    if (sh.some(isNaN) || sh.length !== ns) errors.story_heights = `需要 ${ns} 个层高值`;
    if (sh.some(v => v < 2.5 || v > 8)) errors.story_heights = '层高应在 2.5-8m 之间';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Live summary
  const summary = useMemo(() => {
    const nx = form.grid_x.split(',').length;
    const ny = form.grid_y.split(',').length;
    const ns = Number(form.num_stories) || 0;
    const totalHeight = form.story_heights.split(',').reduce((s, v) => s + (Number(v) || 0), 0);
    return { nx, ny, ns, totalHeight, totalColumns: (nx + 1) * (ny + 1) * ns };
  }, [form.grid_x, form.grid_y, form.num_stories, form.story_heights]);

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    store.setError(null);

    const parseArray = (s: string) => s.split(',').map(Number);
    const params: RunPipelineParams = {
      grid_x: parseArray(form.grid_x), grid_y: parseArray(form.grid_y),
      num_stories: Number(form.num_stories), story_heights: parseArray(form.story_heights),
      column_section: form.column_section, beam_section: form.beam_section,
      material: form.material, name: form.name,
      dead_load: Number(form.dead_load), live_load: Number(form.live_load),
      wind_pressure: Number(form.wind_pressure), seismic_intensity: Number(form.seismic_intensity),
    };
    setEngineeringParams(params as unknown as Record<string, unknown>);
    setError(null);
    setValidationErrors({});

    // 导入的项目有已有结果且表单未修改，直接跳到探索页
    if (hasImportedResults.current && !formModifiedAfterImport.current) {
      hasImportedResults.current = false;
      setIsSubmitting(false);
      useStore.getState().setStep('explore');
      return;
    }

    const stepNames = ['模型生成', '荷载施加', '有限元分析', '规范校核', '报告生成'];
    setPipelineSteps(stepNames.map(s => ({ step: s })));
    setPipelineActiveIndex(0);

    // Small delay for visual feedback
    await new Promise(r => setTimeout(r, 300));
    useStore.getState().setIsRunning(true);
    useStore.getState().setStep('modeling');
    runPipelineBackground(params);
  };

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx].params;
    setForm({
      grid_x: p.grid_x.join(','),
      grid_y: p.grid_y.join(','),
      num_stories: String(p.num_stories),
      story_heights: p.story_heights.join(','),
      column_section: p.column_section || 'HW400x400x13x21',
      beam_section: p.beam_section || 'HM390x300x10x16',
      material: p.material || 'Q355',
      dead_load: String(p.dead_load || 2.0),
      live_load: String(p.live_load || 3.0),
      wind_pressure: String(p.wind_pressure || 0.45),
      seismic_intensity: String(p.seismic_intensity || 0.08),
      name: p.name || '',
    });
    setActivePreset(idx);
    setValidationErrors({});
    if (hasImportedResults.current) formModifiedAfterImport.current = true;
  };

  const updateField = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (hasImportedResults.current) formModifiedAfterImport.current = true;
    // Clear error on edit
    if (validationErrors[key]) {
      setValidationErrors(e => { const n = { ...e }; delete n[key]; return n; });
    }
  };

  return (
    <div className="flex flex-col h-full animate-slide-left">
      {/* Scrollable form fields */}
      <div className="flex-1 overflow-y-auto space-y-4 scroll-smooth px-5">
        {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8em]">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu size={16} className="text-cyan" />
              结构参数
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">配置钢框架的几何与材料参数</p>
          </div>
          {/* 导入已有项目 */}
          <div ref={importRef} className="relative">
            <button
              onClick={() => {
                if (!showImportDropdown) fetchProjects();
                setShowImportDropdown(!showImportDropdown);
              }}
              disabled={importingProject}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-cyan/80 border border-cyan/30 rounded-md
                         hover:bg-cyan/10 hover:border-cyan/50 transition-all duration-200 whitespace-nowrap
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importingProject ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FolderOpen size={13} />
              )}
              导入已有项目
              <ChevronDown size={10} className={`transition-transform duration-200 ${showImportDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* 下拉菜单 */}
            {showImportDropdown && (
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-slate-900 border border-white/10 rounded-lg shadow-2xl
                              z-50 max-h-64 overflow-y-auto animate-slide-down">
                {loadingProjects ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-gray-500 text-[11px]">
                    <Loader2 size={14} className="animate-spin" />
                    加载历史项目...
                  </div>
                ) : projectList.length === 0 ? (
                  <div className="py-6 text-center text-gray-500 text-[11px]">
                    <FolderOpen size={20} className="mx-auto mb-1.5 opacity-40" />
                    暂无历史项目
                    <p className="text-[10px] mt-0.5 opacity-60">运行管道后将自动保存</p>
                  </div>
                ) : (
                  projectList.map((proj) => (
                    <button
                      key={proj.file}
                      onClick={() => importProject(proj.file)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5
                                 last:border-b-0 flex items-start gap-2.5"
                    >
                      <Download size={13} className="text-cyan/60 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[12px] text-gray-200 truncate">{proj.project_name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {proj.saved_at ? new Date(proj.saved_at).toLocaleString('zh-CN') : '未知时间'}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        <span className="text-[10px] text-gray-600 font-mono shrink-0">
          v2.0
        </span>
      </div>

      {/* Template presets */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <BookTemplate size={12} className="text-gray-500" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">快速模板</span>
        </div>
        <div className="flex gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(i)}
              className={`template-chip flex-1 ${activePreset === i ? 'active' : ''}`}
            >
              <span>{p.icon}</span>
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Geometry card */}
      <div className="form-card p-4">
        <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Grid3X3 size={13} className="text-cyan/60" />
          几何参数
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <FloatingInput
            label="X向柱距 (m)"
            icon={<Ruler size={13} />}
            value={form.grid_x}
            onChange={v => updateField('grid_x', v)}
            error={validationErrors.grid_x}
            placeholder="6,6,6"
          />
          <FloatingInput
            label="Y向柱距 (m)"
            icon={<Ruler size={13} />}
            value={form.grid_y}
            onChange={v => updateField('grid_y', v)}
            error={validationErrors.grid_y}
            placeholder="6,6,6"
          />
          <FloatingInput
            label="层数"
            icon={<Layers size={13} />}
            value={form.num_stories}
            onChange={v => updateField('num_stories', v)}
            error={validationErrors.num_stories}
            placeholder="4"
          />
          <FloatingInput
            label="层高 (m)"
            icon={<Building2 size={13} />}
            value={form.story_heights}
            onChange={v => updateField('story_heights', v)}
            error={validationErrors.story_heights}
            placeholder="4.5,3.6,3.6,3.6"
          />
        </div>
      </div>

      {/* Section & material card */}
      <div className="form-card p-4">
        <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Layers size={13} className="text-cyan/60" />
          截面与材料
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <SelectInput
            label="柱截面"
            value={form.column_section}
            onChange={v => updateField('column_section', v)}
            options={['HW300x300x10x15', 'HW350x350x12x19', 'HW400x400x13x21']}
          />
          <SelectInput
            label="梁截面"
            value={form.beam_section}
            onChange={v => updateField('beam_section', v)}
            options={['HM340x250x9x14', 'HM390x300x10x16', 'HM244x175x7x11']}
          />
          <SelectInput
            label="钢材"
            value={form.material}
            onChange={v => updateField('material', v)}
            options={['Q235', 'Q355']}
          />
          <FloatingInput
            label="项目名称"
            icon={<Info size={13} />}
            value={form.name}
            onChange={v => updateField('name', v)}
            placeholder="办公楼"
          />
        </div>
      </div>

      {/* Load parameters — always visible, compact */}
      <div className="form-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Weight size={13} className="text-cyan/60" />
            荷载参数
          </h4>
          <span className="flex gap-2 text-[9px]">
            <span className="text-[#4488ff]">● 恒载</span>
            <span className="text-[#44ff88]">● 活载</span>
            <span className="text-[#66ddff]">● 风</span>
            <span className="text-[#ff8844]">● 震</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FloatingInput label="恒载 (kN/m²)" icon={<Weight size={13} />} type="number" value={form.dead_load} onChange={v => updateField('dead_load', v)} />
          <FloatingInput label="活载 (kN/m²)" icon={<Weight size={13} />} type="number" value={form.live_load} onChange={v => updateField('live_load', v)} />
          <FloatingInput label="基本风压 (kN/m²)" icon={<Wind size={13} />} type="number" step="0.01" value={form.wind_pressure} onChange={v => updateField('wind_pressure', v)} />
          <FloatingInput label="地震影响系数" icon={<Gauge size={13} />} type="number" step="0.01" value={form.seismic_intensity} onChange={v => updateField('seismic_intensity', v)} />
        </div>
      </div>

      {/* Live summary card */}
      <div className="bg-gradient-to-r from-cyan/[0.04] to-transparent border border-cyan/10 rounded-lg p-3">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Zap size={11} className="text-cyan/60" />
          模型预览
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-white/[0.03] rounded-md py-2">
            <div className="text-sm font-semibold text-cyan font-mono">{summary.nx}×{summary.ny}</div>
            <div className="text-[9px] text-gray-500">柱网</div>
          </div>
          <div className="bg-white/[0.03] rounded-md py-2">
            <div className="text-sm font-semibold text-cyan font-mono">{summary.ns}</div>
            <div className="text-[9px] text-gray-500">层数</div>
          </div>
          <div className="bg-white/[0.03] rounded-md py-2">
            <div className="text-sm font-semibold text-cyan font-mono">{summary.totalHeight.toFixed(1)}m</div>
            <div className="text-[9px] text-gray-500">总高</div>
          </div>
          <div className="bg-white/[0.03] rounded-md py-2">
            <div className="text-sm font-semibold text-cyan font-mono">{summary.totalColumns}</div>
            <div className="text-[9px] text-gray-500">构件</div>
          </div>
        </div>
      </div>

      {/* Validation errors summary */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 animate-scale-in">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-red-400 font-medium mb-1">请修正以下参数</div>
              <ul className="text-[11px] text-red-300/70 space-y-0.5">
                {Object.entries(validationErrors).map(([k, v]) => (
                  <li key={k}>· {v}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Fixed bottom: submit + auto demo */}
      <div className="px-5 py-4 border-t border-white/5 bg-[#0a0b0d]/95 shrink-0">
        {/* Engine status — 持续检测，自动重连 */}
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-2">
          {backendStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(50,204,100,0.5)]" />
              <span className="text-[10px] text-green-400/70">服务端模式</span>
            </>
          ) : backendStatus === 'checking' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-yellow-400/70 animate-pulse" />
              <span className="text-[10px] text-yellow-400/60">检测中...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400/50" />
              <span className="text-[10px] text-gray-500">后端未连 (第{retryCount}次重试，自动拉起中...)</span>
            </>
          )}
          </div>
        </div>
        {/* Submit button */}
        <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={`
          w-full py-3.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2.5
          transition-all duration-300 relative overflow-hidden
          ${isSubmitting
            ? 'bg-cyan/20 text-cyan cursor-wait'
            : 'bg-gradient-to-r from-cyan to-cyan/80 text-black hover:from-cyan/90 hover:to-cyan/70 hover:shadow-[0_0_30px_rgba(0,212,255,0.2)]'
          }
        `}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            正在分析...
          </>
        ) : (
          <>
            <Cpu size={16} />
            生成并分析
            <ArrowRight size={15} />
          </>
        )}
      </button>

      {/* Auto demo */}
      <AutoDemoButton />
      </div>
    </div>
  );
}

// ── Floating Input Component ───────────────────────────────────

function FloatingInput({
  label, value, onChange, icon, error, placeholder, type = 'text', step,
}: {
  label: string; value: string; onChange: (v: string) => void;
  icon?: React.ReactNode; error?: string; placeholder?: string;
  type?: string; step?: string;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className="floating-label-group">
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={error ? 'input-error' : ''}
      />
      {/* label 默认在顶部；仅在输入框为空且未聚焦时下沉作为占位提示 */}
      <label className={(!hasValue && !focused) ? 'label-down' : ''}>
        {error ? (
          <span className="flex items-center gap-1">
            <AlertCircle size={10} className="text-red-400" />
            {error}
          </span>
        ) : label}
      </label>
      {icon && !error && <span className="field-icon">{icon}</span>}
      {error && <span className="absolute right-2 top-1/2 -translate-y-1/2"><AlertCircle size={13} className="text-red-400" /></span>}
      {!error && hasValue && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2">
          <CheckCircle2 size={12} className="text-green-500/50" />
        </span>
      )}
    </div>
  );
}

// ── Select Input Component ─────────────────────────────────────

function SelectInput({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className="floating-label-group">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <label className={(!hasValue && !focused) ? 'label-down' : ''}>{label}</label>
      {hasValue && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
          <CheckCircle2 size={12} className="text-green-500/50" />
        </span>
      )}
    </div>
  );
}

// ── Auto Demo Button ───────────────────────────────────────────

function AutoDemoButton() {
  const [hover, setHover] = useState(false);

  const handleAutoDemo = () => {
    const store = useStore.getState();
    const params: RunPipelineParams = {
      grid_x: [6, 6, 6], grid_y: [6, 6, 6], num_stories: 4,
      story_heights: [4.5, 3.6, 3.6, 3.6],
      column_section: 'HW400x400x13x21', beam_section: 'HM390x300x10x16',
      material: 'Q355', name: '办公楼', dead_load: 2.0, live_load: 3.0,
      wind_pressure: 0.45, seismic_intensity: 0.08,
    };
    store.setEngineeringParams(params as unknown as Record<string, unknown>);
    generateMockResults(store, params);
    store.setAutoDemo(true);
    store.setStep('modeling');
  };

  return (
    <button
      onClick={handleAutoDemo}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`
        w-full py-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2
        border transition-all duration-300 relative overflow-hidden
        ${hover
          ? 'border-purple-500/40 text-purple-300 bg-purple-500/8'
          : 'border-purple-500/15 text-purple-400/60'
        }
      `}
    >
      {/* Shimmer effect on hover */}
      {hover && <div className="absolute inset-0 animate-shimmer" />}
      <Zap size={14} className={hover ? 'text-purple-300' : 'text-purple-400/60'} />
      自动演示模式 · 全流程自动播放
    </button>
  );
}

// ── LLM Chat ────────────────────────────────────────────────────

type LlmSubMode = 'extract' | 'agent';

function LLMChat() {
  const {
    llmConfig, llmPrompt, setLlmPrompt, llmResponse, setLlmResponse,
    setIsRunning, setError, setEngineeringParams,
    setThreeDData, setReportUrl, setPipelineSteps, setPipelineActiveIndex,
  } = useStore();
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [llmSubMode, setLlmSubMode] = useState<LlmSubMode>('extract');
  const [hasExtracted, setHasExtracted] = useState(false);
  const [extractedParams, setExtractedParams] = useState<RunPipelineParams | null>(null);
  const [showAgentProceed, setShowAgentProceed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatEndRef.current;
    if (el) el.parentElement?.scrollTo({ top: el.parentElement.scrollHeight, behavior: 'smooth' });
  }, [messages, llmResponse]);

  const handleStartModeling = () => {
    const store = useStore.getState();
    const stepNames = ['模型生成', '荷载施加', '有限元分析', '规范校核', '报告生成'];
    store.setPipelineSteps(stepNames.map(s => ({ step: s })));
    store.setPipelineActiveIndex(0);

    if (extractedParams) {
      store.setIsRunning(true);
      store.setStep('modeling');
      runPipelineBackground(extractedParams);
    } else {
      store.setStep('modeling');
    }
  };

  const handleSend = async () => {
    if (!llmPrompt.trim()) return;
    const prompt = llmPrompt;
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setLlmPrompt('');
    setLlmResponse('');
    setIsTyping(true);
    setIsRunning(true);
    setHasExtracted(false);
    setExtractedParams(null);
    setShowAgentProceed(false);
    setError(null);

    const llmConfigPayload = llmConfig.apiKey
      ? {
          api_key: llmConfig.apiKey,
          model: llmConfig.model || undefined,
          base_url: llmConfig.baseUrl || undefined,
        }
      : undefined;

    let text = '';

    try {
      if (llmSubMode === 'extract') {
        const result = await api.llmExtract({
          prompt,
          llm_config: llmConfigPayload,
        });

        if (result.status === 'success' && result.params) {
          const p = result.params;
          setExtractedParams(p);
          setEngineeringParams(p as unknown as Record<string, unknown>);
          setHasExtracted(true);

          text = `## 📋 参数提取结果\n\n`;
          text += `| 参数 | 值 |\n|---|---|\n`;
          text += `| 柱网 X | ${p.grid_x.join(' × ')} m |\n`;
          text += `| 柱网 Y | ${p.grid_y.join(' × ')} m |\n`;
          text += `| 层数 | ${p.num_stories} |\n`;
          text += `| 层高 | ${p.story_heights.join(', ')} m |\n`;
          text += `| 柱截面 | ${p.column_section || 'HW350x350x12x19'} |\n`;
          text += `| 梁截面 | ${p.beam_section || 'HM340x250x9x14'} |\n`;
          text += `| 材料 | ${p.material || 'Q355'} |\n`;
          text += `\n✅ 参数提取完成！点击下方按钮开始建模。`;
        } else {
          throw new Error((result as Record<string, unknown>).message as string || '后端返回错误');
        }
      } else {
        const result = await api.llmAgent({
          prompt,
          llm_config: llmConfigPayload,
        });

        if (result.status === 'success') {
          if (result.three_d_data) setThreeDData(result.three_d_data);
          if (result.report_url) setReportUrl(result.report_url);

          const stepNames = ['模型生成', '荷载施加', '有限元分析', '规范校核', '报告生成'];
          setPipelineSteps(stepNames.map(s => ({ step: s })));
          setPipelineActiveIndex(0);
          setShowAgentProceed(true);

          text = `## 🤖 Agent 执行报告\n\n`;
          if (result.steps.length > 0) {
            text += `### 执行步骤\n`;
            result.steps.forEach((s, i) => {
              text += `\n**步骤 ${i + 1}**: \`${s.tool}\`\n└ ${s.output}\n`;
            });
          }
          text += `\n### 🎯 最终结果\n${result.final_response}`;
        } else {
          throw new Error((result as Record<string, unknown>).message as string || '后端返回错误');
        }
      }

      let i = 0;
      setLlmResponse('');
      const timer = setInterval(() => {
        if (i < text.length) { setLlmResponse(text.slice(0, i + 1)); i++; }
        else { clearInterval(timer); setIsTyping(false); }
      }, llmSubMode === 'extract' ? 15 : 10);
    } catch (err) {
      console.warn('Backend LLM call failed, falling back to keyword parser:', err);
      await new Promise(r => setTimeout(r, llmSubMode === 'extract' ? 800 : 1500));

      if (llmSubMode === 'extract') {
        const parsed = parseDesignParams(prompt);
        const params = parsed.params;
        setExtractedParams(params);
        setEngineeringParams(params as unknown as Record<string, unknown>);
        setHasExtracted(true);

        const confLabel = parsed.confidence === 'high' ? '高' : parsed.confidence === 'medium' ? '中' : '低';
        text = `## 📋 参数提取结果 (离线模式)\n\n`;
        text += `| 参数 | 值 |\n|---|---|\n`;
        text += `| 柱网 X | ${params.grid_x.join(' × ')} m |\n`;
        text += `| 柱网 Y | ${params.grid_y.join(' × ')} m |\n`;
        text += `| 层数 | ${params.num_stories} |\n`;
        text += `| 层高 | ${params.story_heights.join(', ')} m |\n`;
        text += `| 柱截面 | ${params.column_section} |\n`;
        text += `| 梁截面 | ${params.beam_section} |\n`;
        text += `| 材料 | ${params.material} |\n`;
        text += `| 恒载 | ${params.dead_load} kN/m² |\n`;
        text += `| 活载 | ${params.live_load} kN/m² |\n`;
        text += `\n> 💡 LLM 调用失败（${String(err).slice(0, 80)}），使用离线关键词解析（置信度: ${confLabel}）\n\n✅ 参数提取完成！点击下方按钮开始建模。`;
      } else {
        setShowAgentProceed(true);
        text = `## 🤖 Agent 执行报告 (演示模式)\n\n`;
        text += `> 💡 LLM 调用失败（${String(err).slice(0, 80)}），使用演示模式\n\n`;
        text += `### 执行步骤\n`;
        const mockSteps = [
          { tool: 'extract_params_from_text', output: '参数提取完成' },
          { tool: 'run_full_pipeline', output: '全流程运行成功' },
          { tool: 'export_3d_model', output: '3D数据导出完成' },
          { tool: 'generate_report', output: '报告已生成' },
        ];
        mockSteps.forEach((s, i) => {
          text += `\n**步骤 ${i + 1}**: \`${s.tool}\`\n└ ${s.output}\n`;
        });
        text += `\n### 🎯 最终结果\n✅ 设计完成！根据您的需求，已自动完成建模、荷载、分析、校核全流程。`;
      }

      let i = 0;
      setLlmResponse('');
      const timer = setInterval(() => {
        if (i < text.length) { setLlmResponse(text.slice(0, i + 1)); i++; }
        else { clearInterval(timer); setIsTyping(false); }
      }, llmSubMode === 'extract' ? 15 : 10);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-slide-left p-5">
      {/* Sub-mode tabs + API settings */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1 bg-white/5 rounded-lg p-1 flex-1">
          <button onClick={() => { setLlmSubMode('extract'); setShowAgentProceed(false); }}
            className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${llmSubMode === 'extract' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
            <Sparkles size={13} /> 参数提取
          </button>
          <button onClick={() => { setLlmSubMode('agent'); setShowAgentProceed(false); }}
            className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${llmSubMode === 'agent' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
            <Bot size={13} /> 全自动 Agent
          </button>
        </div>
        <button onClick={() => setShowApiSettings(true)}
          className={`p-2 rounded-lg transition-all border ${llmConfig.apiKey ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
          title="API 设置">
          <Key size={14} />
        </button>
      </div>

      {/* Mode description */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-3 px-1">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${llmSubMode === 'extract' ? 'bg-purple-400' : 'bg-cyan'}`} />
          {llmSubMode === 'extract'
            ? '输入自然语言 → LLM提取参数 → 确认后建模'
            : '一句话需求 → AI全自动编排 → 完整结果'}
        </span>
        {!llmConfig.apiKey && (
          <span className="text-yellow-500/70 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10">
            服务端模式
          </span>
        )}
      </div>

      {/* API Settings Modal */}
      {showApiSettings && <ApiSettingsModal onClose={() => setShowApiSettings(false)} />}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-6 animate-fade-in">
            {/* Animated icon */}
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 bg-purple-500/10 rounded-full animate-pulse" />
              <div className="absolute inset-2 bg-purple-500/20 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <MessageSquare size={20} className="text-purple-400" />
              </div>
            </div>

            <h4 className="text-sm font-medium text-gray-300 mb-1">AI 辅助设计</h4>
            <p className="text-[11px] text-gray-500 mb-4 max-w-[260px] mx-auto leading-relaxed">
              {llmSubMode === 'extract'
                ? '用自然语言描述您的钢结构需求，AI 自动提取设计参数'
                : '一句话描述需求，AI Agent 全自动完成建模到报告全流程'}
            </p>

            {/* Prompt suggestions */}
            <div className="space-y-1.5 px-2">
              {[
                { label: '🏢 设计一个4层办公楼，柱网6m×6m', text: '设计一个4层办公楼，柱网6m×6m' },
                { label: '🏗️ 3层钢框架，层高4.2m，Q355钢材', text: '3层钢框架，层高4.2m，Q355钢材' },
                { label: '🏭 厂房设计：2层，9m跨，带吊车荷载', text: '厂房设计：2层，9m跨，带吊车荷载' },
              ].map((s, i) => (
                <button key={i} onClick={() => { setLlmPrompt(s.text); }}
                  className="block w-full text-xs text-left px-3.5 py-2.5 rounded-lg glass text-gray-400 hover:text-cyan hover:border-cyan/30 hover:bg-cyan/[0.03] transition-all duration-200 border border-transparent group">
                  <span className="group-hover:translate-x-0.5 transition-transform inline-block">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-scale-in`}>
            <div className={`max-w-[88%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === 'user'
                ? 'message-user text-cyan'
                : 'message-assistant text-gray-200'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {llmResponse && (
          <div className="flex justify-start animate-scale-in">
            <div className="max-w-[88%] rounded-xl px-4 py-2.5 text-sm message-assistant text-gray-200 leading-relaxed whitespace-pre-wrap">
              <span className={isTyping ? 'typing-cursor' : ''}>{llmResponse}</span>
            </div>
          </div>
        )}

        {isTyping && !llmResponse && (
          <div className="flex justify-start">
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-[10px] text-gray-500 ml-1">思考中...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Action buttons */}
      {hasExtracted && llmSubMode === 'extract' && (
        <button onClick={handleStartModeling}
          className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2
            bg-gradient-to-r from-purple-500 to-purple-600 text-white
            hover:from-purple-400 hover:to-purple-500 transition-all duration-300 mb-3
            shadow-lg shadow-purple-500/20">
          <Cpu size={15} /> 确认并开始建模 <ArrowRight size={14} />
        </button>
      )}

      {showAgentProceed && llmSubMode === 'agent' && (
        <button onClick={() => useStore.getState().setStep('modeling')}
          className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2
            bg-gradient-to-r from-purple-500 to-purple-600 text-white
            hover:from-purple-400 hover:to-purple-500 transition-all duration-300 mb-3
            shadow-lg shadow-purple-500/20">
          <Bot size={15} /> 查看3D模型 <ArrowRight size={14} />
        </button>
      )}

      {/* Input area */}
      <div className="flex gap-2 bg-white/[0.02] rounded-xl p-1 border border-white/5">
        <input
          className="flex-1 px-3 py-2.5 bg-transparent text-sm text-[#f5f9fe] outline-none placeholder-gray-600"
          value={llmPrompt}
          onChange={e => setLlmPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isTyping && handleSend()}
          placeholder={llmSubMode === 'extract' ? '描述钢结构设计需求...' : '一句话描述需求...'}
        />
        <button
          onClick={handleSend}
          disabled={isTyping || !llmPrompt.trim()}
          className="px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
