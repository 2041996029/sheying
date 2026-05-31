/**
 * EXIF 解析工具函数
 * 从 exifr 解析的原始 EXIF 数据中提取关键字段，映射为前端 ExifPanel 组件期望的格式
 */

/**
 * 从 raw 对象中按多个候选键名取值（忽略大小写）
 */
function pickRawValue(raw: Record<string, unknown>, ...candidates: string[]): unknown {
  for (const key of candidates) {
    if (raw[key] != null) return raw[key];
  }
  // 大小写不敏感回退
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw)) {
    if (v != null) lowerMap.set(k.toLowerCase(), v);
  }
  for (const key of candidates) {
    const v = lowerMap.get(key.toLowerCase());
    if (v != null) return v;
  }
  return null;
}

/**
 * 尝试将各种日期格式解析为 ISO 字符串
 * 支持：Date 对象、ISO 字符串、EXIF 日期格式 "2025:10:15 14:30:00"
 */
export function tryParseDate(value: unknown): string | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value !== 'string') return null;
  const s = value.trim();
  // EXIF 格式: "2025:10:15 14:30:00" → "2025-10-15T14:30:00"
  const exifMatch = s.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (exifMatch) {
    const [, y, mo, d, h, mi, sec] = exifMatch;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec));
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  // 标准 ISO / Date.parse 兼容格式
  const date = new Date(s);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * 将 exifr 解析出的原始 EXIF 字段映射为前端 ExifPanel 组件期望的 camelCase 键名
 *
 * 关键映射：
 *   Make + Model → camera（合并为 "品牌 型号"）
 *   LensModel    → lens
 *   FNumber      → aperture
 *   ExposureTime → shutter
 *   ISO          → iso
 *   FocalLength  → focalLength
 *   DateTimeOriginal / CreateDate → takenAt
 *   GPSLatitude  → latitude
 *   GPSLongitude → longitude
 *   ImageWidth   → width
 *   ImageHeight  → height
 *   Software     → software
 *
 * 增强策略：
 *   1. 精确匹配已知键名（含大小写变体）
 *   2. 大小写不敏感回退
 *   3. Date 对象通用扫描（优先取 original > create > 其他）
 *   4. 字符串日期格式扫描（EXIF 格式 "YYYY:MM:DD HH:MM:SS"）
 */
export function pickExif(raw: Record<string, unknown>): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};

  // 调试日志仅在开发环境输出
  if (process.env.NODE_ENV === 'development' && raw.Make == null && raw.DateTimeOriginal == null) {
    const allKeys = Object.keys(raw);
    const dateKeys = allKeys.filter(k => raw[k] instanceof Date);
    const interestingKeys = allKeys.filter(k => {
      const lower = k.toLowerCase();
      return lower.includes('make') || lower.includes('model') || lower.includes('lens')
        || lower.includes('date') || lower.includes('time') || lower.includes('software');
    });
    if (dateKeys.length > 0 || interestingKeys.length > 0) {
      console.log('[EXIF debug] dateKeys:', dateKeys,
        'interestingKeys:', interestingKeys.map(k => `${k}=${String(raw[k]).substring(0, 60)}`));
    } else {
      console.log('[EXIF debug] raw keys (no date/camera found):', allKeys.join(', '));
    }
  }

  // ─── 相机：合并 Make + Model ───
  const make = pickRawValue(raw, 'Make', 'make') as string | null;
  const model = pickRawValue(raw, 'Model', 'model') as string | null;
  if (make && model) {
    result.camera = `${make} ${model}`;
  } else if (model) {
    result.camera = String(model);
  } else if (make) {
    result.camera = String(make);
  }

  // ─── 镜头 ───
  const lensModel = pickRawValue(raw, 'LensModel', 'lensModel', 'Lens', 'lens') as string | null;
  if (lensModel) result.lens = String(lensModel);

  // ─── 光圈 ───
  const fNumber = pickRawValue(raw, 'FNumber', 'fNumber', 'ApertureValue', 'apertureValue') as number | null;
  if (fNumber != null) result.aperture = fNumber;

  // ─── 快门速度 ───
  const exposureTime = pickRawValue(raw, 'ExposureTime', 'exposureTime') as number | null;
  if (exposureTime != null) {
    const val = exposureTime;
    if (val > 0 && val < 1) {
      const denom = Math.round(1 / val);
      result.shutter = `1/${denom}`;
    } else {
      result.shutter = String(exposureTime);
    }
  }

  // ─── ISO ───
  const iso = pickRawValue(raw, 'ISO', 'iso', 'ISOSpeedRatings', 'isoSpeedRatings') as number | null;
  if (iso != null) result.iso = iso;

  // ─── 焦距 ───
  const focalLength = pickRawValue(raw, 'FocalLength', 'focalLength') as number | null;
  if (focalLength != null) result.focalLength = focalLength;

  // ─── 等效 35mm 焦距 ───
  const fl35 = pickRawValue(raw, 'FocalLengthIn35mmFormat', 'focalLengthIn35mmFormat') as number | null;
  if (fl35 != null) result.focalLength35 = fl35;

  // ─── 拍摄时间 ───
  // 1. 精确匹配已知键名
  let takenAt: string | null = null;
  const dateOriginal = pickRawValue(raw, 'DateTimeOriginal', 'dateTimeOriginal', 'CreateDate', 'createDate', 'DateTimeDigitized', 'dateTimeDigitized');
  if (dateOriginal instanceof Date) {
    takenAt = dateOriginal.toISOString();
  } else if (dateOriginal != null) {
    const parsed = tryParseDate(dateOriginal);
    if (parsed) takenAt = parsed;
  }

  // 2. 回退：扫描 raw 中所有 Date 对象，优先取名含 Original/Create 的
  if (!takenAt) {
    const dateEntries = Object.entries(raw).filter(([_, v]) => v instanceof Date);
    const originalDate = dateEntries.find(([k]) => /original/i.test(k));
    const createDate = dateEntries.find(([k]) => /create/i.test(k));
    const firstDate = originalDate || createDate || dateEntries[0];
    if (firstDate) {
      takenAt = (firstDate[1] as Date).toISOString();
    }
  }

  // 3. 回退：扫描 raw 中所有字符串，尝试解析含日期格式的值
  if (!takenAt) {
    const dateStrPattern = /^\d{4}[:\-]\d{2}[:\-]\d{2}\s+\d{2}/;
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string' && dateStrPattern.test(v) && /date|time|original|create/i.test(k)) {
        const parsed = tryParseDate(v);
        if (parsed) { takenAt = parsed; break; }
      }
    }
  }

  if (takenAt) result.takenAt = takenAt;

  // ─── 作者/摄影师 ───
  const artist = pickRawValue(raw, 'Artist', 'artist', 'Copyright', 'copyright') as string | null;
  if (artist) result.author = String(artist);

  // ─── 后期软件 ───
  const software = pickRawValue(raw, 'Software', 'software') as string | null;
  if (software) result.software = String(software);

  // ─── 图片尺寸 ───
  const width = pickRawValue(raw, 'ImageWidth', 'imageWidth', 'ExifImageWidth', 'exifImageWidth') as number | null;
  const height = pickRawValue(raw, 'ImageHeight', 'imageHeight', 'ExifImageHeight', 'exifImageHeight') as number | null;
  if (width != null) result.width = width;
  if (height != null) result.height = height;

  // ─── GPS 坐标 ───
  if (raw.latitude != null && raw.longitude != null) {
    result.latitude = raw.latitude as number;
    result.longitude = raw.longitude as number;
  }

  // ─── 保留原始字段（兼容旧格式读取）───
  const exposureComp = pickRawValue(raw, 'ExposureCompensation', 'exposureCompensation') as number | null;
  if (exposureComp != null) result.exposureCompensation = exposureComp;
  const meteringMode = pickRawValue(raw, 'MeteringMode', 'meteringMode') as string | number | null;
  if (meteringMode != null) result.meteringMode = String(meteringMode);
  const whiteBalance = pickRawValue(raw, 'WhiteBalance', 'whiteBalance') as string | number | null;
  if (whiteBalance != null) result.whiteBalance = String(whiteBalance);
  const flash = pickRawValue(raw, 'Flash', 'flash') as string | number | null;
  if (flash != null) result.flash = String(flash);

  return result;
}
