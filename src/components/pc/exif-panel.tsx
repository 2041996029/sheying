'use client';

import { Camera, Aperture, Clock, Gauge, Crosshair, CircleDot, MapPin, Calendar, Monitor, User } from 'lucide-react';

interface ExifData {
  camera?: string;
  lens?: string;
  author?: string;
  aperture?: string | number;
  shutter?: string;
  iso?: string | number;
  focalLength?: string | number;
  latitude?: number;
  longitude?: number;
  width?: number;
  height?: number;
  takenAt?: string;
  software?: string;
  // 兼容旧数据（下划线格式）
  shutter_speed?: string;
  focal_length?: string;
  // 兼容旧数据（exifr 原始字段名）
  Make?: string;
  Model?: string;
  LensModel?: string;
  FNumber?: number;
  ExposureTime?: number | string;
  ISO?: number;
  FocalLength?: number;
  DateTimeOriginal?: string;
  CreateDate?: string;
  GPSLatitude?: number;
  GPSLongitude?: number;
  Software?: string;
  ImageWidth?: number;
  ImageHeight?: number;
  [key: string]: string | number | boolean | null | undefined;
}

// params 可以是单个对象（旧格式）或数组（新格式，每张图一个EXIF）
type ParamsType = ExifData | ExifData[] | null;

interface ExifPanelProps {
  params: ParamsType;
  activeIndex?: number;
}

/**
 * 将旧格式 EXIF 数据（exifr 原始字段名）映射为 ExifPanel 期望的 camelCase 字段
 * 这是向后兼容层：数据库中已有的旧数据使用 Make/Model/FNumber 等键名，
 * 而新数据（修复后）使用 camera/lens/aperture 等键名。
 */
function normalizeExif(raw: ExifData): ExifData {
  const d = raw;

  // 如果已有新格式字段，直接返回
  if (d.camera || d.lens || d.aperture || d.shutter || d.iso || d.focalLength) {
    return d;
  }

  // 从旧格式映射
  const result: ExifData = { ...d };

  // 相机：合并 Make + Model
  const make = d.Make ?? (d['make'] as string | undefined);
  const model = d.Model ?? (d['model'] as string | undefined);
  if (make && model) {
    result.camera = `${make} ${model}`;
  } else if (model) {
    result.camera = String(model);
  } else if (make) {
    result.camera = String(make);
  }

  // 镜头
  const lensModel = d.LensModel ?? (d['lensModel'] as string | undefined) ?? (d['Lens'] as string | undefined) ?? (d['lens'] as string | undefined);
  if (lensModel) result.lens = String(lensModel);

  // 光圈
  const fNumber = d.FNumber ?? (d['fNumber'] as number | undefined) ?? (d['ApertureValue'] as number | undefined) ?? (d['apertureValue'] as number | undefined);
  if (fNumber != null && !result.aperture) result.aperture = fNumber;

  // 快门速度
  const exposureTime = d.ExposureTime ?? (d['exposureTime'] as number | string | undefined);
  if (exposureTime != null && !result.shutter && !result.shutter_speed) {
    const val = Number(exposureTime);
    if (val > 0 && val < 1) {
      const denom = Math.round(1 / val);
      result.shutter = `1/${denom}`;
    } else {
      result.shutter = String(exposureTime);
    }
  }

  // ISO
  const iso = d.ISO ?? (d['iso'] as number | undefined) ?? (d['ISOSpeedRatings'] as number | undefined) ?? (d['isoSpeedRatings'] as number | undefined);
  if (iso != null && !result.iso) result.iso = iso;

  // 焦距
  const focalLength = d.FocalLength ?? (d['focalLength'] as number | undefined);
  if (focalLength != null && !result.focalLength && !result.focal_length) result.focalLength = focalLength;

  // 拍摄时间
  const takenAt = d.DateTimeOriginal ?? d.CreateDate ?? (d['takenAt'] as string | undefined);
  if (takenAt && !result.takenAt) result.takenAt = String(takenAt);

  // 后期软件
  const software = d.Software ?? (d['software'] as string | undefined);
  if (software && !result.software) result.software = String(software);

  // 作者
  const author = (d['author'] as string | undefined) ?? (d['Artist'] as string | undefined) ?? (d['artist'] as string | undefined);
  if (author && !result.author) result.author = String(author);

  // GPS
  const lat = d.GPSLatitude ?? d.latitude ?? (d['lat'] as number | undefined);
  const lng = d.GPSLongitude ?? d.longitude ?? (d['lng'] as number | undefined) ?? (d['lon'] as number | undefined);
  if (lat != null && !result.latitude) result.latitude = lat as number;
  if (lng != null && !result.longitude) result.longitude = lng as number;

  // 图片尺寸
  const width = d.ImageWidth ?? (d['ExifImageWidth'] as number | undefined) ?? d.width;
  const height = d.ImageHeight ?? (d['ExifImageHeight'] as number | undefined) ?? d.height;
  if (width != null && !result.width) result.width = width as number;
  if (height != null && !result.height) result.height = height as number;

  return result;
}

// 核心拍摄参数（光圈、快门、ISO、焦距）— 以醒目 pill 标签展示
const coreParams: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; prefix?: string; suffix?: string }[] = [
  { key: 'aperture', label: '光圈', icon: Aperture, prefix: 'f/' },
  { key: 'shutter', label: '快门', icon: Clock },
  { key: 'shutter_speed', label: '快门', icon: Clock },
  { key: 'iso', label: 'ISO', icon: Gauge },
  { key: 'focalLength', label: '焦距', icon: CircleDot, suffix: 'mm' },
  { key: 'focal_length', label: '焦距', icon: CircleDot, suffix: 'mm' },
];

// 次要参数
const secondaryParams: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'author', label: '作者', icon: User },
  { key: 'takenAt', label: '拍摄时间', icon: Calendar },
  { key: 'software', label: '后期软件', icon: Monitor },
];

// 不展示的字段
const hiddenKeys = new Set(['latitude', 'longitude', 'lat', 'lng', 'lon', 'width', 'height', 'location',
  'Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength',
  'DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'Software',
  'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight',
  'ExposureCompensation', 'MeteringMode', 'WhiteBalance', 'Flash',
  'FocalLengthIn35mmFormat', 'focalLength35', 'exposureCompensation', 'meteringMode',
  'whiteBalance', 'flash', 'ApertureValue', 'apertureValue', 'ISOSpeedRatings',
  'isoSpeedRatings', 'Lens', 'lensModel', 'make', 'model',
  'Artist', 'artist', 'Copyright', 'copyright',
]);

function getActiveExif(params: ParamsType, activeIndex?: number): ExifData | null {
  if (!params) return null;
  if (Array.isArray(params)) {
    if (params.length === 0) return null;
    const idx = activeIndex ?? 0;
    const raw = params[idx] ?? params[0] ?? null;
    if (!raw) return null;
    return normalizeExif(raw);
  }
  return normalizeExif(params);
}

export function ExifPanel({ params, activeIndex }: ExifPanelProps) {
  const exifData = getActiveExif(params, activeIndex);

  if (!exifData || Object.keys(exifData).length === 0) {
    return null;
  }

  // 提取相机和镜头
  const camera = exifData.camera ? String(exifData.camera) : null;
  const lens = exifData.lens ? String(exifData.lens) : null;

  // 提取核心参数（去重：shutter/shutter_speed 只取一个，focalLength/focal_length 只取一个）
  const seenLabels = new Set<string>();
  const coreEntries: { key: string; label: string; value: string; icon: React.ComponentType<{ className?: string }> }[] = [];

  for (const param of coreParams) {
    const rawValue = exifData[param.key];
    if (!rawValue) continue;
    // 去重：同类参数只取第一个有值的
    if (seenLabels.has(param.label)) continue;
    seenLabels.add(param.label);

    let displayValue = String(rawValue);
    if (param.prefix && !displayValue.startsWith(param.prefix)) {
      displayValue = param.prefix + displayValue;
    }
    if (param.suffix && !displayValue.endsWith(param.suffix)) {
      displayValue = displayValue + param.suffix;
    }

    coreEntries.push({
      key: param.key,
      label: param.label,
      value: displayValue,
      icon: param.icon,
    });
  }

  // 提取次要参数
  const secondaryEntries: { key: string; label: string; value: string; icon: React.ComponentType<{ className?: string }> }[] = [];
  for (const param of secondaryParams) {
    const rawValue = exifData[param.key];
    if (!rawValue) continue;
    let displayValue = String(rawValue);
    if (param.key === 'takenAt') {
      try {
        const d = new Date(rawValue as string);
        displayValue = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch {
        displayValue = String(rawValue);
      }
    }
    secondaryEntries.push({
      key: param.key,
      label: param.label,
      value: displayValue,
      icon: param.icon,
    });
  }

  const hasGps = (exifData.latitude != null || exifData.lat != null) && (exifData.longitude != null || exifData.lng != null || exifData.lon != null);
  const hasAnyContent = camera || lens || coreEntries.length > 0 || secondaryEntries.length > 0 || hasGps;

  if (!hasAnyContent) return null;

  return (
    <div className="glass-subtle rounded-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Camera className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold">拍摄参数</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* 相机 + 镜头 — 主要信息 */}
        {(camera || lens) && (
          <div className="space-y-2">
            {camera && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Camera className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-semibold leading-tight">{camera}</span>
              </div>
            )}
            {lens && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Crosshair className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground/80 leading-tight">{lens}</span>
              </div>
            )}
          </div>
        )}

        {/* 核心参数 pill 标签 */}
        {coreEntries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {coreEntries.map(({ key, label, value, icon: Icon }) => (
              <div
                key={key}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/80 hover:bg-primary/10 transition-colors border border-border/50"
              >
                <Icon className="h-3 w-3 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                <span className="text-xs font-semibold">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* 次要参数 */}
        {secondaryEntries.length > 0 && (
          <div className="space-y-2 pt-1">
            {secondaryEntries.map(({ key, label, value, icon: Icon }) => (
              <div key={key} className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                <span className="text-xs font-medium truncate">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* GPS 位置 */}
        {hasGps && (
          <a
            href={`https://uri.amap.com/marker?position=${exifData.longitude ?? exifData.lng ?? exifData.lon},${exifData.latitude ?? exifData.lat}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors group"
          >
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-primary font-medium">查看拍摄地点</span>
          </a>
        )}
      </div>
    </div>
  );
}
