import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  Camera, RefreshCw, Maximize2, Minimize2,
  Eye, SunMoon, Scissors, GripVertical, Download, FileDown,
} from 'lucide-react';
import { exportModelToDesktop } from '../utils/exportDesktop';

type TabKey = 'display' | 'view' | 'tools' | 'scene';

export default function SceneToolbar() {
  const {
    displayMode, setDisplayMode, showColorMap, setShowColorMap,
    showLoads, setShowLoads, showGrid, setShowGrid,
    showShadows, setShowShadows, autoRotate, setAutoRotate,
    isOrthographic, setIsOrthographic,
    sectionPlane, setSectionPlane, explodeFactor, setExplodeFactor,
  } = useStore();

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmScreenshot, setConfirmScreenshot] = useState(false);
  const [confirmExport, setConfirmExport] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleExportDesktop = () => {
    setConfirmExport(false);
    exportModelToDesktop();
    setToast('模型项目已导出！');
  };

  // Find the Three canvas for screenshot
  const captureScreenshot = () => {
    const c = document.querySelector('canvas');
    if (!c) return;
    const link = document.createElement('a');
    link.download = `caiao-model-${Date.now()}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
    setToast('截图已保存！');
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'display', label: '显示', icon: <Eye size={14} /> },
    { key: 'view', label: '视角', icon: <Camera size={14} /> },
    { key: 'tools', label: '工具', icon: <Scissors size={14} /> },
    { key: 'scene', label: '场景', icon: <SunMoon size={14} /> },
  ];

  return (
    <>
      {/* Main toolbar strip */}
      <div className="flex gap-1">
        {/* Tab buttons */}
        <div className="glass-strong rounded-xl p-1 flex flex-col gap-0.5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(activeTab === t.key ? null : t.key)}
              className={`p-2 rounded-lg transition-all ${activeTab === t.key ? 'bg-cyan/15 text-cyan' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title={t.label}>
              {t.icon}
            </button>
          ))}
          <div className="w-full h-px bg-white/5 my-0.5" />
          <button onClick={() => setConfirmScreenshot(true)} className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5" title="截图">
            <Download size={14} />
          </button>
          <button onClick={() => setConfirmExport(true)} className="p-2 rounded-lg text-gray-500 hover:text-cyan hover:bg-cyan/10" title="导出模型项目文件">
            <FileDown size={14} />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5" title="全屏">
            {document.fullscreenElement ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {/* Active tab panel */}
        {activeTab && (
          <div className="glass-strong rounded-xl p-3 min-w-[180px] shadow-2xl border border-white/5">
            {activeTab === 'display' && (
              <div className="space-y-2.5">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">显示模式</div>
                <div className="flex gap-1">
                  {(['shaded', 'wireframe', 'xray'] as const).map(m => (
                    <button key={m} onClick={() => setDisplayMode(m)}
                      className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${
                        displayMode === m ? 'bg-cyan/15 text-cyan border border-cyan/20' : 'text-gray-500 hover:text-gray-300 bg-white/5'
                      }`}>
                      {m === 'shaded' ? '着色' : m === 'wireframe' ? '线框' : '透视'}
                    </button>
                  ))}
                </div>
                <div className="w-full h-px bg-white/5" />
                <ToggleRow label="颜色映射" active={showColorMap} onChange={setShowColorMap} />
                <ToggleRow label="荷载显示" active={showLoads} onChange={setShowLoads} />
              </div>
            )}

            {activeTab === 'view' && (
              <div className="space-y-2.5">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">快捷视角</div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: '俯视', angle: 'top' },
                    { label: '正面', angle: 'front' },
                    { label: '侧面', angle: 'side' },
                  ].map(v => (
                    <button key={v.angle} onClick={() => setViewAngle(v.angle)}
                      className="py-1.5 rounded text-[10px] text-gray-500 hover:text-gray-300 bg-white/5 hover:bg-white/10 transition-all">
                      {v.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setViewAngle('reset')}
                  className="w-full py-1.5 rounded text-[10px] text-gray-500 hover:text-gray-300 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-1.5">
                  <RefreshCw size={12} /> 重置视角
                </button>
                <div className="w-full h-px bg-white/5" />
                <ToggleRow label="正交投影" active={isOrthographic} onChange={setIsOrthographic} />
                <ToggleRow label="自动旋转" active={autoRotate} onChange={setAutoRotate} />
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[9px] text-gray-500 mb-1.5">
                    <span>剖面切割</span><span>{sectionPlane > 0 ? `${Math.round(sectionPlane * 100)}%` : '关闭'}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.01" value={sectionPlane}
                    onChange={e => setSectionPlane(Number(e.target.value))}
                    className="w-full accent-cyan h-1" />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-500 mb-1.5">
                    <span>爆炸视图</span><span>{explodeFactor > 0 ? `${Math.round(explodeFactor * 100)}%` : '关闭'}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.01" value={explodeFactor}
                    onChange={e => setExplodeFactor(Number(e.target.value))}
                    className="w-full accent-cyan h-1" />
                </div>
              </div>
            )}

            {activeTab === 'scene' && (
              <div className="space-y-2.5">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">场景控制</div>
                <ToggleRow label="网格" active={showGrid} onChange={setShowGrid} />
                <ToggleRow label="阴影" active={showShadows} onChange={setShowShadows} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screenshot confirmation dialog */}
      {confirmScreenshot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setConfirmScreenshot(false)}>
          <div className="glass-strong rounded-xl p-5 shadow-2xl border border-white/10 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-sm text-gray-200 mb-4 text-center">确认导出当前模型视图截图？</div>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmScreenshot(false); captureScreenshot(); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-cyan/20 text-cyan border border-cyan/20 hover:bg-cyan/30 transition-all">
                确认
              </button>
              <button onClick={() => setConfirmScreenshot(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-white/5 text-gray-400 hover:text-gray-300 border border-white/5 hover:bg-white/10 transition-all">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {/* JSON export confirmation dialog */}
      {confirmExport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setConfirmExport(false)}>
          <div className="glass-strong rounded-xl p-5 shadow-2xl border border-white/10 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-sm text-gray-200 mb-4 text-center">确认导出模型项目文件？</div>
            <div className="text-[10px] text-gray-500 mb-4 text-center">将导出为 .caiao.json 格式，包含完整模型数据</div>
            <div className="flex gap-2">
              <button onClick={handleExportDesktop}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-cyan/20 text-cyan border border-cyan/20 hover:bg-cyan/30 transition-all">
                确认
              </button>
              <button onClick={() => setConfirmExport(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-white/5 text-gray-400 hover:text-gray-300 border border-white/5 hover:bg-white/10 transition-all">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
          <div className="glass-strong rounded-lg px-4 py-2 text-xs text-cyan shadow-2xl border border-cyan/20">
            {toast}
          </div>
        </div>
      )}

      {/* Explode/Section quick indicators when active */}
      {(sectionPlane > 0 || explodeFactor > 0) && (
        <div className="fixed top-52 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {sectionPlane > 0 && (
            <div className="glass-strong rounded-lg px-3 py-1.5 text-[10px] text-cyan/70 flex items-center gap-1.5">
              <Scissors size={12} /> 剖面 {Math.round(sectionPlane * 100)}%
            </div>
          )}
          {explodeFactor > 0 && (
            <div className="glass-strong rounded-lg px-3 py-1.5 text-[10px] text-purple/70 flex items-center gap-1.5">
              <GripVertical size={12} /> 爆炸 {Math.round(explodeFactor * 100)}%
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ToggleRow({ label, active, onChange }: { label: string; active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!active)}
      className="w-full flex items-center justify-between py-1 px-1.5 rounded hover:bg-white/5 transition-all">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className={`w-7 h-3.5 rounded-full transition-all relative ${active ? 'bg-cyan/40' : 'bg-white/10'}`}>
        <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${active ? 'left-4' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

// View angle setter (uses store camera state)
function setViewAngle(angle: string) {
  // Dispatch custom event for ThreeCanvas to listen
  window.dispatchEvent(new CustomEvent('caiao-set-view', { detail: angle }));
}

// ── View Cube ──────────────────────────────────────────────────
export function ViewCube() {
  const setView = (angle: string) => setViewAngle(angle);
  return (
    <div className="glass-strong rounded-lg p-1.5 shadow-2xl">
      <div className="grid grid-cols-3 gap-0.5">
        {[
          { l: 'T', a: 'top', title: '俯视' },
          { l: '', a: '', title: '' },
          { l: 'F', a: 'front', title: '正面' },
          { l: '', a: '', title: '' },
          { l: 'R', a: 'side', title: '右侧' },
          { l: '', a: '', title: '' },
          { l: 'B', a: 'bottom', title: '仰视' },
          { l: '', a: '', title: '' },
          { l: 'Back', a: 'back', title: '背面' },
        ].map((v, i) => (
          v.a ? (
            <button key={i} onClick={() => setView(v.a)}
              className="w-6 h-6 rounded text-[8px] font-mono text-gray-500 hover:text-cyan hover:bg-cyan/10 transition-all"
              title={v.title}>
              {v.l}
            </button>
          ) : <div key={i} className="w-6 h-6" />
        ))}
      </div>
    </div>
  );
}
