import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import gsap from 'gsap';
import type { StepType } from '../store/useStore';

const PIPELINE_NODES: { id: StepType; label: string; icon: string; color: string }[] = [
  { id: 'modeling', label: '模型生成', icon: '🏗️', color: '#00D4FF' },
  { id: 'loads', label: '荷载施加', icon: '⚡', color: '#7B2FBE' },
  { id: 'analysis', label: '有限元分析', icon: '📊', color: '#00D4FF' },
  { id: 'check', label: '规范校核', icon: '✓', color: '#7B2FBE' },
  { id: 'report', label: '报告生成', icon: '📄', color: '#00D4FF' },
];

interface Props {
  onStepClick?: (step: StepType) => void;
}

export default function PipelineFlow({ onStepClick }: Props) {
  const { currentStep, pipelineProgress } = useStore();
  const nodesRef = useRef<(HTMLDivElement | null)[]>([]);

  const currentIdx = PIPELINE_NODES.findIndex(n => n.id === currentStep);

  // GSAP highlight animations
  useEffect(() => {
    nodesRef.current.forEach((el, i) => {
      if (!el) return;
      const isActive = i === currentIdx;
      const isPast = i < currentIdx;

      gsap.to(el, {
        scale: isActive ? 1.15 : 1,
        borderColor: isActive ? PIPELINE_NODES[i].color : isPast ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)',
        backgroundColor: isActive ? `${PIPELINE_NODES[i].color}20` : isPast ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
        boxShadow: isActive ? `0 0 30px ${PIPELINE_NODES[i].color}40` : 'none',
        duration: 0.6,
        ease: 'power2.out',
      });
    });
  }, [currentIdx]);

  const handleClick = (nodeId: StepType, idx: number) => {
    // 只有已执行过的节点可直接跳转，未执行的必须按步骤顺序
    if (idx < currentIdx && onStepClick) {
      onStepClick(nodeId);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center px-8">
      <div className="flex items-center gap-0 w-full max-w-4xl">
        {PIPELINE_NODES.map((node, i) => {
          const isActive = i === currentIdx;
          const isPast = i < currentIdx;

          return (
            <div key={node.id} className="flex items-center flex-1">
              {/* Node */}
              <div
                ref={el => { nodesRef.current[i] = el; }}
                onClick={() => handleClick(node.id, i)}
                className={`
                  relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl transition-all duration-500
                  ${isActive ? 'opacity-100' : isPast ? 'opacity-60 cursor-pointer hover:brightness-125' : 'opacity-35 cursor-not-allowed'}
                `}
                style={{
                  border: `1px solid ${isActive ? node.color : isPast ? 'rgba(0,212,255,0.3)' : 'rgba(0,212,255,0.12)'}`,
                  background: isActive ? `${node.color}15` : isPast ? 'rgba(0,212,255,0.05)' : 'rgba(0,212,255,0.02)',
                }}
                title={isActive ? '' : `跳转至 ${node.label}`}
              >
                {/* Pulse ring for active */}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl animate-ping opacity-20"
                    style={{ border: `2px solid ${node.color}` }} />
                )}
                {/* Check mark overlay on past */}
                {isPast && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan flex items-center justify-center shadow-lg shadow-cyan/30">
                    <span className="text-[10px] font-bold text-black">✓</span>
                  </div>
                )}
                <span className="text-xl">{node.icon}</span>
                <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                  {node.label}
                </span>
                {isActive && pipelineProgress > 0 && (
                  <div className="w-12 h-1 rounded-full bg-gray-700 overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pipelineProgress}%`, background: node.color }}
                    />
                  </div>
                )}
              </div>

              {/* Connector arrow */}
              {i < PIPELINE_NODES.length - 1 && (
                <div className="flex-1 flex items-center justify-center relative h-0.5 mx-1">
                  <div className={`w-full h-0.5 rounded-full transition-all duration-700 ${
                    i < currentIdx ? 'bg-gradient-to-r from-cyan to-purple' : 'bg-white/5'
                  }`}>
                    {/* Flow particles */}
                    {i < currentIdx && (
                      <div className="absolute inset-0 overflow-hidden">
                        {[...Array(3)].map((_, p) => (
                          <div
                            key={p}
                            className="absolute w-1.5 h-1.5 rounded-full bg-cyan"
                            style={{
                              animation: `flowParticle 1.5s linear ${p * 0.5}s infinite`,
                              top: '-2px',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
