import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  ArrowRight, ChevronDown, Layers,
  Cpu, FileText, ShieldCheck, GitBranch,
  Menu, X, Terminal
} from 'lucide-react';

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const BG = '#0a0b0d';
const BG2 = '#121314';
const GREEN = '#32f08c';
const GRADIENT_BG = 'linear-gradient(90deg, rgba(62,225,163,0.16), rgba(50,240,140,0.16) 36%, rgba(96,242,189,0.16) 71.63%, rgba(160,253,231,0.16))';

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm"
      style={{ background: GRADIENT_BG }}>
      <span className="text-xs font-mono font-medium text-gradient-brand">{children}</span>
    </div>
  );
}

// ── Header ──
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setStep } = useStore();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { label: '产品', href: '#features' },
    { label: '架构', href: '#architecture' },
    { label: '快速开始', href: '#get-started' },
    { label: '文档', href: 'https://github.com/LaobaiAi/steel-frame-design', external: true },
  ];

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300`}
        style={{ height: 64, background: scrolled ? 'rgba(10,11,13,0.92)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <div className="mx-auto flex items-center justify-between h-full px-4 md:px-8" style={{ maxWidth: 1600 }}>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 text-white font-semibold text-lg">
            <span className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold" style={{ background: GREEN, color: BG }}>X</span>
            <span className="tracking-tight">XuanwuAI</span>
          </button>

          <nav className="hidden lg:flex items-center gap-0.5">
            {navItems.map(item => (
              <a key={item.label} href={item.href}
                className="px-4 py-2 text-sm text-[#a6aab5] hover:text-[#f5f9fe] transition-colors rounded-md hover:bg-white/5"
                {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={() => { setStep('input'); window.scrollTo(0, 0); }}
              className="hidden sm:flex btn-brand text-sm px-5 h-9 items-center gap-2">
              开始使用 <ArrowRight size={14} />
            </button>
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-[#a6aab5] hover:text-[#f5f9fe]">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-50 lg:hidden" style={{ background: BG }}>
          <div className="flex flex-col p-4 gap-1">
            {navItems.map(item => (
              <a key={item.label} href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center h-12 px-3 text-[#a6aab5] hover:text-[#f5f9fe] text-base font-medium rounded-md hover:bg-white/5">
                {item.label}
              </a>
            ))}
            <div className="border-t border-white/10 my-4" />
            <button onClick={() => { setStep('input'); window.scrollTo(0, 0); setMobileOpen(false); }}
              className="btn-brand text-sm h-11 mt-2">
              开始使用 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Hero ──
function Hero() {
  const { setStep } = useStore();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount animation
  useEffect(() => { setMounted(true); }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center overflow-hidden pt-32 md:pt-40" style={{ background: BG2 }}>
      {/* Glow */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.15]"
        style={{ background: 'radial-gradient(circle, rgba(50,240,140,0.4) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-5xl mx-auto">
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s ease-out' }}>
          <Tag>AI · 钢结构工程</Tag>
        </div>

        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s ease-out 0.15s' }}>
          <h1 className="mt-6 text-[56px] leading-[1.1] md:text-[72px] lg:text-[80px] font-semibold tracking-tight text-[#f5f9fe]">
            <div className="flex flex-wrap justify-center gap-x-4">
              <span className="text-gradient-brand">渊默之算</span>
            </div>
            <div className="text-3xl md:text-4xl lg:text-5xl mt-2 text-[#a6aab5] font-medium">
              Abyssal Computation
            </div>
          </h1>
        </div>

        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s ease-out 0.3s' }}>
          <p className="mt-6 text-lg md:text-xl text-[#a6aab5] max-w-xl font-medium">
            AI 驱动的参数化钢框架设计全流程管线
          </p>
          <p className="mt-2 text-sm md:text-base text-[#787d87] font-mono">
            YAML → 框架生成 → 荷载施加 → FEA → GB50017 验算 → 报告
          </p>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s ease-out 0.45s' }}>
          <button onClick={() => { setStep('input'); window.scrollTo(0, 0); }}
            className="btn-brand text-base px-8 py-4 h-auto">
            在线体验 <ArrowRight size={18} className="ml-2 inline" />
          </button>
          <a href="#features"
            className="btn-secondary text-base px-8 py-4 h-auto inline-flex items-center justify-center">
            功能特性
          </a>
          <a href="https://github.com/LaobaiAi/steel-frame-design" target="_blank" rel="noopener noreferrer"
            className="btn-ghost text-base px-6 py-4 h-auto inline-flex items-center justify-center gap-2">
            <GithubIcon size={18} /> GitHub
          </a>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2"
        style={{ opacity: mounted ? 1 : 0, transition: 'all 0.6s ease-out 0.8s' }}>
        <ChevronDown size={20} className="text-[#787d87] animate-bounce" />
      </div>

    </section>
  );
}

// ── Creator Profile ──
function CreatorProfile() {
  const repos = [
    { name: 'Iron-Fall', desc: 'AI 驱动、力学严谨、实时交互的智能拆除推演系统 — 连接静态设计与动态物理', lang: 'Python', url: 'https://github.com/LaobaiAi/Iron-Fall' },
    { name: 'Demolition-Simulator', desc: '通过自然语言驱动的智能拆除仿真演示系统', lang: 'TypeScript', url: 'https://github.com/LaobaiAi/Demolition-Simulator' },
    { name: 'LLM-BXB-guide', desc: '从零开始手搓 AI 朋友白小白 — 构建个人 AI 助手的完整指南', lang: 'Python', url: 'https://github.com/LaobaiAi/LLM-BXB-guide' },
    { name: 'structureclaw', desc: '结构边界条件定义工具 — 服务于结构工程的智能荷载与约束配置', lang: 'TypeScript', url: 'https://github.com/LaobaiAi/structureclaw' },
  ];

  return (
    <section className="py-24 md:py-32 px-4 md:px-8" style={{ background: BG }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        {/* Section header */}
        <div className="text-center mb-16">
          <Tag>创作者简介</Tag>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold text-[#f5f9fe]">CAIAO     蔡翱</h2>
          <p className="mt-3 text-base md:text-lg text-[#a6aab5] max-w-xl mx-auto">
            一级注册建筑师 · 一级注册结构工程师
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-8 md:gap-12">
          {/* Avatar + bio — left column */}
          <div className="md:col-span-2 flex flex-col items-center md:items-start text-center md:text-left h-full">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden mb-5 ring-2"
              style={{ borderColor: GREEN, boxShadow: `0 0 20px rgba(50,240,140,0.15)` }}>
              <img src="https://avatars.githubusercontent.com/u/270031169?v=4" alt="CAIAO 蔡翱"
                className="w-full h-full object-cover" />
            </div>
            <h3 className="text-2xl md:text-3xl font-semibold text-[#f5f9fe]">LaobaiAi</h3>
            <p className="mt-3 text-sm text-[#a6aab5] leading-relaxed max-w-sm">
              老白路漫漫，上下而求索。<br />
              从建筑到结构，从工程到代码，<br />
              致力于用 AI 重塑传统工程行业的每一寸土壤。
            </p>
            <div className="mt-auto grid grid-cols-2 gap-3 w-full max-w-xs pt-8">
              <div className="p-3 rounded-sm text-center" style={{ background: 'rgba(237,239,242,0.04)' }}>
                <div className="text-lg font-semibold text-gradient-brand font-mono">6+</div>
                <div className="text-xs text-[#787d87] mt-0.5">项目</div>
              </div>
              <a href="https://github.com/LaobaiAi" target="_blank" rel="noopener noreferrer"
                className="p-3 rounded-sm text-center flex flex-col items-center justify-center gap-1 transition-all hover:brightness-125"
                style={{ background: 'rgba(237,239,242,0.04)' }}>
                <GithubIcon size={20} />
                <span className="text-xs text-[#787d87]">GitHub</span>
              </a>
              <div className="p-3 rounded-sm text-center" style={{ background: 'rgba(237,239,242,0.04)' }}>
                <div className="text-lg font-semibold text-gradient-brand font-mono">渊默之算</div>
                <div className="text-xs text-[#787d87] mt-0.5">哲学</div>
              </div>
              <div className="p-3 rounded-sm text-center" style={{ background: 'rgba(237,239,242,0.04)' }}>
                <div className="text-lg font-semibold text-gradient-brand font-mono">建筑·结构</div>
                <div className="text-xs text-[#787d87] mt-0.5">领域</div>
              </div>
            </div>
          </div>

          {/* Repo showcase — right column */}
          <div className="md:col-span-3 flex flex-col h-full min-w-0">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full" style={{ background: GREEN }} />
              <span className="text-sm font-semibold text-[#f5f9fe]">代表性项目</span>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(50,240,140,0.2), transparent)' }} />
            </div>

            <div className="flex-1 flex flex-col justify-between gap-3">
              {repos.map((repo, i) => (
                <a key={i} href={repo.url} target="_blank" rel="noopener noreferrer"
                  className="group flex items-stretch gap-0 rounded-sm overflow-hidden transition-all hover:brightness-125"
                  style={{ background: 'rgba(237,239,242,0.04)' }}>
                  {/* Left accent bar */}
                  <div className="w-0.5 shrink-0 transition-all group-hover:w-1" style={{ background: GREEN }} />
                  <div className="flex items-center gap-4 p-4 md:p-5 flex-1 min-w-0">
                    <span className="text-lg font-mono font-semibold text-gradient-brand shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-[#f5f9fe] group-hover:text-gradient-brand transition-colors">
                          {repo.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0"
                          style={{
                            background: 'rgba(50,240,140,0.1)',
                            color: GREEN,
                          }}>
                          {repo.lang}
                        </span>
                      </div>
                      <p className="text-xs text-[#a6aab5] leading-relaxed line-clamp-2">
                        {repo.desc}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


// ── Value Cards ──
function ValueCards() {
  const cards = [
    { value: 'YAML → 报告', label: '全流程自动化', desc: '从参数文件到完整设计报告，一键完成' },
    { value: 'GB 50017', label: '规范内置校验', desc: '强度、稳定、长细比、挠度全项自动验算' },
    { value: '3D 可视化', label: '实时三维预览', desc: 'Three.js 驱动的钢结构空间交互浏览' },
    { value: 'AI 辅助', label: 'LLM 参数提取', desc: '自然语言描述需求，AI 自动生成设计参数' },
  ];
  return (
    <section className="py-16 md:py-20 px-4 md:px-8" style={{ background: BG }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((c, i) => (
            <div key={i} className="p-5 rounded-sm text-center transition-all hover:brightness-125"
              style={{ background: 'rgba(237,239,242,0.04)' }}>
              <div className="text-lg md:text-xl font-semibold text-gradient-brand font-mono mb-1">{c.value}</div>
              <div className="text-sm text-[#f5f9fe] mb-1">{c.label}</div>
              <div className="text-xs text-[#787d87]">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Feature Showcase (cards with icons, like trae.cn's value section) ──
function FeatureShowcase() {
  const features = [
    {
      icon: <Terminal size={28} />,
      title: '一键运行',
      desc: '一条命令，从 YAML 到完整报告。内置 7 种 H 型钢、Q235/Q355 材料、自动荷载推导。',
    },
    {
      icon: <Cpu size={28} />,
      title: '矩阵位移法',
      desc: '3D 梁单元刚度求解器，底部剪力法计算地震作用，稳定系数按 GB50017 a 类曲线。',
    },
    {
      icon: <ShieldCheck size={28} />,
      title: '规范校核',
      desc: '逐单元强度、稳定性、长细比和挠度校验，输出详细应力比和通过/警告/超限判定。',
    },
    {
      icon: <FileText size={28} />,
      title: 'HTML 报告',
      desc: 'Jinja2 渲染的专业报告，含模型概览、验算汇总表、关键指标，可直接打印或分享。',
    },
    {
      icon: <GitBranch size={28} />,
      title: 'CAIAO 原子架构',
      desc: '语言无关、即插即用。每个 Server 独立运行，崩溃不级联，Schema 校验保证契约。',
    },
    {
      icon: <Layers size={28} />,
      title: 'LLM 就绪',
      desc: '完整 @tool 元数据、Stdio-Loop 就绪。LLM Agent 可直接调用每个原子 Server。',
    },
  ];

  return (
    <section id="features" className="py-24 md:py-32 px-4 md:px-8" style={{ background: BG }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div className="text-center mb-16">
          <Tag>功能特性</Tag>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold text-[#f5f9fe]">为工程师打造</h2>
          <p className="mt-3 text-base md:text-lg text-[#a6aab5] max-w-xl mx-auto">
            从参数建模到规范验算，覆盖钢结构设计全流程
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div key={i}
              className="flex flex-col p-6 rounded-sm transition-all hover:brightness-125"
              style={{ background: 'rgba(237,239,242,0.04)' }}>
              <div className="mb-3.5" style={{ color: GREEN }}>{f.icon}</div>
              <h3 className="text-base font-semibold text-[#f5f9fe] mb-2">{f.title}</h3>
              <p className="text-sm text-[#a6aab5] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Architecture / Pipeline ──
function Architecture() {
  const steps = [
    { num: '01', label: '框架生成', sub: 'Frame Gen' },
    { num: '02', label: '荷载生成', sub: 'Load Gen' },
    { num: '03', label: '有限元分析', sub: 'FEA' },
    { num: '04', label: '规范验算', sub: 'GB50017' },
    { num: '05', label: '报告生成', sub: 'Report' },
  ];

  const principles = [
    { title: '原子性', desc: '单一职责，每个 Server 只做一件事' },
    { title: '契约驱动', desc: '统一 list_tools / call_tool，JSON Schema 校验' },
    { title: '合并非修改', desc: 'Pipeline Server 仅编排，不嵌入领域逻辑' },
    { title: 'AI 原生', desc: '工具描述和 Schema 完整，LLM Agent 可直接调用' },
  ];

  return (
    <section id="architecture" className="py-24 md:py-32 px-4 md:px-8" style={{ background: BG2 }}>
      <div className="mx-auto text-center" style={{ maxWidth: 1200 }}>
        <Tag>管线架构</Tag>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold text-[#f5f9fe]">CAIAO 原子管线</h2>
        <p className="mt-3 text-base md:text-lg text-[#a6aab5] max-w-xl mx-auto">
          五个原子 Server 串联，覆盖结构设计全流程
        </p>

        <div className="mt-16 flex flex-wrap justify-center gap-6 md:gap-0">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, rgba(50,240,140,0.12), rgba(50,240,140,0.04))`,
                    border: '1px solid rgba(50,240,140,0.25)',
                  }}>
                  <span className="text-2xl md:text-3xl font-semibold text-gradient-brand font-mono">{s.num}</span>
                </div>
                <span className="mt-3 text-sm font-semibold text-[#f5f9fe]">{s.label}</span>
                <span className="text-xs text-[#787d87] font-mono mt-0.5">{s.sub}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:flex items-center mx-3">
                  <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, rgba(50,240,140,0.3), transparent)' }} />
                  <ArrowRight size={12} className="text-[#32f08c]/30 -ml-2" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {principles.map((p, i) => (
            <div key={i} className="p-4 rounded-sm text-left"
              style={{ background: 'rgba(237,239,242,0.04)' }}>
              <div className="text-[#f5f9fe] text-sm font-semibold mb-1">{p.title}</div>
              <div className="text-[#787d87] text-xs leading-relaxed">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Xuanwu Brand ──
function BrandStory() {
  const symbols = [
    { name: 'QinglongAI', cn: '青龙', el: '木', virtue: '创生之智 · Generative Creation', desc: '生成式 AI，创造智能' },
    { name: 'ZhuqueAI', cn: '朱雀', el: '火', virtue: '燎原之火 · Connective Flame', desc: '智能交互，人机体验' },
    { name: 'BaihuAI', cn: '白虎', el: '金', virtue: '肃金之盾 · Purifying Shield', desc: 'AI 原生安全，对抗防御' },
    { name: 'XuanwuAI', cn: '玄武', el: '水', virtue: '渊默之算 · Abyssal Computation', desc: '复杂仿真，策略决策', active: true },
  ];

  return (
    <section className="py-24 md:py-32 px-4 md:px-8" style={{ background: BG }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div className="grid md:grid-cols-5 gap-12 md:gap-16">
          <div className="md:col-span-2">
            <Tag>品牌哲学</Tag>
            <h2 className="mt-4 text-3xl md:text-4xl font-semibold text-[#f5f9fe] leading-tight">
              玄武 · 渊默之算
            </h2>
            <p className="mt-4 text-[#a6aab5] text-base leading-relaxed">
              玄武，中国神话中的北方之神，是<strong className="text-[#f5f9fe]">龟与蛇</strong>的神圣合体 —
              极致稳定与灵活智能的完美化身。
            </p>
            <div className="mt-6 space-y-3">
              {[
                { icon: '🛡️', title: '龟（护盾）', desc: '绝对防御、秩序与不可动摇的基础 — 坚如磐石的物理引擎内核和精确规则系统' },
                { icon: '🐍', title: '蛇（Python）', desc: '灵动、智慧与精准执行 — 高层 AI 算法在复杂环境中自主规划、适应并制定最优策略' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-4 rounded-sm"
                  style={{ background: 'rgba(237,239,242,0.04)' }}>
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-[#f5f9fe]">{item.title}</div>
                    <div className="text-xs text-[#787d87] mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <Tag>四象 AI 家族</Tag>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {symbols.map((s, i) => (
                <div key={i} className={`p-4 md:p-5 rounded-sm transition-all ${s.active ? 'ring-1' : ''}`}
                  style={{
                    background: s.active ? 'rgba(50,240,140,0.08)' : 'rgba(237,239,242,0.04)',
                    borderColor: s.active ? GREEN : 'transparent',
                  }}>
                  <div className="text-xl mb-2">{s.el === '木' ? '🌳' : s.el === '火' ? '🔥' : s.el === '金' ? '⚔️' : '💧'}</div>
                  <div className={`text-sm font-semibold ${s.active ? 'text-[#32f08c]' : 'text-[#f5f9fe]'}`}>{s.name}</div>
                  <div className="text-xs text-[#a6aab5] mt-0.5">{s.cn} · {s.virtue}</div>
                  <div className="text-xs text-[#787d87] mt-1">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Get Started ──
function GetStarted() {
  const { setStep } = useStore();

  return (
    <section id="get-started" className="py-24 md:py-32 px-4 md:px-8" style={{ background: BG2 }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
          <div>
            <Tag>快速开始</Tag>
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold text-[#f5f9fe] leading-tight">
              一条命令，<br />
              <span className="text-gradient-brand">端到端</span>
            </h2>
            <p className="mt-4 text-base text-[#a6aab5] max-w-sm">
              只需 Python 3.10+ 环境，一行命令即可运行完整钢结构设计管线。
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button onClick={() => { setStep('input'); window.scrollTo(0, 0); }}
                className="btn-brand text-base px-8 py-4 h-auto w-fit">
                在线体验 <ArrowRight size={18} className="ml-2 inline" />
              </button>
              <a href="https://github.com/LaobaiAi/steel-frame-design" target="_blank" rel="noopener noreferrer"
                className="text-sm text-[#a6aab5] hover:text-[#f5f9fe] transition-colors flex items-center gap-2 w-fit">
                <GithubIcon size={16} /> 查看源码
              </a>
            </div>
          </div>

          <div className="rounded-sm overflow-hidden"
            style={{ background: 'rgba(237,239,242,0.04)' }}>
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
              <span className="w-3 h-3 rounded-full bg-red-500/50" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <span className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="text-xs text-[#787d87] ml-2 font-mono">terminal</span>
            </div>
            <div className="p-5 md:p-6 overflow-x-auto">
              <pre className="text-sm font-mono text-[#a6aab5] leading-relaxed">
{`# 克隆仓库
git clone https://github.com/LaobaiAi/steel-frame-design.git
cd steel-frame-design

# 安装依赖
pip install -r requirements.txt

# 快速演示：4 层办公楼，3×2 跨
python cli/main.py run --quick

# 自定义参数
python cli/main.py run --input examples/sample.yaml`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ──
function FooterSection() {
  return (
    <footer className="py-10 md:py-14 px-4 md:px-8" style={{ background: BG }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-10 border-b border-white/5">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 text-white font-semibold text-lg mb-3">
              <span className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold" style={{ background: GREEN, color: BG }}>X</span>
              XuanwuAI
            </div>
            <p className="text-xs text-[#787d87] leading-relaxed max-w-[180px]">
              AI 驱动的参数化钢框架设计全流程管线
            </p>
          </div>
          {[
            { title: '产品', links: ['功能特性', '管线架构', '快速开始'] },
            { title: '资源', links: ['文档', 'GitHub', '更新日志'] },
            { title: '四象 AI', links: ['QinglongAI', 'ZhuqueAI', 'BaihuAI', 'XuanwuAI'] },
            { title: '生态', links: ['StructureClaw', 'CAIAO 架构', 'MIT License'] },
          ].map((group, i) => (
            <div key={i}>
              <div className="text-xs text-[#787d87] font-medium mb-4 uppercase tracking-wider">{group.title}</div>
              <div className="flex flex-col gap-2.5">
                {group.links.map((link, j) => (
                  <a key={j} href="#"
                    className="text-sm text-[#a6aab5] hover:text-[#f5f9fe] transition-colors">
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 text-xs text-[#787d87]">
          <span>© {new Date().getFullYear()} XuanwuAI. MIT License.</span>
          <span>渊默之算 · Abyssal Computation</span>
        </div>
      </div>
    </footer>
  );
}

// ── Main ──
export default function XuanwuLanding() {
  return (
    <div className="w-full min-h-screen" style={{ background: BG }}>
      <Header />
      <Hero />
      <CreatorProfile />
      <ValueCards />
      <FeatureShowcase />
      <Architecture />
      <BrandStory />
      <GetStarted />
      <FooterSection />
    </div>
  );
}
