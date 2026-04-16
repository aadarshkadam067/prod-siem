export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { 
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'], 
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
        display: ['Chakra Petch', 'Inter', 'sans-serif']
      },
      colors: {
        bg: { 
          DEFAULT: '#0a0a0a', 
          panel: '#111111', 
          card: '#151515', 
          border: '#252525',
          hover: '#1a1a1a'
        },
        mars: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#8b0000',
          800: '#6b0000',
          900: '#450a0a',
          950: '#2a0505'
        },
        accent: { 
          red: '#dc2626',
          crimson: '#8b0000',
          amber: '#f59e0b',
          green: '#10b981',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4'
        },
      },
      animation: { 
        'pulse-slow': 'pulse 3s infinite',
        'pulse-fast': 'pulse 1.5s infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'glow-pulse': 'glowPulse 2s infinite',
        'threat-pulse': 'threatPulse 1.2s infinite',
        'scan-line': 'scanLine 3s linear infinite',
        'blink': 'blink 1s step-end infinite'
      },
      keyframes: { 
        slideIn: { 
          from: { opacity: 0, transform: 'translateY(12px)' }, 
          to: { opacity: 1, transform: 'translateY(0)' } 
        },
        slideUp: { 
          from: { opacity: 0, transform: 'translateY(20px)' }, 
          to: { opacity: 1, transform: 'translateY(0)' } 
        },
        fadeIn: { 
          from: { opacity: 0 }, 
          to: { opacity: 1 } 
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139, 0, 0, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(139, 0, 0, 0.6)' }
        },
        threatPulse: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.7, transform: 'scale(1.05)' }
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 }
        }
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(139, 0, 0, 0.4)',
        'glow-red-lg': '0 0 40px rgba(139, 0, 0, 0.5)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.3)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
        'inner-glow': 'inset 0 0 20px rgba(139, 0, 0, 0.1)'
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(139, 0, 0, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 0, 0, 0.03) 1px, transparent 1px)',
        'radial-glow': 'radial-gradient(ellipse at center, rgba(139, 0, 0, 0.15) 0%, transparent 70%)'
      }
    }
  },
  plugins: []
}
