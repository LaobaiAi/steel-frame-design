import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  Box, GitBranch, FileText, ShieldCheck,
  Cpu, Globe, ArrowRight, ChevronDown, Maximize2
} from 'lucide-react';

// ═════════════════════════════════════════════════════════
//  Enhanced Pixel Particle Background
// ═════════════════════════════════════════════════════════

function PixelBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number, mx = -1000, my = -1000;

    const resize = () => { canvas!.width = window.innerWidth; canvas!.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const G = 40;
    const cols = Math.ceil(canvas.width / G) + 4;
    const rows = Math.ceil(canvas.height / G) + 4;
    const pts: { ox: number; oy: number; x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) pts.push({ ox: c * G, oy: r * G, x: c * G, y: r * G });

    const particles: { x: number; y: number; vx: number; vy: number; s: number; a: number; ph: number }[] = [];
    for (let i = 0; i < 60; i++) particles.push({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
      s: 1 + Math.random() * 2.5, a: 0.04 + Math.random() * 0.1, ph: Math.random() * Math.PI * 2,
    });

    const onM = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const onL = () => { mx = -1000; my = -1000; };
    window.addEventListener('mousemove', onM);
    window.addEventListener('mouseleave', onL);

    let f = 0;
    function draw() {
      f++;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const w = canvas!.width, h = canvas!.height;
      const R = 140;

      for (const p of pts) {
        const dx = p.ox - mx, dy = p.oy - my, d = Math.sqrt(dx * dx + dy * dy);
        if (d < R) {
          const t = (1 - d / R) * 4;
          p.x = p.ox + (dx / (d || 1)) * t;
          p.y = p.oy + (dy / (d || 1)) * t;
        } else {
          p.x += (p.ox - p.x) * 0.03;
          p.y += (p.oy - p.y) * 0.03;
        }
      }

      ctx!.strokeStyle = 'rgba(0,212,255,0.025)';
      ctx!.lineWidth = 0.5;
      for (let r = 0; r < rows; r++) {
        ctx!.beginPath();
        for (let c = 0; c < cols; c++) {
          const p = pts[r * cols + c];
          if (!p) continue;
          if (c === 0) ctx!.moveTo(p.x, p.y); else ctx!.lineTo(p.x, p.y);
        }
        ctx!.stroke();
      }
      for (let c = 0; c < cols; c++) {
        ctx!.beginPath();
        for (let r = 0; r < rows; r++) {
          const p = pts[r * cols + c];
          if (!p) continue;
          if (r === 0) ctx!.moveTo(p.x, p.y); else ctx!.lineTo(p.x, p.y);
        }
        ctx!.stroke();
      }

      for (const p of pts) {
        const dx = p.x - mx, dy = p.y - my, d = Math.sqrt(dx * dx + dy * dy);
        if (d < R) {
          const a = (1 - d / R) * 0.2;
          ctx!.fillStyle = `rgba(0,212,255,${a})`;
          ctx!.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
          ctx!.fillStyle = `rgba(123,47,190,${a * 0.5})`;
          ctx!.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
        }
      }

      for (const pt of particles) {
        pt.vx += (Math.random() - 0.5) * 0.04;
        pt.vy += (Math.random() - 0.5) * 0.04;
        pt.vx *= 0.995;
        pt.vy *= 0.995;
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.x < -10) pt.x = w + 10;
        if (pt.x > w + 10) pt.x = -10;
        if (pt.y < -10) pt.y = h + 10;
        if (pt.y > h + 10) pt.y = -10;
        const fl = 0.5 + 0.5 * Math.sin(f * 0.02 + pt.ph);
        ctx!.fillStyle = `rgba(0,212,255,${pt.a * fl})`;
        ctx!.beginPath();
        ctx!.arc(pt.x, pt.y, pt.s * 0.5, 0, Math.PI * 2);
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onM);
      window.removeEventListener('mouseleave', onL);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
}

// ═════════════════════════════════════════════════════════
//  Grid Distortion Footer Effect (like trae.cn)
// ═════════════════════════════════════════════════════════

function GridDistortion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;

    const resize = () => { canvas!.width = canvas!.offsetWidth; canvas!.height = canvas!.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const G = 32;
    const cols = Math.ceil(canvas.width / G) + 2;
    const rows = Math.ceil(canvas.height / G) + 2;
    const pts: { ox: number; oy: number; x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) pts.push({ ox: c * G, oy: r * G, x: c * G, y: r * G });

    let t = 0;
    function draw() {
      t += 0.008;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (const p of pts) {
        const wave = Math.sin(p.ox * 0.03 + t) * 4 + Math.sin(p.oy * 0.03 + t * 0.7) * 3;
        const wave2 = Math.cos(p.oy * 0.02 + t * 0.5) * 3;
        p.x = p.ox + wave + wave2;
        p.y = p.oy + Math.sin(p.ox * 0.04 + t * 0.6) * 2 + Math.cos(p.oy * 0.03 + t * 0.8) * 2;
      }

      ctx!.strokeStyle = 'rgba(0,212,255,0.04)';
      ctx!.lineWidth = 0.5;
      for (let r = 0; r < rows; r++) {
        ctx!.beginPath();
        for (let c = 0; c < cols; c++) {
          const p = pts[r * cols + c];
          if (!p) continue;
          if (c === 0) ctx!.moveTo(p.x, p.y); else ctx!.lineTo(p.x, p.y);
        }
        ctx!.stroke();
      }
      for (let c = 0; c < cols; c++) {
        ctx!.beginPath();
        for (let r = 0; r < rows; r++) {
          const p = pts[r * cols + c];
          if (!p) continue;
          if (r === 0) ctx!.moveTo(p.x, p.y); else ctx!.lineTo(p.x, p.y);
        }
        ctx!.stroke();
      }

      // Bright dots at intersections
      for (const p of pts) {
        const br = 0.08 + 0.06 * Math.sin(p.ox * 0.05 + p.oy * 0.04 + t * 2);
        ctx!.fillStyle = `rgba(0,212,255,${br})`;
        ctx!.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
      }

      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ═════════════════════════════════════════════════════════
//  Nav Bar
// ═════════════════════════════════════════════════════════

function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled
          ? 'bg-[#050510]/80 backdrop-blur-2xl border-b border-white/[0.03]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-400/15 group-hover:border-cyan-400/30 transition-all duration-500">
            <span className="text-xs font-bold text-white/90 tracking-tight">C</span>
          </div>
          <span className="text-sm font-semibold text-white/80">CAIAO</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: '流水线', href: '#pipeline' },
            { label: '特性', href: '#features' },
            { label: '亮点', href: '#highlights' },
          ].map(l => (
            <a key={l.label} href={l.href}
              className="text-xs text-gray-500 hover:text-gray-300 transition-all duration-300 hover:tracking-wider">
              {l.label}
            </a>
          ))}
          <button
            onClick={() => useStore.getState().setStep('input')}
            className="group relative px-5 py-2 rounded-full overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-[1px] rounded-full bg-[#050510]" />
            <span className="relative text-xs font-medium text-cyan-300/90 group-hover:text-cyan-200 transition-colors">
              开始演示
            </span>
          </button>
        </div>

        <button className="md:hidden text-gray-400 p-2" onClick={() => setOpen(!open)}>
          <div className="w-5 h-px bg-gray-400 mb-1 transition-all" style={{ width: open ? 20 : 16 }} />
          <div className="w-5 h-px bg-gray-400 transition-all" style={{ width: open ? 16 : 20 }} />
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-[#050510]/95 backdrop-blur-xl border-t border-white/[0.03] px-6 py-4 flex flex-col gap-4">
          <a href="#pipeline" className="text-sm text-gray-400 hover:text-white transition-colors">流水线</a>
          <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">特性</a>
          <a href="#highlights" className="text-sm text-gray-400 hover:text-white transition-colors">亮点</a>
          <button onClick={() => useStore.getState().setStep('input')}
            className="w-fit px-5 py-2 rounded-full text-xs font-medium text-cyan-300/90 border border-cyan-400/20 bg-cyan-500/5">
            开始演示
          </button>
        </div>
      )}
    </nav>
  );
}

// ═════════════════════════════════════════════════════════
//  Hero Section with Typewriter Stats
// ═════════════════════════════════════════════════════════

function HeroSection() {
  const { setStep } = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 300); return () => clearTimeout(t); }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <PixelBg />
        <div className="absolute inset-0">
          <div className="absolute w-[700px] h-[700px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 60%)',
              top: '10%', left: '15%',
              animation: 'orbA 18s ease-in-out infinite alternate',
            }} />
          <div className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(123,47,190,0.03) 0%, transparent 60%)',
              bottom: '0%', right: '10%',
              animation: 'orbB 22s ease-in-out infinite alternate',
            }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050510]" />
      </div>

      <div
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="mb-8 px-4 py-1.5 rounded-full border border-cyan-500/10 bg-cyan-500/[0.03] backdrop-blur-sm">
          <span className="text-[10px] text-cyan-400/50 tracking-[0.3em] font-mono">CAIAO · v2.0</span>
        </div>

        <h1 className="text-[clamp(2.8rem,7vw,5.5rem)] leading-[1.05] font-bold tracking-tight mb-6">
          <span className="block">
            <span className="bg-gradient-to-b from-white via-white/90 to-gray-400 bg-clip-text text-transparent">
              CAIAO
            </span>
            <span className="text-[clamp(0.8rem,1.5vw,1.2rem)] font-light tracking-[0.3em] text-gray-500 ml-4 align-middle">
              Server
            </span>
          </span>
          <span className="block text-[clamp(1rem,2vw,1.6rem)] font-light tracking-[0.1em] text-gray-500 mt-4">
            AI 驱动的钢结构全流程设计平台
          </span>
        </h1>

        <p className="text-sm sm:text-base text-gray-500 font-light leading-relaxed max-w-2xl mb-6">
          从自然语言到三维钢框架模型，从有限元分析到 GB50017 规范校核——<br className="hidden sm:block" />
          一条命令完成结构设计全流程
        </p>

        <div className="w-16 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent my-6" />

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button onClick={() => setStep('input')}
            className="group relative px-8 py-3.5 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/25 to-purple-500/25 opacity-80 group-hover:opacity-100 transition-all duration-500" />
            <div className="absolute inset-[1px] rounded-full bg-[#050510] group-hover:bg-[#08081e] transition-colors duration-500" />
            <span className="relative flex items-center gap-2.5 text-sm text-white font-medium">
              开始演示 <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
            </span>
          </button>
          <a href="#pipeline"
            className="px-8 py-3.5 rounded-full text-sm text-gray-500 hover:text-gray-300 border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
            了解架构
          </a>
        </div>

        <div className="flex items-center justify-center gap-12 sm:gap-16 mt-16 pt-10 border-t border-white/[0.03] w-full max-w-lg">
          {[
            { v: '5', l: '原子 Server' },
            { v: '7', l: 'H型钢截面' },
            { v: 'GB50017', l: '规范校核' },
          ].map((s) => (
            <div key={s.l} className="text-center group">
              <div className="text-lg sm:text-xl font-bold text-white/80 font-mono tracking-tight
                group-hover:text-cyan-300/50 transition-colors duration-500">
                {s.v}
              </div>
              <div className="text-[10px] text-gray-600 tracking-wider mt-1.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-gray-700">
        <span className="text-[9px] tracking-[0.25em] font-mono">滚动探索</span>
        <ChevronDown size={14} className="animate-bounceDown opacity-70" />
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════
//  Scroll Reveal Wrapper
// ═════════════════════════════════════════════════════════

function InView({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); o.disconnect(); } },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
//  Animated GIF-like Visuals for Each Pipeline Step
// ═════════════════════════════════════════════════════════

function AnimatedFrameVisual() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      <defs>
        <linearGradient id="fGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,212,255,0.15)" />
          <stop offset="100%" stopColor="rgba(123,47,190,0.1)" />
        </linearGradient>
        <filter id="fGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Grid background */}
      <g stroke="rgba(0,212,255,0.08)" strokeWidth="0.5">
        {[60, 120, 180, 240, 300].map(x => <line key={`gx${x}`} x1={x} y1={40} x2={x} y2={260} />)}
        {[60, 100, 140, 180, 220].map(y => <line key={`gy${y}`} x1={40} y1={y} x2={340} y2={y} />)}
      </g>

      {/* Animated columns rising */}
      {[
        { x: 90, h: 160, delay: 0 },
        { x: 150, h: 200, delay: 0.3 },
        { x: 210, h: 180, delay: 0.6 },
        { x: 270, h: 140, delay: 0.2 },
      ].map((col, i) => (
        <g key={i}>
          <rect x={col.x - 6} y={260 - col.h} width={12} height={col.h} fill="rgba(0,212,255,0.06)" stroke="rgba(0,212,255,0.12)" strokeWidth="1" rx="1">
            <animate attributeName="height" values={`0;${col.h}`} dur="2s" begin={`${col.delay}s`} fill="freeze" />
            <animate attributeName="y" values="260;260" dur="2s" begin={`${col.delay}s`} fill="freeze" />
          </rect>
          {/* Beam connectors */}
          <line x1={72} y1={260 - col.h + 20} x2={310} y2={260 - col.h + 20}
            stroke="rgba(123,47,190,0.15)" strokeWidth="2" opacity="0">
            <animate attributeName="opacity" values="0;1" dur="0.5s" begin={`${col.delay + 1}s`} fill="freeze" />
          </line>
        </g>
      ))}

      {/* Pulsing nodes */}
      {[90, 150, 210, 270].map((x, i) => (
        <circle key={i} cx={x} cy={260 - [160, 200, 180, 140][i]} r="4" fill="rgba(0,212,255,0.3)" filter="url(#fGlow)">
          <animate attributeName="r" values="3;6;3" dur="2s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* Floor labels */}
      {[100, 140, 180, 220].map((y, i) => (
        <text key={i} x={350} y={y + 3} fill="rgba(0,212,255,0.1)" fontSize="8" fontFamily="monospace">
          F{4 - i}
          <animate attributeName="opacity" values="0;0.15" dur="0.5s" begin={`${i * 0.3 + 2}s`} fill="freeze" />
        </text>
      ))}

      {/* Scanning beam effect */}
      <rect x="40" y="60" width="300" height="3" fill="rgba(0,212,255,0.06)" opacity="0.5">
        <animate attributeName="y" values="60;260" dur="3s" begin="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" begin="2s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

function AnimatedLoadVisual() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      <defs>
        <filter id="lGlow"><feGaussianBlur stdDeviation="1.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* Structure frame */}
      <g stroke="rgba(0,212,255,0.1)" strokeWidth="1" fill="none">
        {[100, 160, 220].map(x => {
          const lines = [];
          for (let y = 60; y <= 240; y += 40) lines.push(<line key={`s${x}${y}`} x1={x} y1={y} x2={x} y2={y + 40} />);
          return lines;
        })}
        {[60, 100, 140, 180, 220, 260].map(y => {
          const lines = [];
          for (let x = 80; x <= 240; x += 60) lines.push(<line key={`h${x}${y}`} x1={x} y1={y} x2={x + 60} y2={y} />);
          return lines;
        })}
      </g>

      {/* Gravity arrows falling */}
      {[100, 160, 220, 130, 190].map((x, i) => (
        <g key={i} filter="url(#lGlow)">
          <line x1={x} y1={40} x2={x} y2={58} stroke="rgba(0,212,255,0.4)" strokeWidth="1.5">
            <animate attributeName="y1" values="30;50" dur="1.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
            <animate attributeName="y2" values="48;68" dur="1.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </line>
          <polygon points={`${x-3},50 ${x+3},50 ${x},58`} fill="rgba(0,212,255,0.4)">
            <animate attributeName="points" values={`${x-3},40 ${x+3},40 ${x},48;${x-3},60 ${x+3},60 ${x},68;${x-3},40 ${x+3},40 ${x},48`} dur="1.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </polygon>
          <text x={x} y={30} textAnchor="middle" fill="rgba(0,212,255,0.25)" fontSize="8" fontFamily="monospace">
            DL
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </text>
        </g>
      ))}

      {/* Wind waves */}
      <g opacity="0.3">
        <path d="M280,80 Q290,75 300,80 Q310,85 320,80 Q330,75 340,80" stroke="rgba(123,47,190,0.3)" strokeWidth="1" fill="none">
          <animate attributeName="d" values="M280,80 Q290,75 300,80 Q310,85 320,80 Q330,75 340,80;M280,85 Q290,80 300,85 Q310,90 320,85 Q330,80 340,85;M280,80 Q290,75 300,80 Q310,85 320,80 Q330,75 340,80" dur="3s" repeatCount="indefinite" />
        </path>
        <text x="350" y="83" fill="rgba(123,47,190,0.2)" fontSize="7" fontFamily="monospace">W</text>
      </g>

      {/* Load values */}
      <text x="60" y="280" fill="rgba(0,212,255,0.12)" fontSize="9" fontFamily="monospace">
        DL: 2.0 kN/m²
        <animate attributeName="opacity" values="0.08;0.15;0.08" dur="2s" repeatCount="indefinite" />
      </text>
      <text x="180" y="280" fill="rgba(0,212,255,0.12)" fontSize="9" fontFamily="monospace">
        LL: 3.0 kN/m²
        <animate attributeName="opacity" values="0.08;0.15;0.08" dur="2.5s" repeatCount="indefinite" />
      </text>
    </svg>
  );
}

function AnimatedFEAVisual() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      <defs>
        <linearGradient id="stressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0,212,255,0.3)" />
          <stop offset="50%" stopColor="rgba(123,47,190,0.3)" />
          <stop offset="100%" stopColor="rgba(255,100,100,0.3)" />
        </linearGradient>
      </defs>

      {/* Beam grid */}
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="0.5">
        {[60, 120, 180, 240, 300].map(x => {
          const lines = [];
          for (let y = 60; y <= 240; y += 30) lines.push(<line key={`fb${x}${y}`} x1={x} y1={y} x2={x} y2={y + 30} />);
          return lines;
        })}
        {[60, 90, 120, 150, 180, 210, 240].map(y => {
          const lines = [];
          for (let x = 60; x < 300; x += 60) lines.push(<line key={`fh${x}${y}`} x1={x} y1={y} x2={x + 60} y2={y} />);
          return lines;
        })}
      </g>

      {/* Deformed shape wave */}
      {[60, 100, 140, 180, 220, 260, 300].map((x, i) => {
        const baseY = 150;
        const amp = i % 2 === 0 ? 8 : -8;
        return (
          <circle key={i} cx={x} cy={baseY} r="3" fill="rgba(0,212,255,0.2)">
            <animate attributeName="cy" values={`${baseY};${baseY + amp};${baseY}`} dur="2.5s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
            <animate attributeName="r" values="3;5;3" dur="2.5s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Connecting deformed beams */}
      <path d="" stroke="rgba(0,212,255,0.15)" strokeWidth="1.5" fill="none">
        <animate attributeName="d"
          values="M60,150 Q130,150 200,150 Q270,150 340,150;
                  M60,150 Q130,158 200,150 Q270,142 340,150;
                  M60,150 Q130,142 200,150 Q270,158 340,150;
                  M60,150 Q130,150 200,150 Q270,150 340,150"
          dur="3s" repeatCount="indefinite" />
      </path>

      {/* Color gradient bar */}
      <rect x="60" y="240" width="280" height="6" rx="3" fill="url(#stressGrad)" opacity="0.4" />

      {/* Floating FEM nodes */}
      {[
        { x: 80, y: 80, d: 0 }, { x: 200, y: 70, d: 0.5 },
        { x: 320, y: 85, d: 1 }, { x: 140, y: 180, d: 1.5 },
        { x: 260, y: 190, d: 2 },
      ].map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="5" fill="rgba(0,212,255,0.06)" stroke="rgba(0,212,255,0.12)" strokeWidth="0.5">
            <animate attributeName="r" values="4;6;4" dur="3s" begin={`${n.d}s`} repeatCount="indefinite" />
          </circle>
          <text x={n.x + 8} y={n.y + 3} fill="rgba(0,212,255,0.1)" fontSize="6" fontFamily="monospace">
            N{i + 1}
            <animate attributeName="opacity" values="0.08;0.15;0.08" dur="3s" begin={`${n.d}s`} repeatCount="indefinite" />
          </text>
        </g>
      ))}

      <text x="200" y="270" textAnchor="middle" fill="rgba(0,212,255,0.1)" fontSize="7" fontFamily="monospace">
        max δ = 12.5 mm
      </text>
    </svg>
  );
}

function AnimatedCheckVisual() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      <defs>
        <filter id="cGlow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* Elements list */}
      {[
        { id: '#B001', ratio: 0.32, pass: true, delay: 0 },
        { id: '#B002', ratio: 0.45, pass: true, delay: 0.3 },
        { id: '#B003', ratio: 0.72, pass: true, delay: 0.6 },
        { id: '#B004', ratio: 0.88, pass: false, delay: 0.9 },
        { id: '#B005', ratio: 0.55, pass: true, delay: 1.2 },
        { id: '#B006', ratio: 0.41, pass: true, delay: 1.5 },
        { id: '#C001', ratio: 0.38, pass: true, delay: 1.8 },
        { id: '#C002', ratio: 0.92, pass: false, delay: 2.1 },
        { id: '#C003', ratio: 0.63, pass: true, delay: 2.4 },
      ].map((item, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = 60 + col * 110;
        const y = 60 + row * 70;
        const color = item.ratio > 0.8 ? 'rgba(255,100,100,0.3)' : item.ratio > 0.6 ? 'rgba(255,180,50,0.3)' : 'rgba(0,212,255,0.3)';

        return (
          <g key={i} opacity="0">
            <animate attributeName="opacity" values="0;1" dur="0.4s" begin={`${item.delay}s`} fill="freeze" />

            <rect x={x} y={y} width={100} height={55} rx="4" fill="none" stroke={color} strokeWidth="0.8">
              <animate attributeName="stroke" values={color} dur="2s" begin={`${item.delay}s`} repeatCount="indefinite" />
            </rect>

            <text x={x + 10} y={y + 18} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">{item.id}</text>

            {/* Stress bar */}
            <rect x={x + 10} y={y + 25} width={80} height="4" rx="2" fill="rgba(255,255,255,0.04)" />
            <rect x={x + 10} y={y + 25} width={80 * Math.min(item.ratio, 1)} height="4" rx="2" fill={color}>
              <animate attributeName="width" values="0;0" dur={`${item.delay}s`} fill="freeze" />
            </rect>

            {/* Ratio text */}
            <text x={x + 10} y={y + 44} fill="rgba(255,255,255,0.15)" fontSize="9" fontFamily="monospace">
              {item.ratio.toFixed(2)}
            </text>

            {/* Check/X mark */}
            {item.pass ? (
              <polyline points={`${x + 82},${y + 16} ${x + 86},${y + 20} ${x + 92},${y + 12}`}
                fill="none" stroke="rgba(0,212,255,0.3)" strokeWidth="1.5" filter="url(#cGlow)">
                <animate attributeName="stroke" values="rgba(0,212,255,0.3);rgba(0,212,255,0.6);rgba(0,212,255,0.3)" dur="2s" repeatCount="indefinite" />
              </polyline>
            ) : (
              <text x={x + 86} y={y + 21} textAnchor="middle" fill="rgba(255,100,100,0.4)" fontSize="11" fontFamily="monospace">✗</text>
            )}
          </g>
        );
      })}

      {/* Summary banner */}
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.5s" begin="2.8s" fill="freeze" />
        <rect x="100" y="240" width="200" height="30" rx="6" fill="rgba(0,212,255,0.03)" stroke="rgba(0,212,255,0.06)" strokeWidth="0.5" />
        <text x="200" y="259" textAnchor="middle" fill="rgba(0,212,255,0.2)" fontSize="9" fontFamily="monospace">
          通过率: 78% · 最大应力比 0.92
        </text>
      </g>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════
//  Pipeline Section — Numbers 00–03 with GIF-like Visuals
// ═════════════════════════════════════════════════════════

function PipelineSection() {
  const items = [
    {
      num: '00', title: '参数化框架建模',
      desc: 'YAML 输入网格尺寸、层数、截面与材料，自动生成三维钢框架节点与单元模型。支持 7 种内置 H 型钢（GB/T 11263）及 Q235/Q355 材料牌号，完整力学性能参数。',
      tag: 'Frame Generation',
      visual: <AnimatedFrameVisual />,
    },
    {
      num: '01', title: '多工况荷载生成',
      desc: '恒载、活载、风载、地震作用自动推导为单元/节点力。楼面均布荷载按从属面积法转为梁线荷载，底部剪力法计算地震效应，等效静力风荷载。',
      tag: 'Load Generation',
      visual: <AnimatedLoadVisual />,
    },
    {
      num: '02', title: '矩阵位移法 FEA',
      desc: '内置 3D 梁单元刚度矩阵求解器，无需 OpenSees 编译依赖。支持变形与内力分析，结果叠加变形云图，实时缩放 1×–50× 倍率。',
      tag: 'Finite Element Analysis',
      visual: <AnimatedFEAVisual />,
    },
    {
      num: '03', title: 'GB50017 规范验算',
      desc: '逐单元强度、稳定性、长细比和挠度校验，按 GB50017 a/b 类曲线计算稳定系数。超标构件自动标记，应力比颜色映射（绿→黄→红）。',
      tag: 'Code Check',
      visual: <AnimatedCheckVisual />,
    },
  ];

  return (
    <InView>
      <section id="pipeline" className="py-28 sm:py-36 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan/[0.005] to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-[10px] text-cyan-400/40 tracking-[0.35em] font-mono mb-4">CAPABILITIES</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white/90 mb-4">CAIAO 原子流水线</h2>
            <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
              从参数到报告，五个独立原子 Server 按契约编排，LLM 可直接调用
            </p>
          </div>

          {/* Pipeline mini diagram */}
          <InView delay={200}>
            <div className="max-w-2xl mx-auto mb-24 mt-12">
              <div className="flex items-center justify-center gap-0">
                {['框架生成', '荷载生成', 'FEA', '规范验算', '报告'].map((n, i) => (
                  <div key={n} className="flex items-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex flex-col items-center justify-center gap-1
                      transition-all duration-500 hover:scale-105"
                      style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(123,47,190,0.06))', border: '1px solid rgba(0,212,255,0.08)' }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
                      <span className="text-[7px] text-gray-500 font-mono text-center leading-tight px-1">{n}</span>
                    </div>
                    {i < 4 && <div className="w-4 sm:w-8 h-px bg-gradient-to-r from-cyan-400/10 to-purple-400/10" />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[7px] text-gray-700 font-mono px-1">
                <span>model.json</span><span>loaded.json</span><span>analysis.json</span><span>check.json</span><span>report.html</span>
              </div>
            </div>
          </InView>

          {/* Numbered alternating sections with GIF-like visuals */}
          <div className="space-y-20 sm:space-y-28">
            {items.map((item, i) => (
              <InView key={item.num} delay={150 * i}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                  {/* Text side — alternates left/right */}
                  <div className={`${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <div className="text-[13px] font-mono text-cyan-400/40 mb-3 tracking-wider">{item.num}</div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white/90 mb-4 leading-tight">{item.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed mb-4">{item.desc}</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono"
                      style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.06)', color: 'rgba(0,212,255,0.4)' }}>
                      {item.tag}
                    </div>
                  </div>

                  {/* Animated visual side — GIF-like continuous animation */}
                  <div className={`${i % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden
                      transition-all duration-700 hover:scale-[1.01]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.03), rgba(123,47,190,0.03))',
                        border: '1px solid rgba(0,212,255,0.06)',
                      }}>
                      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
                        {item.visual}
                      </div>
                      {/* Subtle grid overlay */}
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                      {/* Corner accents */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-cyan-400/10 rounded-tl-2xl" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-cyan-400/10 rounded-tr-2xl" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-cyan-400/10 rounded-bl-2xl" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-cyan-400/10 rounded-br-2xl" />
                    </div>
                  </div>
                </div>
              </InView>
            ))}
          </div>
        </div>
      </section>
    </InView>
  );
}

// ═════════════════════════════════════════════════════════
//  Feature Cards — 2×2 Animated Grid
// ═════════════════════════════════════════════════════════

function FeaturesSection() {
  const features = [
    {
      icon: Cpu,
      title: 'CAIAO 原子架构',
      desc: '每个求解器和工具以独立 Server 运行，通过 list_tools() / call_tool() 轻量契约通信。原子性、语言无关、即插即用。',
      gradient: 'from-cyan-500/10 to-blue-500/5',
    },
    {
      icon: Globe,
      title: '3D 可视化引擎',
      desc: '基于 Three.js + React-Three-Fiber，支持模型自转、线框/X 光模式、爆炸视图、剖面切割，变形云图实时映射。',
      gradient: 'from-purple-500/10 to-pink-500/5',
    },
    {
      icon: Box,
      title: 'LLM 自然语言交互',
      desc: '集成 DeepSeek/Anthropic API，自然语言→AI 提取参数→全流程自动执行。ReAct Agent 自主规划与调度。',
      gradient: 'from-cyan-500/10 to-teal-500/5',
    },
    {
      icon: FileText,
      title: '智能报告生成',
      desc: 'Jinja2 渲染的 HTML 报告，含模型概览、荷载信息、验算汇总表、关键指标。支持浏览器预览与导出。',
      gradient: 'from-purple-500/10 to-indigo-500/5',
    },
  ];

  return (
    <InView>
      <section id="features" className="py-28 sm:py-36 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan/[0.006] to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[10px] text-cyan-400/40 tracking-[0.35em] font-mono mb-4">FEATURES</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white/90 mb-4">核心技术特性</h2>
            <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
              从 CLI 到 Web，从工程参数到 AI 对话，全方位钢结构设计能力
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <div key={i}
                className="group p-7 sm:p-8 rounded-2xl transition-all duration-500
                  hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/5 cursor-default
                  relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
                {/* Hover gradient reveal */}
                <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                    bg-gradient-to-br from-cyan-500/10 to-purple-500/10
                    group-hover:from-cyan-500/20 group-hover:to-purple-500/20
                    transition-all duration-500"
                  >
                    <f.icon size={20} className="text-cyan-400/50 group-hover:text-cyan-300/70 transition-colors duration-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white/80 mb-2 group-hover:text-white/90 transition-colors">{f.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed group-hover:text-gray-400 transition-colors duration-500">{f.desc}</p>
                  </div>
                </div>
                {/* Bottom shimmer */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent
                  translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </InView>
  );
}

// ═════════════════════════════════════════════════════════
//  Highlights Section — Animated Metric Cards
// ═════════════════════════════════════════════════════════

function HighlightsSection() {
  const items = [
    { icon: Maximize2, title: '竞赛级视觉体验', desc: '深色科技风 UI，像素粒子动画背景，GSAP 驱动的 8 步骤故事板流程，Three.js 3D 实时渲染。让评委一眼记住。', tech: 'React + Three.js + GSAP' },
    { icon: Cpu, title: 'AI 原生架构', desc: '首批 CAIAO 原子 Server，完整 @tool 元数据 + JSON Schema 校验。LLM Agent 可直接调用，可无缝升级 MCP 协议。', tech: 'CAIAO + MCP + LLM' },
    { icon: ShieldCheck, title: '专业结构引擎', desc: '内置矩阵位移法 3D 梁单元求解器，GB50017 a/b 类稳定曲线，7 种 H 型钢截面库，Q235/Q355 材料全支持。', tech: 'FEA + GB50017 + NumPy' },
    { icon: GitBranch, title: '全流程自动化', desc: '一个 YAML 一条命令完成建模到报告全流程。5 个独立 Server 通过 Pipeline 编排，可单独调用也可端到端运行。', tech: 'Pipeline + YAML + CLI' },
  ];

  return (
    <InView>
      <section id="highlights" className="py-28 sm:py-36 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple/[0.008] to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[10px] text-cyan-400/40 tracking-[0.35em] font-mono mb-4">HIGHLIGHTS</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white/90 mb-4">竞赛亮点</h2>
            <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">技术深度与视觉冲击力的完美结合</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item, i) => (
              <div key={i}
                className="p-6 sm:p-7 rounded-2xl transition-all duration-500
                  hover:scale-[1.02] relative overflow-hidden group"
                style={{ border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(255,255,255,0.012)' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/[0.02] to-purple-500/[0.02]
                  translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center
                      bg-cyan-500/5 group-hover:bg-cyan-500/10 transition-colors duration-500">
                      <item.icon size={14} className="text-cyan-400/40 group-hover:text-cyan-300/60 transition-colors duration-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-white/80 group-hover:text-white/90 transition-colors">{item.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3 group-hover:text-gray-400 transition-colors duration-500">{item.desc}</p>
                  <span className="text-[9px] font-mono text-cyan-400/30 group-hover:text-cyan-400/50 transition-colors duration-500">{item.tech}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </InView>
  );
}

// ═════════════════════════════════════════════════════════
//  CTA Section
// ═════════════════════════════════════════════════════════

function CtaSection() {
  const { setStep } = useStore();
  return (
    <section className="py-28 sm:py-36 px-6 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan/[0.012] to-transparent" />
        <div className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,212,255,0.03) 0%, transparent 60%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          }} />
      </div>
      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <InView>
          <div className="text-[10px] text-cyan-400/40 tracking-[0.35em] font-mono mb-4">GET STARTED</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white/90 mb-4">开始探索</h2>
          <p className="text-sm text-gray-500 mb-10 leading-relaxed">从三维建模到规范校核，体验 AI 驱动的钢结构设计全流程</p>
          <button onClick={() => setStep('input')}
            className="group relative px-10 py-4 inline-flex items-center gap-3 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/25 to-purple-500/25 opacity-80 group-hover:opacity-100 transition-all duration-500" />
            <div className="absolute inset-[1px] rounded-full bg-[#050510] group-hover:bg-[#08081e] transition-colors duration-500" />
            <span className="relative text-sm text-white font-medium flex items-center gap-2">
              开始演示 <Maximize2 size={14} className="group-hover:rotate-45 transition-transform duration-500" />
            </span>
          </button>
        </InView>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════
//  Footer with Grid Distortion (trae.cn style)
// ═════════════════════════════════════════════════════════

function FooterSection() {
  return (
    <footer className="relative border-t border-white/[0.02] overflow-hidden">
      <div className="absolute inset-0 h-48">
        <GridDistortion />
      </div>
      <div className="relative z-10 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
              <span className="text-[6px] font-bold text-white/80">C</span>
            </div>
            <span className="text-[10px] text-gray-600 font-mono tracking-wider">CAIAO Server 架构</span>
          </div>
          <div className="flex items-center gap-6 text-[10px] text-gray-500 font-mono">
            <a href="https://github.com/LaobaiAi/steel-frame-design" className="hover:text-gray-300 transition-colors">GitHub</a>
            <a href="https://github.com/LaobaiAi/Demolition-Simulator" className="hover:text-gray-300 transition-colors">CAIAO</a>
          </div>
          <span className="text-[9px] text-gray-600">© 2026 XuanwuAI</span>
        </div>
      </div>
    </footer>
  );
}

// ═════════════════════════════════════════════════════════
//  Main Landing Page
// ═════════════════════════════════════════════════════════

export default function OpeningAnimation() {
  return (
    <div className="w-full min-h-screen bg-[#050510] text-white overflow-x-hidden">
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes orbA {
          0% { transform: translate(0,0) scale(1); opacity: 0.3; }
          100% { transform: translate(50px,-40px) scale(1.3); opacity: 0.7; }
        }
        @keyframes orbB {
          0% { transform: translate(0,0) scale(1); opacity: 0.2; }
          100% { transform: translate(-40px,30px) scale(1.2); opacity: 0.5; }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(6px); opacity: 1; }
        }
      `}</style>
      <NavBar />
      <HeroSection />
      <PipelineSection />
      <FeaturesSection />
      <HighlightsSection />
      <CtaSection />
      <FooterSection />
    </div>
  );
}
