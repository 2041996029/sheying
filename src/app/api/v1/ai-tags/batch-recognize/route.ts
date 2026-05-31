import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { getRandomTags, getEnabledAiModel, getAiTagPrompt, getAiImageSuffix, getAiTimeout, getAiRetryCount, applyAiImageSuffix, isAiEnabled, callAiForTagsMulti } from '@/lib/ai-tags';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const body = await request.json();
    const { work_ids } = body as { work_ids: string[] };

    if (!work_ids || !Array.isArray(work_ids) || work_ids.length === 0) {
      return error(40001, 'work_ids不能为空', requestId);
    }

    // Create batch task
    const task = await db.batchRecognizeTask.create({
      data: {
        totalCount: work_ids.length,
        status: 'running',
      },
    });

    // Check AI configuration
    const aiEnabled = await isAiEnabled();
    const aiModel = await getEnabledAiModel();
    const prompt = await getAiTagPrompt();
    const imageSuffix = await getAiImageSuffix();
    const aiTimeout = await getAiTimeout();
    const aiRetryCount = await getAiRetryCount();

    let completed = 0;
    let failed = 0;
    let totalImages = 0;

    for (const workId of work_ids) {
      try {
        const work = await db.work.findFirst({ where: { id: workId, deletedAt: null } });
        if (!work) {
          failed++;
          continue;
        }

        // 收集作品所有图片
        const imageUrls: string[] = [];
        if (work.coverUrl) {
          imageUrls.push(work.coverUrl);
        }
        if (work.images) {
          try {
            const images = JSON.parse(work.images);
            if (Array.isArray(images)) {
              for (const img of images) {
                if (img && !imageUrls.includes(img)) {
                  imageUrls.push(img);
                }
              }
            }
          } catch {
            // images 解析失败，忽略
          }
        }

        totalImages += imageUrls.length;

        // 应用AI识别图片链接后缀
        const aiImageUrls = imageUrls.map((url) => applyAiImageSuffix(url, imageSuffix));

        let generatedTags: { name: string; confidence: number }[];
        let modelId: string | null = null;
        let rawResponse: string | null = null;
        let usedPrompt: string | null = null;

        if (aiEnabled && aiModel && aiImageUrls.length > 0) {
          const result = await callAiForTagsMulti(aiImageUrls, prompt, aiModel.apiUrl, aiModel.apiKey, aiModel.modelName, aiTimeout, aiRetryCount);
          generatedTags = result.tags;
          rawResponse = result.rawResponse;
          usedPrompt = result.usedPrompt;
          modelId = result.usedSource === 'custom' ? aiModel.id : null;
        } else {
          // Fallback to mock tags
          const tagCount = 2 + Math.floor(Math.random() * 4);
          generatedTags = getRandomTags(tagCount);
          rawResponse = `[Mock] AI未启用或无可用模型（共${imageUrls.length}张图片未识别）`;
          usedPrompt = null;
        }

        // 每个标签都保存完整的原始响应和提示词，避免依赖兄弟标签查找
        for (const tag of generatedTags) {
          await db.aiTag.create({
            data: {
              workId,
              imageUrl: imageUrls[0],
              tagName: tag.name,
              confidence: tag.confidence,
              auditStatus: 'pending',
              modelId: modelId,
              rawResponse,
              usedPrompt,
            },
          });
        }
        completed++;
      } catch {
        failed++;
      }
    }

    // Update task
    await db.batchRecognizeTask.update({
      where: { id: task.id },
      data: {
        completedCount: completed,
        failedCount: failed,
        status: 'completed',
      },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'batch_recognize',
        targetType: 'batch_task',
        targetId: task.id,
        detail: JSON.stringify({ total: work_ids.length, completed, failed, totalImages, aiEnabled, usedModel: !!aiModel, imageSuffix: imageSuffix || '无' }),
      },
    });

    return success({
      taskId: task.id,
      totalCount: work_ids.length,
      completedCount: completed,
      failedCount: failed,
      totalImages,
    }, `批量识别完成（共${totalImages}张图片）`, requestId);
  } catch (err) {
    console.error('Batch recognize error:', err);
    return error(50001, '批量识别失败', requestId);
  }
}
