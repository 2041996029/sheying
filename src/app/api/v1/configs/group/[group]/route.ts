import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { CONFIG_DEFAULTS } from '@/lib/config-defaults';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ group: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { group } = await params;

    // Ensure all default configs for this group exist in the database
    const defaultsForGroup = Object.entries(CONFIG_DEFAULTS).filter(
      ([, config]) => config.group === group
    );

    if (defaultsForGroup.length > 0) {
      // Use sequential upsert to avoid race conditions
      for (const [key, config] of defaultsForGroup) {
        try {
          await db.config.upsert({
            where: { key },
            create: {
              key,
              value: config.value,
              group: config.group,
              description: config.description,
              isEncrypted: config.isEncrypted || false,
            },
            update: {
              group: config.group,
              description: config.description,
              isEncrypted: config.isEncrypted || false,
            },
          });
        } catch (upsertErr: unknown) {
          console.error(`[ConfigAPI] Failed to upsert config key "${key}":`, upsertErr);
          // Try create-only as fallback (key might have wrong type in DB)
          try {
            const existing = await db.config.findUnique({ where: { key } });
            if (!existing) {
              await db.config.create({
                data: {
                  key,
                  value: config.value,
                  group: config.group,
                  description: config.description,
                  isEncrypted: config.isEncrypted || false,
                },
              });
            } else {
              // Key exists but upsert failed - try updating just the group/description
              try {
                await db.config.update({
                  where: { key },
                  data: {
                    group: config.group,
                    description: config.description,
                    isEncrypted: config.isEncrypted || false,
                  },
                });
              } catch (updateErr: unknown) {
                console.error(`[ConfigAPI] Also failed to update config key "${key}":`, updateErr);
              }
            }
          } catch (createErr: unknown) {
            console.error(`[ConfigAPI] Also failed to create config key "${key}":`, createErr);
          }
        }
      }
    }

    const configs = await db.config.findMany({
      where: { group },
    });

    return success(configs, 'ok', requestId);
  } catch (err) {
    console.error('[ConfigAPI] Group configs error:', err);
    // Provide detailed error message for debugging
    const message = err instanceof Error ? err.message : String(err);
    const prismaHint = message.includes('connect') || message.includes('timeout')
      ? ' (数据库连接失败，请检查DATABASE_URL配置和MySQL服务状态)'
      : message.includes('prisma')
      ? ' (Prisma客户端可能需要重新生成，请运行: npx prisma generate)'
      : '';
    return error(50001, `获取配置失败: ${message}${prismaHint}`, requestId);
  }
}
