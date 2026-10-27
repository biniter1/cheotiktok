import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Dev: proxy về backend (nginx :8080) để frontend và API cùng origin -> cookie phiên chạy ngay
const API = process.env.API_ORIGIN ?? 'http://localhost:8080';
const paths = ['/auth', '/me', '/suspicions', '/reports', '/appeals', '/users', '/admin', '/dev'];

// SINGLE_FILE=1: gói mọi thứ (JS, CSS, font) vào 1 file HTML — dùng cho bản demo chia sẻ
const singleFile = process.env.SINGLE_FILE === '1';

export default defineConfig({
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  // đường dẫn tuyệt đối cho bản thật (router dạng /zone, /canh-bao); bản 1 file thì tương đối
  base: singleFile ? './' : '/',
  build: singleFile ? { assetsInlineLimit: 100_000_000, outDir: 'dist-demo' } : undefined,
  server: {
    port: 5173,
    proxy: {
      ...Object.fromEntries(paths.map((p) => [p, { target: API, changeOrigin: true }])),
      '/socket.io': { target: API, ws: true, changeOrigin: true },
    },
  },
});
