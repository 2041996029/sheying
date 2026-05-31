'use client';

import { motion } from 'framer-motion';
import { Heart, Star, Share2 } from 'lucide-react';

interface FloatingActionBarProps {
  liked: boolean;
  favorited: boolean;
  likeCount: number;
  favoriteCount: number;
  onLike: () => void;
  onFavorite: () => void;
  onShare: () => void;
}

export function FloatingActionBar({
  liked, favorited, likeCount, favoriteCount, onLike, onFavorite, onShare,
}: FloatingActionBarProps) {
  const buttons = (
    <>
      <motion.button
        onClick={onLike}
        className={`p-3 rounded-full transition-colors ${liked ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="contents">
          <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
          {likeCount > 0 && <span className="text-xs ml-1">{likeCount}</span>}
        </span>
      </motion.button>
      <motion.button
        onClick={onFavorite}
        className={`p-3 rounded-full transition-colors ${favorited ? 'bg-amber/15 text-amber' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="contents">
          <Star className={`h-5 w-5 ${favorited ? 'fill-current' : ''}`} />
          {favoriteCount > 0 && <span className="text-xs ml-1">{favoriteCount}</span>}
        </span>
      </motion.button>
      <motion.button
        onClick={onShare}
        className="p-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Share2 className="h-5 w-5" />
      </motion.button>
    </>
  );

  return (
    <>
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col gap-3 glass rounded-2xl p-2">
        {buttons}
      </div>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-border/30 px-4 py-2 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="flex items-center justify-around gap-2">
          {buttons}
        </div>
      </div>
    </>
  );
}
