// 公共验证器

// 邮箱正则表达式 — 增强版：支持常见邮箱格式，拒绝明显无效地址
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// 常用输入长度限制
export const LIMITS = {
  NICKNAME_MAX: 30,
  BIO_MAX: 500,
  COMMENT_MAX: 1000,
  MESSAGE_MAX: 2000,
  TAG_IDS_MAX: 100,
  WORK_IDS_MAX: 100,
} as const;

// 缓存TTL常量（秒）
export const CACHE_TTL = {
  STATS_PUBLIC: 120,
  WORKS_FEATURED: 300,
  WORKS_LIST: 60,
  WORKS_DETAIL: 120,
  COMMENTS: 30,
  CATEGORIES: 300,
  AI_MODEL: 300,
  AI_ENABLED: 60,
  CONFIG: 300,
} as const;

// 验证昵称
export function isValidNickname(nickname: string): boolean {
  return nickname.length > 0 && nickname.length <= LIMITS.NICKNAME_MAX;
}

// 验证个人简介
export function isValidBio(bio: string): boolean {
  return bio.length <= LIMITS.BIO_MAX;
}

// 验证评论内容
export function isValidComment(content: string): boolean {
  return content.length > 0 && content.length <= LIMITS.COMMENT_MAX;
}
