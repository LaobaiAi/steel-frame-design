/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyan: { DEFAULT: '#00D4FF', 50: '#E6FAFF', 100: '#B3F0FF', 200: '#80E6FF', 300: '#4DDCFF', 400: '#1AD4FF', 500: '#00D4FF', 600: '#00A8CC', 700: '#007C99', 800: '#005066', 900: '#002433' },
        purple: { DEFAULT: '#7B2FBE', 50: '#F0E6FA', 100: '#D4B3F0', 200: '#B880E6', 300: '#9C4DDC', 400: '#8A33D0', 500: '#7B2FBE', 600: '#6325A0', 700: '#4B1C7C', 800: '#331258', 900: '#1B0934' },
        green: { DEFAULT: '#32f08c', 50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC', 400: '#4ADE80', 500: '#32f08c', 600: '#0fdc78', 700: '#0ab861', 800: '#166534', 900: '#14532D' },
        brand: { DEFAULT: '#32f08c', hover: '#0fdc78', disabled: 'rgba(50,240,140,0.3)' },
        overlay: { l1: 'rgba(237,239,242,0.04)', l2: 'rgba(237,239,242,0.08)', l3: 'rgba(237,239,242,0.13)', l4: 'rgba(237,239,242,0.18)' },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'flow-particle': 'flowParticle 1.5s linear infinite',
        'count-up': 'countUp 2s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'typing': 'typing 0.05s steps(1) forwards',
        'spin-slow': 'spinSlow 8s linear infinite',
      },
      keyframes: {
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 20px rgba(0,212,255,0.3)' }, '50%': { boxShadow: '0 0 40px rgba(0,212,255,0.6)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        flowParticle: { '0%': { transform: 'translateX(0)', opacity: '1' }, '100%': { transform: 'translateX(100%)', opacity: '0' } },
        countUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(30px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        spinSlow: { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
    },
  },
  plugins: [],
};
