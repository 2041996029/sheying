'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-8 text-center">
      <h2 className="text-2xl font-semibold text-foreground mb-3">出错了</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        页面加载时发生了错误，请稍后重试
      </p>
      <button
        onClick={reset}
        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
      >
        重试
      </button>
    </div>
  );
}
