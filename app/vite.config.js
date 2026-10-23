export default {
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
  // 知识卡 JSON 在 app 目录之外（knowledge/cards.json 是唯一事实源），允许 dev server 读取
  server: {
    host: '127.0.0.1', port: 5173, fs: { allow: ['..'] },
    // 开发时把 /api 转给 FastAPI（backend/，默认 8765），这样浏览器同源，后端不用开 CORS
    proxy: { '/api': { target: process.env.API_TARGET || 'http://127.0.0.1:8765', changeOrigin: true } },
  },
};
