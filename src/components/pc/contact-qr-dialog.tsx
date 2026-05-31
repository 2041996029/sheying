'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MessageSquare, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ContactQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'wechat' | 'qq';
  id: string;
  qrUrl?: string;
}

export function ContactQRDialog({ open, onOpenChange, type, id, qrUrl }: ContactQRDialogProps) {
  const [copied, setCopied] = useState(false);
  const label = type === 'wechat' ? '微信' : 'QQ';
  const iconColor = type === 'wechat' ? 'text-emerald-500' : 'text-blue-500';
  const bgColor = type === 'wechat' ? 'bg-emerald-500/10' : 'bg-blue-500/10';
  const borderColor = type === 'wechat' ? 'border-emerald-500/20' : 'border-blue-500/20';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl p-0 overflow-hidden">
        <div className="p-6 pt-5">
          <DialogHeader className="items-center mb-5">
            {/* 图标 */}
            <div className={`w-14 h-14 rounded-2xl ${bgColor} border ${borderColor} flex items-center justify-center mb-3`}>
              {type === 'wechat' ? (
                <MessageSquare className={`w-6 h-6 ${iconColor}`} />
              ) : (
                <svg viewBox="0 0 24 24" className={`w-6 h-6 ${iconColor}`} fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 13.24c-.18.53-.5.98-.93 1.33.16.2.26.45.26.73 0 .35-.16.66-.41.87.05.12.08.25.08.39 0 .45-.29.83-.69.97.02.09.03.18.03.28 0 .6-.42 1.1-.98 1.24-.18.63-.76 1.09-1.45 1.09-.37 0-.71-.13-.98-.36-.27.23-.61.36-.98.36-.69 0-1.27-.46-1.45-1.09-.56-.14-.98-.64-.98-1.24 0-.1.01-.19.03-.28-.4-.14-.69-.52-.69-.97 0-.14.03-.27.08-.39-.25-.21-.41-.52-.41-.87 0-.28.1-.53.26-.73-.43-.35-.75-.8-.93-1.33C5.75 14.63 5 12.93 5 11c0-3.87 3.13-7 7-7s7 3.13 7 7c0 1.93-.75 3.63-2.36 4.24z"/>
                </svg>
              )}
            </div>
            <DialogTitle className="text-center text-lg">
              {type === 'wechat' ? '添加微信' : '添加QQ'}
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              扫描二维码或复制{label}号添加联系
            </DialogDescription>
          </DialogHeader>

          {/* 二维码区域 */}
          {qrUrl ? (
            <div className="flex justify-center mb-5">
              <div className="w-48 h-48 rounded-xl border border-border/30 bg-white p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={qrUrl}
                  alt={`${label}二维码`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `
                      <div class="flex flex-col items-center justify-center text-gray-400">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
                        <span class="text-xs mt-2">二维码加载失败</span>
                      </div>
                    `;
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-5">
              <div className="w-48 h-48 rounded-xl border border-dashed border-border/40 bg-muted/30 flex flex-col items-center justify-center text-muted-foreground">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
                <span className="text-xs mt-2">暂未上传二维码</span>
              </div>
            </div>
          )}

          {/* ID号 + 复制按钮 */}
          {id && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/20">
              <span className="text-sm font-mono text-foreground tracking-wider">{id}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title={`复制${label}号`}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
