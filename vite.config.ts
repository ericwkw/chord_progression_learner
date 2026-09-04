import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: Number(process.env.PORT) || 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
        // Injected at build time; the client reads process.env.*. No key =>
        // the AI Analyst panel reports it needs one and stays disabled.
        'process.env.API_KEY': JSON.stringify(
          env.API_KEY || env.OPENROUTER_API_KEY || env.GEMINI_API_KEY || env.VITE_API_KEY || ''
        ),
        'process.env.LLM_BASE_URL': JSON.stringify(env.LLM_BASE_URL || ''),
        'process.env.LLM_MODEL': JSON.stringify(env.LLM_MODEL || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
