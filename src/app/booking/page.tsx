'use client';

import { useState, useEffect } from 'react';
import { Camera, Mail, Phone, MessageSquare, Send, Loader2, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { MarkdownContent } from '@/components/pc/markdown-content';
import { apiClient } from '@/lib/api-client';
import { useConfigStore } from '@/stores/config-store';
import { toast } from 'sonner';

export default function BookingPage() {
  const { configs, fetchConfigs } = useConfigStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 每次进入页面都重新拉取配置（确保获取最新 booking_content）
  useEffect(() => {
    useConfigStore.setState({ isLoaded: false });
    fetchConfigs();
  }, [fetchConfigs]);

  const bookingContent = configs.booking_content;
  const bookingEnabled = configs.booking_enabled !== 'false';
  const bookingCoverImage = configs.booking_cover_image;
  const bookingTitle = configs.booking_title || '预约约拍';
  const bookingSubtitle = configs.booking_subtitle || '让我们记录你的美好瞬间';
  const bookingIntro = configs.booking_intro || '专业的摄影服务，为你记录每一个重要时刻。无论是个人写真、婚纱摄影还是商业拍摄，我们都将用心为你呈现最美的光影。';
  const bookingPrice = configs.booking_price || '具体价格根据拍摄类型和时长而定，详情请咨询。';
  const bookingNotice = configs.booking_notice || '请提前预约，拍摄前请确认好时间地点。如需取消或改期，请至少提前24小时通知。';

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('请填写留言内容');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post('/booking/contact', {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        message: message.trim(),
      });
      if (res.code === 0) {
        toast.success('提交成功');
        setSubmitted(true);
        setName('');
        setEmail('');
        setPhone('');
        setMessage('');
      } else {
        toast.error(res.message || '提交失败');
      }
    } catch {
      toast.error('提交失败，请稍后重试');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-20 pb-12">
        {!bookingEnabled ? (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <Camera className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">约拍功能暂未开放</h1>
            <p className="text-muted-foreground">约拍服务正在筹备中，敬请期待。</p>
          </div>
        ) : (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="relative rounded-2xl overflow-hidden mb-8">
            <img
              src={bookingCoverImage || "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=1920&q=80"}
              alt="约拍"
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{bookingTitle}</h1>
              <p className="text-white/80 text-sm mt-1">{bookingSubtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Booking Info */}
            <div className="space-y-6">
              {bookingContent ? (
                <div className="glass rounded-xl p-6 sm:p-8">
                  <MarkdownContent content={bookingContent} />
                </div>
              ) : (
                <>
                  {/* Introduction */}
                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Camera className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold">关于约拍</h2>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {bookingIntro}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-3">价格说明</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {bookingPrice}
                    </p>
                  </div>

                  {/* Notice */}
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-3">注意事项</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {bookingNotice}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Contact Form */}
            <div className="glass rounded-xl p-6 h-fit sticky top-24">
              <h2 className="text-lg font-semibold mb-4">联系约拍</h2>

              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h3 className="text-lg font-medium">提交成功</h3>
                  <p className="text-sm text-muted-foreground mt-1">我们会尽快联系你</p>
                  <Button
                    variant="outline"
                    className="mt-4 rounded-full"
                    onClick={() => setSubmitted(false)}
                  >
                    继续预约
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name" className="text-xs">姓名</Label>
                    <div className="relative">
                      <Camera className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="contact-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="你的姓名"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email" className="text-xs">邮箱</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="你的邮箱"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone" className="text-xs">手机</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="contact-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="你的手机号"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact-message" className="text-xs">留言 *</Label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        id="contact-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="描述你的拍摄需求..."
                        className="pl-9 min-h-[100px]"
                        rows={4}
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full rounded-full"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    提交预约
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
