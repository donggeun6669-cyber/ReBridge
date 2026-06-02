import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 빌드 시각을 KST 'MM-DD HH:mm' 로 박아둠 → 화면에서 어떤 빌드인지 즉시 확인용
const buildStamp = new Date(Date.now() + 9 * 60 * 60 * 1000)
  .toISOString()
  .slice(5, 16)
  .replace('T', ' ');

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(buildStamp),
  },
  server: {
    allowedHosts: ['dingy-blade-backup.ngrok-free.dev']
  }
});