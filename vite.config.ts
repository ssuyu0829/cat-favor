import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 讓 build 出來的檔案用相對路徑，
// 不管丟到 Cloudflare Pages 根目錄或 GitHub Pages 子路徑都能跑。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist' },
});
