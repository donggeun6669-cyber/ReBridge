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
