'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Aperture, Clock, Gauge, CircleDot, Calendar, Monitor, User, Crosshair, MapPin, Ruler, Zap, Eye, Sun, Flashlight } from 'lucide-react';

interface ExifEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前图片索引 */
  imageIndex: number;
  /** 图片总数 */
  imageTotal: number;
  /** 图片URL */
  imageUrl: string;
  /** 当前 EXIF 数据 */
  exif: Record<string, string | number | null> | null;
  /** 保存回调 */
  onSave: (index: number, exif: Record<string, string | number | null>) => void;
}

// 可编辑的 EXIF 字段定义
const editableFields: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; type?: 'text' | 'number'; placeholder?: string; prefix?: string; suffix?: string }[] = [
  { key: 'camera', label: '相机', icon: Camera, placeholder: '如：NIKON Z6II' },
  { key: 'lens', label: '镜头', icon: Crosshair, placeholder: '如：NIKKOR Z 24-70mm f/2.8 S' },
  { key: 'author', label: '作者', icon: User, placeholder: '摄影师名称' },
  { key: 'aperture', label: '光圈', icon: Aperture, type: 'number', placeholder: '如：2.8', prefix: 'f/' },
  { key: 'shutter', label: '快门', icon: Clock, placeholder: '如：1/200 或 0.005' },
  { key: 'iso', label: 'ISO', icon: Gauge, type: 'number', placeholder: '如：400' },
  { key: 'focalLength', label: '焦距', icon: CircleDot, type: 'number', placeholder: '如：50', suffix: 'mm' },
  { key: 'focalLength35', label: '等效焦距', icon: CircleDot, type: 'number', placeholder: '如：75', suffix: 'mm' },
  { key: 'takenAt', label: '拍摄时间', icon: Calendar, placeholder: '如：2025-06-15T14:30:00' },
  { key: 'software', label: '后期软件', icon: Monitor, placeholder: '如：Adobe Lightroom' },
  { key: 'latitude', label: '纬度', icon: MapPin, type: 'number', placeholder: '如：30.2741' },
  { key: 'longitude', label: '经度', icon: MapPin, type: 'number', placeholder: '如：120.1551' },
  { key: 'location', label: '拍摄地点', icon: MapPin, placeholder: '如：杭州·西湖' },
  { key: 'width', label: '宽度', icon: Ruler, type: 'number', placeholder: '像素', suffix: 'px' },
  { key: 'height', label: '高度', icon: Ruler, type: 'number', placeholder: '像素', suffix: 'px' },
  { key: 'exposureCompensation', label: '曝光补偿', icon: Zap, placeholder: '如：-0.3' },
  { key: 'meteringMode', label: '测光模式', icon: Eye, placeholder: '如：矩阵测光' },
  { key: 'whiteBalance', label: '白平衡', icon: Sun, placeholder: '如：自动' },
  { key: 'flash', label: '闪光灯', icon: Flashlight, placeholder: '如：未闪光' },
];

// 字段分组 - 静态常量，避免每次渲染重新计算
const coreFields = editableFields.filter(f => ['camera', 'lens', 'author'].includes(f.key));
const paramFields = editableFields.filter(f => ['aperture', 'shutter', 'iso', 'focalLength', 'focalLength35', 'exposureCompensation'].includes(f.key));
const metaFields = editableFields.filter(f => ['takenAt', 'software', 'meteringMode', 'whiteBalance', 'flash'].includes(f.key));
const gpsFields = editableFields.filter(f => ['latitude', 'longitude', 'location'].includes(f.key));
const sizeFields = editableFields.filter(f => ['width', 'height'].includes(f.key));

export const ExifEditor = memo(function ExifEditor({ open, onOpenChange, imageIndex, imageTotal, imageUrl, exif, onSave }: ExifEditorProps) {
  const [form, setForm] = useState<Record<string, string>>({});

  // 当打开或切换图片时，初始化表单
  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    if (exif) {
      for (const [k, v] of Object.entries(exif)) {
        if (v != null) init[k] = String(v);
      }
    }
    setForm(init);
  }, [open, exif, imageIndex]);

  const updateField = useCallback((key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev };
      if (value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    // 转换类型：数字字段转回数字
    const result: Record<string, string | number | null> = {};
    const numberKeys = new Set(editableFields.filter(f => f.type === 'number').map(f => f.key));

    for (const [key, value] of Object.entries(form)) {
      if (numberKeys.has(key)) {
        const num = Number(value);
        result[key] = isNaN(num) ? null : num;
      } else {
        result[key] = value;
      }
    }

    // 同步 lat/lng 双写
    if (result.latitude != null) result.lat = result.latitude;
    if (result.longitude != null) result.lng = result.longitude;

    onSave(imageIndex, result);
    onOpenChange(false);
  }, [form, imageIndex, onSave, onOpenChange]);

  const handleClear = useCallback(() => {
    setForm({});
  }, []);

  const renderField = useCallback((field: typeof editableFields[0]) => {
    const value = form[field.key] ?? '';
    return (
      <div key={field.key} className="space-y-1.5">
        <Label className="text-xs text-stone-500 flex items-center gap-1.5">
          <field.icon className="h-3 w-3" />
          {field.label}
        </Label>
        <div className="flex items-center gap-1">
          {field.prefix && (
            <span className="text-xs text-stone-400 font-medium shrink-0">{field.prefix}</span>
          )}
          <Input
            value={value}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            type={field.type === 'number' ? 'number' : 'text'}
            step={field.type === 'number' ? 'any' : undefined}
            className="h-8 text-sm border-stone-200"
          />
          {field.suffix && (
            <span className="text-xs text-stone-400 font-medium shrink-0">{field.suffix}</span>
          )}
        </div>
      </div>
    );
  }, [form, updateField]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-amber-600" />
            编辑 EXIF 信息
            <span className="text-sm font-normal text-stone-400">
              第 {imageIndex + 1} / {imageTotal} 张
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* 图片预览 */}
        {imageUrl && (
          <div className="rounded-lg overflow-hidden border border-stone-200">
            <img
              src={imageUrl}
              alt=""
              className="w-full h-32 object-cover"
            />
          </div>
        )}

        <div className="space-y-5 py-2">
          {/* 相机/镜头/作者 */}
          <div>
            <h4 className="text-xs font-semibold text-stone-700 mb-3 uppercase tracking-wider">设备 & 作者</h4>
            <div className="grid grid-cols-1 gap-3">
              {coreFields.map(renderField)}
            </div>
          </div>

          {/* 核心拍摄参数 */}
          <div>
            <h4 className="text-xs font-semibold text-stone-700 mb-3 uppercase tracking-wider">拍摄参数</h4>
            <div className="grid grid-cols-2 gap-3">
              {paramFields.map(renderField)}
            </div>
          </div>

          {/* 时间/软件等 */}
          <div>
            <h4 className="text-xs font-semibold text-stone-700 mb-3 uppercase tracking-wider">元信息</h4>
            <div className="grid grid-cols-1 gap-3">
              {metaFields.map(renderField)}
            </div>
          </div>

          {/* GPS */}
          <div>
            <h4 className="text-xs font-semibold text-stone-700 mb-3 uppercase tracking-wider">位置信息</h4>
            <div className="grid grid-cols-2 gap-3">
              {gpsFields.filter(f => f.key !== 'location').map(renderField)}
            </div>
            <div className="mt-3">
              {gpsFields.filter(f => f.key === 'location').map(renderField)}
            </div>
          </div>

          {/* 图片尺寸 */}
          <div>
            <h4 className="text-xs font-semibold text-stone-700 mb-3 uppercase tracking-wider">图片尺寸</h4>
            <div className="grid grid-cols-2 gap-3">
              {sizeFields.map(renderField)}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="text-stone-500 border-stone-200"
          >
            清空
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-stone-200"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-700"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
