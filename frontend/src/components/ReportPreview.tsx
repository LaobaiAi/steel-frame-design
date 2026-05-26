import { useState } from 'react';
import { useStore } from '../store/useStore';
import { FileText, Maximize2, Minimize2, Image, Loader, X, ChevronDown, ChevronUp } from 'lucide-react';
import { exportPanoramaFromStore } from '../utils/exportPanorama';

export default function ReportPreview() {
  const { reportUrl, codeCheckResults, analysisResults, engineeringParams, selectedElement, setSelectedElement } = useStore();
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmPanorama, setConfirmPanorama] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const check = (codeCheckResults ?? {}) as Record<string, any>;
  const summary = check?.summary ?? {};
  const elements = (check?.elements ?? []) as any[];
  const analysis = (analysisResults ?? {}) as Record<string, any>;
  const params = (engineeringParams ?? {}) as Record<string, any>;

  const totalElements = summary.total_elements ?? elements.length ?? 0;
  const passed = summary.passed ?? 0;
  const failed = summary.failed ?? 0;
  const maxStress = summary.max_stress_ratio ?? '-';
  const maxDeflection = summary.max_deflection_ratio ?? '-';
  const maxDisp = analysis?.max_displacement ?? analysis?.summary?.max_displacement ?? '-';

  const passRate = totalElements > 0 ? ((passed / totalElements) * 100).toFixed(1) : '0';

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

  const width = fullscreen ? '90vw' : '500px';
  const height = fullscreen ? '85vh' : (collapsed ? 'auto' : '70vh');

  return (
    <div
      className="glass-strong rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
      style={{ width, height, minWidth: 380 }}
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
          {reportUrl ? (
            <iframe src={reportUrl} className="w-full h-full border-0" title="报告预览" />
          ) : totalElements > 0 ? (
            /* Data-driven report from store */
            <div className="p-5 space-y-4 text-xs">
              {/* Project info */}
              <div className="glass rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-200 mb-2">项目信息</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between"><span className="text-gray-500">项目名称</span><span className="text-white">{params.name || '钢框架'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">材料</span><span className="text-white">{params.material || 'Q355'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">柱截面</span><span className="text-white font-mono text-[11px]">{params.column_section || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">梁截面</span><span className="text-white font-mono text-[11px]">{params.beam_section || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">层数</span><span className="text-white">{params.num_stories || '-'}</span></div>
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
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
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
                        {elements.map((el: any, i: number) => {
                          const stressOk = (el.stress_ratio ?? 0) <= 1;
                          const stabilityOk = (el.stability_ratio ?? 0) <= 1;
                          const deflectionOk = (el.deflection_ratio ?? 0) <= 1;
                          const allOk = stressOk && stabilityOk && deflectionOk;
                          const isSelected = selectedElement === (el.id ?? i + 1);
                          return (
                            <tr
                              key={el.id ?? i}
                              onClick={() => setSelectedElement(isSelected ? null : (el.id ?? i + 1))}
                              className={`border-b border-white/[0.02] cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-cyan/20 hover:bg-cyan/25'
                                  : 'hover:bg-white/[0.03]'
                              }`}
                            >
                              <td className="py-1.5 pr-2 text-white font-mono">{el.id ?? i + 1}</td>
                              <td className="py-1.5 pr-2 text-gray-400 font-mono">{el.story ?? '-'}</td>
                              <td className="py-1.5 pr-2 text-gray-400">{el.type || el.element_type || '-'}</td>
                              <td className={`py-1.5 pr-2 text-right font-mono ${stressOk ? 'text-green-400' : 'text-red-400'}`}>{(el.stress_ratio ?? 0).toFixed(3)}</td>
                              <td className={`py-1.5 pr-2 text-right font-mono ${stabilityOk ? 'text-green-400' : 'text-red-400'}`}>{(el.stability_ratio ?? 0).toFixed(3)}</td>
                              <td className={`py-1.5 pr-2 text-right font-mono ${deflectionOk ? 'text-green-400' : 'text-red-400'}`}>{(el.deflection_ratio ?? 0).toFixed(3)}</td>
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
                  <div className="flex justify-between"><span className="text-gray-500">项目名称</span><span className="text-white">{params.name || '钢框架'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">材料</span><span className="text-white">{params.material || 'Q355'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">柱截面</span><span className="text-white font-mono text-[11px]">{params.column_section || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">梁截面</span><span className="text-white font-mono text-[11px]">{params.beam_section || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">层数</span><span className="text-white">{params.num_stories || '-'}</span></div>
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
    </div>
  );
}
