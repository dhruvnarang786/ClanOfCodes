/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a', // slate-900
        surface: '#1e293b', // slate-800
        primary: '#3b82f6', // blue-500
        text: '#f8fafc', // slate-50
        muted: '#94a3b8', // slate-400
        border: '#334155', // slate-700
        brand: {
          bg: '#f8fafc',
          surface: '#ffffff',
          primary: '#2563eb',
          accent: '#10b981',
          text: '#0f172a',
          muted: '#64748b',
          border: '#e2e8f0',
        }
      },
    },
  },
  plugins: [],
}
