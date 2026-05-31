export type SlideDirection = 'left' | 'right';

export interface ImageNavState {
  currentIndex: number;
  total: number;
  direction: SlideDirection;
}

export interface ActionBarState {
  liked: boolean;
  favorited: boolean;
  likeCount: number;
  favoriteCount: number;
}
