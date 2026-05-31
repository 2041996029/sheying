import { db } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

export const MOCK_TAGS = [
  '风景', '人像', '街头', '建筑', '微距', '夜景',
  '黑白', '胶片', '自然', '城市', '旅行', '美食',
  '动物', '花卉', '水面', '山脉', '日出', '日落',
  '逆光', '剪影', '长曝光', 'HDR', '航拍', '抽象',
];

export function getRandomTags(count: number): { name: string; confidence: number }[] {
  const shuffled = [...MOCK_TAGS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((name) => ({
    name,
    confidence: Math.round((0.6 + Math.random() * 0.4) * 100) / 100,
  }));
}

export async function getEnabledAiModel() {
  const cacheKey = 'ai_model:enabled';
  const cached = await getCache<{ id: string; apiUrl: string; apiKey: string; modelName: string | null }>(cacheKey);
  if (cached) return cached;

  const model = await db.aiModel.findFirst({
    where: { isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (model) {
    const result = { id: model.id, apiUrl: model.apiUrl, apiKey: model.apiKey, modelName: model.modelName };
    await setCache(cacheKey, result, 300);
    return result;
  }

  return null;
}

export async function getAiTagPrompt(): Promise<string> {
  const cacheKey = 'configs:ai_tag_prompt';
  const cached = await getCache<string>(cacheKey);
  if (cached !== null) return cached;

  try {
    const config = await db.config.findUnique({ where: { key: 'ai_tag_prompt' } });
    const prompt = config?.value || '请识别这张照片的内容和风格，返回标签';
    await setCache(cacheKey, prompt, 300);
    return prompt;
  } catch {
    return '请识别这张照片的内容和风格，返回标签';
  }
}

export async function getAiImageSuffix(): Promise<string> {
  const cacheKey = 'configs:ai_image_suffix';
  const cached = await getCache<string>(cacheKey);
  if (cached !== null) return cached;
  try {
    const config = await db.config.findUnique({ where: { key: 'ai_image_suffix' } });
    const suffix = config?.value || '';
    await setCache(cacheKey, suffix, 300);
    return suffix;
  } catch {
    return '';
  }
}

export async function getAiTimeout(): Promise<number> {
  const cacheKey = 'configs:ai_timeout';
  const cached = await getCache<string>(cacheKey);
  if (cached !== null) return parseInt(cached, 10) || 30;
  try {
    const config = await db.config.findUnique({ where: { key: 'ai_timeout' } });
    const timeout = parseInt(config?.value || '30', 10) || 30;
    await setCache(cacheKey, String(timeout), 300);
    return timeout;
  } catch {
    return 30;
  }
}

export async function getAiRetryCount(): Promise<number> {
  const cacheKey = 'configs:ai_retry_count';
  const cached = await getCache<string>(cacheKey);
  if (cached !== null) return parseInt(cached, 10) || 2;
  try {
    const config = await db.config.findUnique({ where: { key: 'ai_retry_count' } });
    const count = parseInt(config?.value || '2', 10) || 2;
    await setCache(cacheKey, String(count), 300);
    return count;
  } catch {
    return 2;
  }
}

/**
 * 为图片URL添加AI识别后缀（仅用于AI识别，不影响前端展示）
 */
export function applyAiImageSuffix(imageUrl: string, suffix: string): string {
  if (!suffix || !imageUrl) return imageUrl;
  // 避免重复添加后缀
  if (imageUrl.includes(suffix)) return imageUrl;
  return imageUrl + suffix;
}

export async function isAiEnabled(): Promise<boolean> {
  const cacheKey = 'configs:ai_enabled';
  const cached = await getCache<string>(cacheKey);
  if (cached !== null) return cached === 'true';
  try {
    const config = await db.config.findUnique({ where: { key: 'ai_enabled' } });
    const enabled = config?.value === 'true';
    await setCache(cacheKey, enabled ? 'true' : 'false', 60);
    return enabled;
  } catch {
    return false;
  }
}

// 默认系统提示词（仅当用户未配置自定义提示词时使用）
const AI_TAG_SYSTEM_PROMPT = '你是一个专业的图片标签识别助手。请分析图片并返回JSON格式的标签列表，格式为：[{"name":"标签名","confidence":0.95}]。仅返回JSON，不要其他内容。';

// 用户有自定义提示词时的系统提示词（不限制输出格式，由用户提示词决定）
const AI_TAG_SYSTEM_PROMPT_FLEXIBLE = '你是一个专业的摄影作品分析师和AI助手，拥有顶级的视觉分析能力。请严格按照用户的指令要求进行输出。';

/**
 * 解析 AI 返回内容中的标签
 * 支持三种格式：
 * 1. JSON数组: [{"name":"标签名","confidence":0.95}]
 * 2. Markdown标签: #标签1 #标签2 #标签3
 * 3. 列表标签: - #标签名 或 - 标签名
 */
function parseAiTagResponse(content: string): { name: string; confidence: number }[] | null {
  if (!content || content.trim().length === 0) return null;

  // 策略1：尝试解析JSON数组格式
  try {
    const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (jsonMatch) {
      const tags = JSON.parse(jsonMatch[0]);
      if (Array.isArray(tags) && tags.length > 0) {
        return tags.map((t: { name?: string; confidence?: number }) => ({
          name: (t.name || 'unknown').replace(/^#+/, '').trim(),
          confidence: typeof t.confidence === 'number' ? Math.round(t.confidence * 100) / 100 : 0.8,
        }));
      }
    }
  } catch {
    // JSON解析失败，继续尝试其他格式
  }

  // 策略2：从Markdown #标签 格式中提取
  const hashtagMatches = content.match(/#[\u4e00-\u9fff\w\-]+/g);
  if (hashtagMatches && hashtagMatches.length >= 2) {
    const seen = new Set<string>();
    const tags: { name: string; confidence: number }[] = [];
    for (const tag of hashtagMatches) {
      const name = tag.replace(/^#/, '').trim();
      // 过滤纯数字、过长的标题化文字、常见的Markdown标题标记
      if (name && name.length >= 1 && name.length <= 20 && !/^\d+$/.test(name) && !seen.has(name)) {
        seen.add(name);
        tags.push({ name, confidence: 0.85 });
      }
    }
    if (tags.length >= 2) return tags;
  }

  // 策略3：从列表项中提取（- #标签 或 - 标签名）
  const listItemMatches = content.match(/^\s*-\s+#?([^\n#\-]+)/gm);
  if (listItemMatches && listItemMatches.length >= 2) {
    const seen = new Set<string>();
    const tags: { name: string; confidence: number }[] = [];
    for (const item of listItemMatches) {
      const name = item.replace(/^\s*-\s+#?/, '').trim();
      // 过滤描述性文字（包含冒号、逗号、句号的通常是描述，不是标签）
      if (name && name.length >= 2 && name.length <= 15 && !/[:：,，。.、]/.test(name) && !seen.has(name)) {
        seen.add(name);
        tags.push({ name, confidence: 0.8 });
      }
    }
    if (tags.length >= 2) return tags;
  }

  return null;
}

export type AiSource = 'custom' | 'builtin' | 'mock';

const DEFAULT_USER_PROMPT = '请识别这张照片的内容和风格，返回标签';

export async function callAiForTags(imageUrl: string, prompt: string, apiUrl: string, apiKey: string, modelName?: string | null, timeoutSec?: number, retryCount?: number): Promise<{ tags: { name: string; confidence: number }[]; rawResponse: string; usedPrompt: string; usedSource: AiSource }> {
  // 判断是否为用户自定义提示词（非默认提示词时使用灵活系统提示词）
  const isCustomPrompt = prompt.trim() !== DEFAULT_USER_PROMPT;
  const systemPrompt = isCustomPrompt ? AI_TAG_SYSTEM_PROMPT_FLEXIBLE : AI_TAG_SYSTEM_PROMPT;
  const userPrompt = `${prompt}\n\n图片URL: ${imageUrl}`;
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];
  const fullPromptUsed = `System: ${systemPrompt}\nUser: ${userPrompt}`;

  const timeout = timeoutSec ?? 30;
  const maxRetries = retryCount ?? 2;

  // 记录每一步的失败原因，用于诊断
  const failReasons: string[] = [];

  // 1. 优先使用用户自定义模型（支持超时和重试）
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      failReasons.push(`自定义模型第${attempt}次重试...`);
    }
    try {
      let fetchUrl = apiUrl.replace(/\/+$/, '');
      if (!fetchUrl.includes('/chat/completions') && !fetchUrl.includes('/completions')) {
        fetchUrl += '/chat/completions';
      }

      const requestBody: Record<string, unknown> = { messages };
      if (modelName) requestBody.model = modelName;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout * 1000);

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || '';
        const parsed = parseAiTagResponse(rawContent);
        if (parsed) {
          return { tags: parsed, rawResponse: rawContent, usedPrompt: fullPromptUsed, usedSource: 'custom' };
        }
        // 解析失败，不重试（是内容问题，不是网络问题）
        const preview = rawContent.substring(0, 300);
        failReasons.push(`自定义模型返回内容但无法解析标签:\n${preview}`);
        break;
      } else {
        const errText = await response.text().catch(() => '未知错误');
        failReasons.push(`自定义模型API错误 HTTP ${response.status} (第${attempt + 1}次): ${errText.substring(0, 200)}`);
      }
    } catch (customErr) {
      const isTimeout = customErr instanceof DOMException && customErr.name === 'AbortError';
      failReasons.push(`自定义模型调用异常${isTimeout ? '(超时)' : ''} (第${attempt + 1}次): ${customErr instanceof Error ? customErr.message : String(customErr)}`);
      // 超时和网络错误可重试，其他错误不重试
      if (!isTimeout && !(customErr instanceof TypeError)) break;
    }
  }

  // 2. 内置SDK兜底
  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const ai = await ZAI.create();
    const result = await ai.chat.completions.create({ messages });

    const rawContent = result.choices?.[0]?.message?.content || '';
    const parsed = parseAiTagResponse(rawContent);
    if (parsed) {
      return { tags: parsed, rawResponse: rawContent, usedPrompt: fullPromptUsed, usedSource: 'builtin' };
    }
    failReasons.push(`内置SDK返回内容但无法解析标签: ${rawContent.substring(0, 200)}`);
  } catch (sdkErr) {
    failReasons.push(`内置SDK调用失败: ${sdkErr instanceof Error ? sdkErr.message : String(sdkErr)}`);
  }

  // Final fallback: mock tags（附详细失败原因）
  const mockTags = getRandomTags(3);
  const detailMsg = `[Mock] 未调用AI，使用随机标签\n\n--- 失败诊断 ---\n${failReasons.join('\n\n')}`;
  return { tags: mockTags, rawResponse: detailMsg, usedPrompt: fullPromptUsed, usedSource: 'mock' };
}

/**
 * 多图AI标签识别：传入多张图片URL，逐张识别后合并标签结果
 * 去重策略：相同 tagName 只保留最高置信度
 */
export async function callAiForTagsMulti(
  imageUrls: string[],
  prompt: string,
  apiUrl: string,
  apiKey: string,
  modelName?: string | null,
  timeoutSec?: number,
  retryCount?: number,
): Promise<{ tags: { name: string; confidence: number }[]; rawResponse: string; usedPrompt: string; usedSource: AiSource }> {
  const allResults: { tags: { name: string; confidence: number }[]; rawResponse: string; usedPrompt: string; usedSource: AiSource }[] = [];

  for (const imageUrl of imageUrls) {
    const result = await callAiForTags(imageUrl, prompt, apiUrl, apiKey, modelName, timeoutSec, retryCount);
    allResults.push(result);
  }

  // 合并标签：同名标签取最高置信度
  const tagMap = new Map<string, number>();
  for (const r of allResults) {
    for (const tag of r.tags) {
      const existing = tagMap.get(tag.name);
      if (existing === undefined || tag.confidence > existing) {
        tagMap.set(tag.name, tag.confidence);
      }
    }
  }

  const mergedTags = Array.from(tagMap.entries()).map(([name, confidence]) => ({ name, confidence }));

  // 汇总原始响应
  const rawParts = allResults.map((r, i) => `[图片 ${i + 1}] (来源: ${r.usedSource})\n${r.rawResponse}`);
  const mergedRaw = rawParts.join('\n\n---\n\n');

  // 取最后一个结果的信息作为代表
  const lastResult = allResults[allResults.length - 1];

  return {
    tags: mergedTags,
    rawResponse: mergedRaw,
    usedPrompt: lastResult.usedPrompt,
    usedSource: lastResult.usedSource,
  };
}

/**
 * 通用AI对话调用：优先使用用户自定义模型，内置SDK兜底
 * @param messages OpenAI格式消息列表
 * @returns AI回复文本，失败时返回null
 */
export async function callAiChat(messages: { role: 'user' | 'system' | 'assistant'; content: string }[]): Promise<string | null> {
  // 1. 尝试用户自定义模型（优先）
  try {
    const customModel = await getEnabledAiModel();
    if (customModel) {
      let fetchUrl = customModel.apiUrl.replace(/\/+$/, '');
      if (!fetchUrl.includes('/chat/completions') && !fetchUrl.includes('/completions')) {
        fetchUrl += '/chat/completions';
      }

      const requestBody: Record<string, unknown> = { messages };
      if (customModel.modelName) requestBody.model = customModel.modelName;

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customModel.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } else {
        console.error('Custom AI API error:', response.status, await response.text().catch(() => ''));
      }
    }
  } catch (customErr) {
    console.error('Custom AI call failed, trying builtin SDK:', customErr);
  }

  // 2. 内置SDK兜底
  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const ai = await ZAI.create();
    const result = await ai.chat.completions.create({ messages });
    const content = result.choices?.[0]?.message?.content;
    if (content) return content;
  } catch (sdkErr) {
    console.error('Builtin SDK AI call failed:', sdkErr);
  }

  return null;
}
