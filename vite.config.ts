import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "풋살 팀 나누기",
        short_name: "풋살매니저",
        description: "공정하고 스마트한 풋살 팀 배정 앱",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        importScripts: ["push-handler.js"],
        // 정적 자산(JS/CSS/HTML 등)은 precache, 런타임 자산은 아래 정책으로 캐시.
        // Supabase REST API 응답은 의도적으로 캐시하지 않음 (실시간성 우선,
        // realtime 채널이 별도로 동기화 처리).
        runtimeCaching: [
          // Google Fonts CSS — CacheFirst (자주 바뀌지 않음)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts 폰트 파일 — CacheFirst
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-static",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase Storage 이미지(아바타/로고) — StaleWhileRevalidate.
          // 캐시를 즉시 보여주고 백그라운드에서 갱신해 PWA 체감 속도 향상.
          // 사용자가 사진 변경 시 URL 에 ?v=timestamp 가 붙으므로 캐시 무효화 자연 처리.
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 카카오맵 SDK 등 외부 JS — StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/dapi\.kakao\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "kakao-sdk-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 프로덕션 빌드에서 console.* / debugger 제거 (정보 노출 방지)
  esbuild: {
    drop: ["console", "debugger"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 코어는 모든 페이지에서 사용 — 별도 청크로 분리하여 캐시 효율 ↑
          "vendor-react": ["react", "react-dom"],
          // Supabase 클라이언트 (auth + realtime) — 무거우므로 분리
          "vendor-supabase": ["@supabase/supabase-js"],
          // framer-motion / swiper 는 lazy 페이지 청크에 자연 포함되도록 분리하지 않음
        },
      },
    },
  },
});
