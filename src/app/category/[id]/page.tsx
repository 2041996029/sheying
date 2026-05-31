'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { WorkGrid, type WorkCardData } from '@/components/pc/work-grid';
import { apiClient } from '@/lib/api-client';

interface CategoryInfo {
  id: string;
  name: string;
}

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.id as string;
  const [works, setWorks] = useState<WorkCardData[]>([]);
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch categories to get name
        const catRes = await apiClient.get<CategoryInfo[]>('/categories');
        if (catRes.code === 0 && catRes.data) {
          const cat = catRes.data.find((c) => c.id === categoryId);
          if (cat) setCategory(cat);
        }

        // Fetch works
        const res = await apiClient.get<{ list: WorkCardData[]; total: number }>(
          `/works?category_id=${categoryId}&page=1&page_size=20&sort=latest`
        );
        if (res.code === 0 && res.data) {
          setWorks(res.data.list);
          setTotal(res.data.total);
        }
      } catch {
        // Ignore
      }
      setLoading(false);
    };

    if (categoryId) {
      fetchData();
    }
  }, [categoryId]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    try {
      const res = await apiClient.get<{ list: WorkCardData[]; total: number }>(
        `/works?category_id=${categoryId}&page=${nextPage}&page_size=20&sort=latest`
      );
      if (res.code === 0 && res.data) {
        setWorks((prev) => [...prev, ...res.data.list]);
        setPage(nextPage);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold">{category?.name || '分类作品'}</h1>
            <p className="text-sm text-muted-foreground mt-1">共 {total} 件作品</p>
          </div>

          <WorkGrid works={works} loading={loading} />

          {!loading && works.length < total && (
            <div className="flex justify-center mt-8">
              <Button variant="outline" onClick={handleLoadMore} className="rounded-full px-8">
                加载更多
              </Button>
            </div>
          )}

          {!loading && works.length > 0 && works.length >= total && (
            <div className="text-center mt-8 text-sm text-muted-foreground">
              已显示全部作品
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
