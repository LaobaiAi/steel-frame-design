import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { FileText, Maximize2, Minimize2, Image, Loader, X, ChevronDown, ChevronUp, Download, Ruler } from 'lucide-react';
import { exportPanoramaFromStore } from '../utils/exportPanorama';

// ── 截面每延米重量 (A * 7850 kg/m³, 单位: kg/m) ───────────────
const SECTION_WEIGHT: Record<string, number> = {
  'HW300x300x10x15': 94.5,
  'HW350x350x12x19': 136.3,
  'HW400x400x13x21': 171.7,
  'HM244x175x7x11': 43.6,
  'HM294x200x8x12': 57.3,
  'HM340x250x9x14': 79.9,
  'HM390x300x10x16': 107.2,
};

export default function ReportPreview() {
  const { codeCheckResults, analysisResults, engineeringParams, selectedElements, setSelectedElements } = useStore();
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmPanorama, setConfirmPanorama] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showQuantity, setShowQuantity] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const check = (codeCheckResults ?? {}) as Record<string, unknown>;
  const summary = (check?.summary ?? {}) as Record<string, unknown>;
  const elements = useMemo(() => (check?.elements ?? []) as Array<Record<string, unknown>>, [check?.elements]);
  const analysis = (analysisResults ?? {}) as Record<string, unknown>;
  const params = useMemo(() => (engineeringParams ?? {}) as Record<string, unknown>, [engineeringParams]);

  // ── 统一从 elements 计算 pass/fail，与 ResultsPanel 口径一致 ──
  const totalElements = elements.length || (summary.total_elements as number) || 0;
  const failedElements = useMemo(() => elements.filter((el) => !el.pass), [elements]);
  const failed = failedElements.length;
  const passed = totalElements - failed;
  const maxStress: number | string = (summary.max_stress_ratio as number | undefined) ?? '-';
  const maxDeflection: number | string = (summary.max_deflection_ratio as number | undefined) ?? '-';
  const maxDispRaw = (analysis?.max_displacement ?? (analysis?.summary as Record<string, unknown>)?.max_displacement) as number | undefined;
  const maxDisp: number | string = maxDispRaw != null ? maxDispRaw * 1000 : '-';

  const passRate = totalElements > 0 ? ((passed / totalElements) * 100).toFixed(1) : '0';

  // ── 材料工程量计算 ──────────────────────────────────────────
  const quantityData = useMemo(() => {
    const gridX = (params.grid_x ?? []) as number[];
    const gridY = (params.grid_y ?? []) as number[];
    const heights = (params.story_heights ?? []) as number[];
    const nStories = (params.num_stories as number) ?? 0;
    const colSec = (params.column_section ?? 'HW350x350x12x19') as string;
    const beamSec = (params.beam_section ?? 'HM340x250x9x14') as string;

    if (!gridX.length || !gridY.length || !nStories) {
      return { total: 0, details: [], bySection: [] };
    }

    const nColX = gridX.length + 1;
    const nColY = gridY.length + 1;

    // 柱统计
    let colTotalLen = 0;
    const colPerStory: { story: number; count: number; length: number }[] = [];
    for (let s = 0; s < nStories; s++) {
      const h = heights[s] ?? 0;
      const cnt = nColX * nColY;
      colTotalLen += cnt * h;
      colPerStory.push({ story: s + 1, count: cnt, length: h });
    }

    // 梁统计
    const beamXCount = gridX.length * nColY * nStories;
    const beamYCount = nColX * gridY.length * nStories;
    const beamXLen = gridX.reduce((a, b) => a + b, 0) * nColY * nStories;
    const beamYLen = gridY.reduce((a, b) => a + b, 0) * nColX * nStories;
    const beamTotalLen = beamXLen + beamYLen;

    const colW = (SECTION_WEIGHT[colSec] ?? 100) / 1000; // kg/m → t/m
    const beamW = (SECTION_WEIGHT[beamSec] ?? 80) / 1000;
    const colWeight = colTotalLen * colW;
    const beamWeight = beamTotalLen * beamW;

    const details = [
      { label: '柱', section: colSec, count: nColX * nColY * nStories, totalLen: colTotalLen, unitW: colW, totalW: colWeight },
      { label: 'X向梁', section: beamSec, count: beamXCount, totalLen: beamXLen, unitW: beamW, totalW: beamWeight * (beamXLen / beamTotalLen || 0.5) },
      { label: 'Y向梁', section: beamSec, count: beamYCount, totalLen: beamYLen, unitW: beamW, totalW: beamWeight * (beamYLen / beamTotalLen || 0.5) },
    ];
    const total = colWeight + beamWeight;

    return { total, details, bySection: [{ section: colSec, weight: colWeight }, { section: beamSec, weight: beamWeight }] };
  }, [params]);

  const handleExportPanorama = async () => {
    if (exporting) return;
    setConfirmPanorama(false);
    setExporting(true);
    try {
      await exportPanoramaFromStore();
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleOneClickReport = () => {
    setGeneratingReport(true);
    try {
      // ── 组装报告文本 ────────────────────────────────────────────
      const lines: string[] = [];
      const sep = '='.repeat(56);
      const sub = '-'.repeat(56);

      lines.push(sep);
      lines.push('XuanwuAI — AI 驱动的参数化钢框架设计');
      lines.push('  钢框架结构  —  一键报告');
      lines.push(`  生成时间: ${new Date().toLocaleString('zh-CN')}`);
      lines.push(sep);
      lines.push('');

      // 1) 项目信息
      lines.push('【项目信息】');
      lines.push(sub);
      lines.push(`  项目名称         ${params.name || '钢框架'}`);
      lines.push(`  材料等级         ${params.material || 'Q355'}`);
      lines.push(`  柱截面           ${params.column_section || '-'}`);
      lines.push(`  梁截面           ${params.beam_section || '-'}`);
      const gridX = (params.grid_x ?? []) as number[];
      const gridY = (params.grid_y ?? []) as number[];
      const gridStrX = gridX.map(v => `${v}m`).join(' × ');
      const gridStrY = gridY.map(v => `${v}m`).join(' × ');
      lines.push(`  柱网 X 向        ${gridStrX || '-'}`);
      lines.push(`  柱网 Y 向        ${gridStrY || '-'}`);
      lines.push(`  层数             ${params.num_stories ?? '-'}`);
      const heights = (params.story_heights ?? []) as number[];
      lines.push(`  层高             ${heights.length ? heights.map(v => `${v}m`).join(' / ') : '-'}`);
      lines.push(`  恒载             ${params.dead_load ?? '-'} kN/m²`);
      lines.push(`  活载             ${params.live_load ?? '-'} kN/m²`);
      lines.push(`  基本风压         ${params.wind_pressure ?? '-'} kN/m²`);
      lines.push(`  抗震设防烈度     ${params.seismic_intensity ?? '-'} g`);
      lines.push('');

      // 2) 校核总览
      lines.push('【校核总览】');
      lines.push(sub);
      lines.push(`  总构件数         ${totalElements}`);
      lines.push(`  通过             ${passed}`);
      lines.push(`  未通过           ${failed}`);
      lines.push(`  通过率           ${passRate}%`);
      lines.push(`  最大应力比       ${typeof maxStress === 'number' ? maxStress.toFixed(3) : maxStress}`);
      lines.push(`  最大挠度比       ${typeof maxDeflection === 'number' ? maxDeflection.toFixed(3) : maxDeflection}`);
      lines.push(`  最大位移         ${typeof maxDisp === 'number' ? `${maxDisp.toFixed(2)} mm` : maxDisp}`);
      lines.push('');

      // 3) 工程量
      lines.push('【材料工程量】');
      lines.push(sub);
      lines.push(`  总重                         ${quantityData.total.toFixed(1)} t`);
      lines.push('');
      lines.push('  类型       截面                    数量     总长(m)    重量(t)');
      lines.push('  ' + '-'.repeat(54));
      quantityData.details.forEach(d => {
        lines.push(`  ${d.label.padEnd(6)} ${d.section.padEnd(22)} ${String(d.count).padStart(5)} ${d.totalLen.toFixed(1).padStart(9)} ${d.totalW.toFixed(2).padStart(8)}`);
      });
      lines.push('');
      lines.push('  分截面汇总:');
      quantityData.bySection.forEach(s => {
        lines.push(`    ${s.section.padEnd(22)} ${s.weight.toFixed(2)} t`);
      });
      lines.push('');

      // 4) 不合格构件清单
      if (failedElements.length > 0) {
        lines.push('【不合格构件清单】');
        lines.push(sub);
        failedElements.forEach((el) => {
          lines.push(`  构件 ID: ${String(el.id ?? '-')}  |  楼层: ${String(el.story ?? '-')}F  |  类型: ${String(el.type || el.element_type || '-')}`);
          lines.push(`  截面: ${String(el.section || '-')}  |  节点: ${String(el.node_i ?? '-')} — ${String(el.node_j ?? '-')}`);
          if (el.length_m != null) lines.push(`  长度: ${el.length_m} m`);
          lines.push(`  应力比:       ${Number(el.stress_ratio ?? 0).toFixed(3)}   ${Number(el.stress_ratio ?? 0) <= 1 ? '✓' : '✗ 超限'}`);
          lines.push(`  稳定比:       ${Number(el.stability_ratio ?? 0).toFixed(3)}   ${Number(el.stability_ratio ?? 0) <= 1 ? '✓' : '✗ 超限'}`);
          lines.push(`  挠度比:       ${Number(el.deflection_ratio ?? 0).toFixed(3)}   ${Number(el.deflection_ratio ?? 0) <= 1 ? '✓' : '✗ 超限'}`);
          if (el.slenderness_ratio != null)
            lines.push(`  长细比:       ${Number(el.slenderness_ratio ?? 0).toFixed(1)}   ${Number(el.slenderness_ratio ?? 0) <= 150 ? '✓' : '✗ 超限'}`);
          const msgs = (el.messages ?? []) as string[];
          if (msgs.length) msgs.forEach((m: string) => lines.push(`  > ${m}`));
          lines.push('');
        });
      } else {
        lines.push('【不合格构件】');
        lines.push(sub);
        lines.push('  所有构件均通过校核，无不合格项。');
        lines.push('');
      }

      // 5) 结论
      lines.push('【结论】');
      lines.push(sub);
      if (failed > 0) {
        lines.push(`  共 ${failed} 个构件未通过校核，最大应力比 ${typeof maxStress === 'number' ? maxStress.toFixed(3) : maxStress}。`);
        lines.push('  建议调整截面尺寸或优化结构布置后重新验算。');
      } else {
        lines.push('  结构整体满足 GB 50017-2017 规范要求，所有构件通过校核。');
      }
      lines.push('');
      lines.push(sep);

      // ── 触发下载 ──────────────────────────────────────────────
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${params.name || '钢框架'}_校核报告.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Generate report failed:', e);
    } finally {
      setGeneratingReport(false);
    }
  };

  const width = fullscreen ? '90vw' : '896px';
  const height = fullscreen ? '85vh' : (collapsed ? 'auto' : '70vh');

  return (
    <div
      className="glass-strong rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
      style={{ width, height, minWidth: 832 }}
    >
      {/* Report toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-cyan" />
          <span className="text-sm font-medium text-gray-200">校核报告</span>
          {totalElements > 0 && (
            <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
              {totalElements} 构件
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOneClickReport}
            disabled={generatingReport}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-cyan/10 text-cyan/80 hover:bg-cyan/20 transition-all flex items-center gap-1.5"
          >
            {generatingReport ? <Loader size={11} className="animate-spin" /> : <Download size={11} />}
            {generatingReport ? '生成中' : '一键报告'}
          </button>
          <button
            onClick={() => setShowQuantity(true)}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-400/10 text-emerald-400/80 hover:bg-emerald-400/20 transition-all flex items-center gap-1.5"
          >
            <Ruler size={11} />
            工程量
          </button>
          <button
            onClick={() => setConfirmPanorama(true)}
            disabled={exporting}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-cyan/10 text-cyan/80 hover:bg-cyan/20 transition-all flex items-center gap-1.5"
          >
            {exporting ? <Loader size={11} className="animate-spin" /> : <Image size={11} />}
            {exporting ? '渲染中' : '高清全景'}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-all"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-all"
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-auto">
          {totalElements > 0 ? (
            /* Data-driven report from store */
            <div className="p-5 space-y-4 text-xs">
              {/* Brand header */}
              <div className="text-center py-2">
                <div className="text-[13px] font-semibold text-gradient-brand">XuanwuAI</div>
                <div className="text-[10px] text-gray-500 mt-0.5">AI 驱动的参数化钢框架设计</div>
              </div>
              {/* Project info */}
              <div className="glass rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-200 mb-2">项目信息</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between"><span className="text-gray-500">项目名称</span><span className="text-white">{String(params.name || '钢框架')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">材料</span><span className="text-white">{String(params.material || 'Q355')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">柱截面</span><span className="text-white font-mono text-[11px]">{String(params.column_section || '-')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">梁截面</span><span className="text-white font-mono text-[11px]">{String(params.beam_section || '-')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">层数</span><span className="text-white">{String(params.num_stories || '-')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">设计规范</span><span className="text-white">GB 50017-2017</span></div>
                </div>
              </div>

              {/* Check overview */}
              <div className="glass rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-200">校核总览</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <div className="text-lg font-bold text-white">{totalElements}</div>
                    <div className="text-[10px] text-gray-500">总构件数</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <div className="text-lg font-bold text-green-400">{passed}</div>
                    <div className="text-[10px] text-gray-500">通过</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <div className={`text-lg font-bold ${failed > 0 ? 'text-red-400' : 'text-green-400'}`}>{failed}</div>
                    <div className="text-[10px] text-gray-500">未通过</div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-gray-500">通过率</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${passRate}%`,
                            background: failed > 0 ? '#f59e0b' : '#22c55e',
                          }}
                        />
                      </div>
                      <span className="text-white font-mono text-[11px]">{passRate}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-500">最大应力比</span><span className={`font-mono ${Number(maxStress) > 1 ? 'text-red-400' : Number(maxStress) > 0.85 ? 'text-yellow-400' : 'text-green-400'}`}>{typeof maxStress === 'number' ? maxStress.toFixed(3) : maxStress}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">最大挠度比</span><span className={`font-mono ${Number(maxDeflection) > 1 ? 'text-red-400' : 'text-green-400'}`}>{typeof maxDeflection === 'number' ? maxDeflection.toFixed(3) : maxDeflection}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">最大位移</span><span className="text-white font-mono">{typeof maxDisp === 'number' ? `${maxDisp.toFixed(2)} mm` : maxDisp}</span></div>
                </div>
              </div>

              {/* Element detail table */}
              {elements.length > 0 && (
                <div className="glass rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-200 mb-3">
                    构件校核明细
                    <span className="text-[10px] text-gray-500 font-normal ml-2">点击行高亮模型</span>
                  </h4>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-gray-500 border-b border-white/5 sticky top-0 bg-[#0a0b0d]/90">
                          <th className="text-left py-1.5 pr-2 font-medium w-8">ID</th>
                          <th className="text-left py-1.5 pr-2 font-medium w-10">楼层</th>
                          <th className="text-left py-1.5 pr-2 font-medium">类型</th>
                          <th className="text-right py-1.5 pr-2 font-medium">应力比</th>
                          <th className="text-right py-1.5 pr-2 font-medium">稳定比</th>
                          <th className="text-right py-1.5 pr-2 font-medium">挠度比</th>
                          <th className="text-center py-1.5 font-medium w-10">结果</th>
                        </tr>
                      </thead>
                      <tbody>
                        {elements.map((el, i: number) => {
                          const stressOk = Number(el.stress_ratio ?? 0) <= 1;
                          const stabilityOk = Number(el.stability_ratio ?? 0) <= 1;
                          const deflectionOk = Number(el.deflection_ratio ?? 0) <= 1;
                          const allOk = stressOk && stabilityOk && deflectionOk;
                          const elId = (el.id as number) ?? i + 1;
                          const isSelected = selectedElements.includes(elId);
                          return (
                            <tr
                              key={elId}
                              onClick={() => setSelectedElements(isSelected ? [] : [elId])}
                              className={`border-b border-white/[0.02] cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-cyan/20 hover:bg-cyan/25'
                                  : 'hover:bg-white/[0.03]'
                              }`}
                            >
                              <td className="py-1.5 pr-2 text-white font-mono">{elId}</td>
                              <td className="py-1.5 pr-2 text-gray-400 font-mono">{String(el.story ?? '-')}</td>
                              <td className="py-1.5 pr-2 text-gray-400">{String(el.type || el.element_type || '-')}</td>
                              <td className={`py-1.5 pr-2 text-right font-mono ${stressOk ? 'text-green-400' : 'text-red-400'}`}>{Number(el.stress_ratio ?? 0).toFixed(3)}</td>
                              <td className={`py-1.5 pr-2 text-right font-mono ${stabilityOk ? 'text-green-400' : 'text-red-400'}`}>{Number(el.stability_ratio ?? 0).toFixed(3)}</td>
                              <td className={`py-1.5 pr-2 text-right font-mono ${deflectionOk ? 'text-green-400' : 'text-red-400'}`}>{Number(el.deflection_ratio ?? 0).toFixed(3)}</td>
                              <td className="py-1.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${allOk ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                                  {allOk ? '✓' : '✗'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Failed components list ── */}
              {failed > 0 && (
                <div className="glass rounded-lg p-4 border border-red-400/10">
                  <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                    <X size={14} />
                    未通过构件 ({failed})
                  </h4>
                  <div className="space-y-1.5">
                    {failedElements.map((el) => {
                      const fails: string[] = [];
                      if (Number(el.stress_ratio ?? 0) > 1) fails.push(`应力比 ${Number(el.stress_ratio ?? 0).toFixed(3)}`);
                      if (Number(el.stability_ratio ?? 0) > 1) fails.push(`稳定比 ${Number(el.stability_ratio ?? 0).toFixed(3)}`);
                      if (Number(el.deflection_ratio ?? 0) > 1) fails.push(`挠度比 ${Number(el.deflection_ratio ?? 0).toFixed(3)}`);
                      if (Number(el.slenderness_ratio ?? 0) > 150) fails.push(`长细比 ${Number(el.slenderness_ratio ?? 0).toFixed(1)}`);
                      const felId = (el.id as number) ?? 0;
                      return (
                        <div key={felId} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-400/5 hover:bg-red-400/10 transition-colors cursor-pointer"
                          onClick={() => setSelectedElements([felId])}>
                          <span className="text-[11px] font-mono text-gray-400 w-8">{felId}</span>
                          <span className="text-[11px] text-gray-300 w-10">{String(el.story ?? '-')}F</span>
                          <span className="text-[11px] text-gray-400 w-14">{String(el.type || '-')}</span>
                          <span className="text-[11px] text-gray-500 flex-1">{fails.join('; ')}</span>
                          <X size={10} className="text-red-400/60" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conclusion */}
              <div className={`rounded-lg p-3 border text-[11px] ${failed > 0 ? 'border-yellow-400/20 bg-yellow-400/5 text-yellow-300' : 'border-green-400/20 bg-green-400/5 text-green-300'}`}>
                {failed > 0
                  ? `结论：${failed} 个构件未通过校核，最大应力比 ${typeof maxStress === 'number' ? maxStress.toFixed(3) : maxStress}，建议调整截面或优化结构布置。`
                  : '结论：结构整体满足规范要求，所有构件通过校核。'}
              </div>
            </div>
          ) : params.grid_x ? (
            /* Fallback: show project info from engineering params, no check data yet */
            <div className="p-5 space-y-4 text-xs">
              <div className="glass rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-200 mb-2">项目信息</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between"><span className="text-gray-500">项目名称</span><span className="text-white">{String(params.name || '钢框架')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">材料</span><span className="text-white">{String(params.material || 'Q355')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">柱截面</span><span className="text-white font-mono text-[11px]">{String(params.column_section || '-')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">梁截面</span><span className="text-white font-mono text-[11px]">{String(params.beam_section || '-')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">层数</span><span className="text-white">{String(params.num_stories || '-')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">设计规范</span><span className="text-white">GB 50017-2017</span></div>
                </div>
              </div>
              <div className="text-center py-4">
                <FileText size={32} className="text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">校核数据尚未生成</p>
                <p className="text-[10px] text-gray-600 mt-1">请返回上一步运行有限元分析与规范校核</p>
              </div>
            </div>
          ) : (
            /* Empty state — no data at all */
            <div className="p-8 flex flex-col items-center justify-center text-center h-48">
              <FileText size={36} className="text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 mb-1">暂无校核数据</p>
              <p className="text-[11px] text-gray-600">请先运行有限元分析与规范校核步骤</p>
            </div>
          )}
        </div>
      )}

      {/* Panorama confirmation dialog */}
      {confirmPanorama && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setConfirmPanorama(false)}>
          <div className="glass-strong rounded-xl p-5 shadow-2xl border border-white/10 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-sm text-gray-200 mb-4 text-center">确认导出高清全景图？</div>
            <div className="text-[10px] text-gray-500 mb-4 text-center">将渲染 4K 分辨率海报级图片，可能需要几秒钟</div>
            <div className="flex gap-2">
              <button onClick={handleExportPanorama}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-cyan/20 text-cyan border border-cyan/20 hover:bg-cyan/30 transition-all">
                确认
              </button>
              <button onClick={() => setConfirmPanorama(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-white/5 text-gray-400 hover:text-gray-300 border border-white/5 hover:bg-white/10 transition-all">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Material Quantity Modal ── */}
      {showQuantity && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setShowQuantity(false)}>
          <div className="glass-strong rounded-xl p-5 shadow-2xl border border-white/10 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Ruler size={14} className="text-emerald-400" />
                <span className="text-sm font-medium text-gray-200">材料工程量</span>
              </div>
              <button onClick={() => setShowQuantity(false)}
                className="text-gray-500 hover:text-white transition-colors">&times;</button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2.5 rounded-lg bg-white/[0.03]">
                <div className="text-lg font-bold text-emerald-400">{quantityData.total.toFixed(1)}</div>
                <div className="text-[10px] text-gray-500">总重 (t)</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-white/[0.03]">
                <div className="text-lg font-bold text-white">{totalElements}</div>
                <div className="text-[10px] text-gray-500">总构件数</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-white/[0.03]">
                <div className="text-lg font-bold text-cyan-400">{String(params.material || 'Q355')}</div>
                <div className="text-[10px] text-gray-500">材料等级</div>
              </div>
            </div>
            <table className="w-full text-[11px] mb-3">
              <thead>
                <tr className="text-gray-500 border-b border-white/5">
                  <th className="text-left py-1.5 font-medium">类型</th>
                  <th className="text-right py-1.5 font-medium">数量</th>
                  <th className="text-right py-1.5 font-medium">总长 (m)</th>
                  <th className="text-right py-1.5 font-medium">重量 (t)</th>
                </tr>
              </thead>
              <tbody>
                {quantityData.details.map((d, i) => (
                  <tr key={i} className="border-b border-white/[0.02]">
                    <td className="py-1.5 text-gray-300">{d.label}</td>
                    <td className="py-1.5 text-right text-gray-400 font-mono">{d.count}</td>
                    <td className="py-1.5 text-right text-gray-400 font-mono">{d.totalLen.toFixed(1)}</td>
                    <td className="py-1.5 text-right text-white font-mono">{d.totalW.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[10px] text-gray-500 mb-3">
              {quantityData.bySection.map((s, i) => (
                <div key={i} className="flex justify-between py-0.5">
                  <span>{s.section}</span>
                  <span className="font-mono">{s.weight.toFixed(2)} t</span>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-gray-600 border-t border-white/5 pt-2">
              注：重量按截面面积 × 长度 × 密度 (7850 kg/m³) 估算，不含节点板、螺栓等连接件。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
