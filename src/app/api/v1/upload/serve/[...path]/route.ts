import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// MIME 类型映射
const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = path.join(UPLOAD_DIR, ...pathSegments);

    // 安全检查：防止路径遍历攻击
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(UPLOAD_DIR)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 检查文件是否存在
    const fileStat = await stat(resolved).catch(() => null);
    if (!fileStat || !fileStat.isFile()) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // 读取文件
    const buffer = await readFile(resolved);

    // 确定 MIME 类型
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    // 安全：为SVG文件添加 Content-Security-Policy 防止XSS攻击
    const isSvg = ext === '.svg';
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    if (isSvg) {
      headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'";
      headers['X-Content-Type-Options'] = 'nosniff';
    }
    // 为所有图片添加防热链和X-Content-Type-Options
    headers['X-Content-Type-Options'] = 'nosniff';

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
