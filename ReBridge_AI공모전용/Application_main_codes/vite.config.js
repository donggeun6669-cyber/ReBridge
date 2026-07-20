import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 빌드 시각을 KST 'MM-DD HH:mm' 로 박아둠 → 화면에서 어떤 빌드인지 즉시 확인용
const buildStamp = new Date(Date.now() + 9 * 60 * 60 * 1000)
  .toISOString()
  .slice(5, 16)
  .replace('T', ' ');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      __BUILD_TIME__: JSON.stringify(buildStamp),
    },
    build: {
      rollupOptions: {
        output: {
          // 자주 안 바뀌는 라이브러리를 별도 청크로 → 재배포해도 브라우저 캐시 유지
          manualChunks: {
            vendor: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    server: {
      allowedHosts: ['dingy-blade-backup.ngrok-free.dev'],
      proxy: {
        '/api/careernet': {
          target: 'https://www.career.go.kr',
          changeOrigin: true,
          rewrite: (path) => {
            const idx = path.indexOf('?');
            const qs = idx >= 0 ? path.slice(idx + 1) : '';
            const params = new URLSearchParams(qs);
            const apiPath = params.get('path') || 'openApi.json';
            params.delete('path');
            params.set('apiKey', env.CAREERNET_API_KEY || '');
            return `/cnet/openapi/${apiPath}?${params}`;
          },
        },
      },
    },
  };
});
