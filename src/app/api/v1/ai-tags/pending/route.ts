import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const tags = await db.aiTag.findMany({
      where: { auditStatus: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        work: { select: { id: true, title: true, coverUrl: true } },
      },
    });

    return success(tags, 'ok', requestId);
  } catch (err) {
    console.error('Pending AI tags error:', err);
    return error(50001, '获取待审核标签失败', requestId);
  }
}
