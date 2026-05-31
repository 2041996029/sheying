'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Grid3X3, ArrowRight } from 'lucide-react';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { apiClient } from '@/lib/api-client';
import { motion } from 'framer-motion';

interface CategoryItem {
  id: string;
  name: string;
  coverUrl: string | null;
  autoCover: boolean;
  workCount: number;
  children?: CategoryItem[];
}

export default function CategoryListPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get<CategoryItem[]>('/categories');
        if (res.code === 0 && res.data) {
          setCategories(res.data);
        }
      } catch {
        // Ignore
      }
      setLoading(false);
    };
    fetchCategories();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Grid3X3 className="h-6 w-6 text-primary" />
              作品分类
            </h1>
            <p className="text-sm text-muted-foreground mt-1">浏览不同类别的摄影作品</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">暂无分类</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat, i) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative rounded-xl overflow-hidden cursor-pointer bg-card border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300"
                  onClick={() => router.push(`/category/${cat.id}`)}
                >
                  <div className="h-48 overflow-hidden">
                    {cat.coverUrl ? (
                      <Image
                        src={cat.coverUrl}
                        alt={cat.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-muted flex items-center justify-center">
                        <Grid3X3 className="h-10 w-10 text-primary/40" />
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-semibold text-lg">{cat.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white/70 text-xs">{cat.workCount} 件作品</span>
                      <ArrowRight className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
