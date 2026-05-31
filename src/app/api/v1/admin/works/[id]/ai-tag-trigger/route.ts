import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { getRandomTags, getEnabledAiModel, getAiTagPrompt, getAiImageSuffix, getAiTimeout, getAiRetryCount, applyAiImageSuffix, isAiEnabled, callAiForTagsMulti } from '@/lib/ai-tags';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const { id } = await params;

    const work = await db.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) {
      return error(40401, '作品不存在', requestId);
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

    if (imageUrls.length === 0) {
      return error(40001, '作品没有图片', requestId);
    }

    // 获取AI识别图片链接后缀（仅用于AI识别，不影响展示）
    const imageSuffix = await getAiImageSuffix();
    const aiImageUrls = imageUrls.map((url) => applyAiImageSuffix(url, imageSuffix));

    let generatedTags: { name: string; confidence: number }[];
    let modelId: string | null = null;
    let rawResponse: string | null = null;
    let usedPrompt: string | null = null;

    // Check if AI is enabled and a model is configured
    const aiEnabled = await isAiEnabled();
    const aiModel = await getEnabledAiModel();

    if (aiEnabled && aiModel) {
      const prompt = await getAiTagPrompt();
      const aiTimeout = await getAiTimeout();
      const aiRetryCount = await getAiRetryCount();
      const result = await callAiForTagsMulti(aiImageUrls, prompt, aiModel.apiUrl, aiModel.apiKey, aiModel.modelName, aiTimeout, aiRetryCount);
      generatedTags = result.tags;
      rawResponse = result.rawResponse;
      usedPrompt = result.usedPrompt;
      // 根据实际使用的来源设置 modelId：仅自定义模型才记录 ID，内置SDK和Mock不记录
      modelId = result.usedSource === 'custom' ? aiModel.id : null;
    } else {
      // Fallback to mock tags
      const tagCount = 2 + Math.floor(Math.random() * 4);
      generatedTags = getRandomTags(tagCount);
      rawResponse = `[Mock] AI未启用或无可用模型（共${imageUrls.length}张图片未识别）`;
      usedPrompt = null;
    }

    const aiTags: { id: string; tagName: string; confidence: number; auditStatus: string; modelId: string | null }[] = [];
    for (const tag of generatedTags) {
      // 每个标签都保存完整的原始响应和提示词，避免依赖兄弟标签查找
      const aiTag = await db.aiTag.create({
        data: {
          workId: id,
          imageUrl: imageUrls[0],
          tagName: tag.name,
          confidence: tag.confidence,
          auditStatus: 'pending',
          modelId: modelId,
          rawResponse,
          usedPrompt,
        },
      });
      aiTags.push(aiTag);
    }

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'ai_tag_trigger',
        targetType: 'work',
        targetId: id,
        detail: JSON.stringify({ tagCount: aiTags.length, imageCount: imageUrls.length, aiEnabled, usedModel: !!aiModel, imageSuffix: imageSuffix || '无' }),
      },
    });

    return success({ tags: aiTags, imageCount: imageUrls.length }, `AI识别已触发（共${imageUrls.length}张图片）`, requestId);
  } catch (err) {
    console.error('AI tag trigger error:', err);
    return error(50001, 'AI识别触发失败', requestId);
  }
}
