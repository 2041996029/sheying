import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.myqcloud.com' },
      { protocol: 'https', hostname: '*.file.myqcloud.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.cos.ap-*.myqcloud.com' },
      { protocol: 'https', hostname: 'localhost', port: '3000' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
    ],
  },
  // 这些包不经过 Turbopack 打包，而是在运行时从 node_modules 解析
  // 解决 Turbopack 构建时无法解析原生 Node 模块的问题
  serverExternalPackages: [
    'nodemailer',
    'cos-nodejs-sdk-v5',
    'ioredis',
    'sharp',
    'z-ai-web-dev-sdk',
  ],
  async rewrites() {
    return [
      // 将 /uploads/* 请求映射到本地 uploads 目录
      {
        source: '/uploads/:path*',
        destination: '/api/v1/upload/serve/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        // 确保 admin 页面的 JS/CSS 不被浏览器或 CDN 缓存
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // Next.js 的 _next/static 资源默认有长期缓存，这是正常的（通过 hash 文件名）
        // 但 chunk JS 如果 hash 不变就会用缓存，所以确保 standalone 的 HTML 不缓存
        source: '/:path((?!_next/static).*)*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
