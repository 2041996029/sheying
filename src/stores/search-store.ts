import { create } from 'zustand';

interface SearchState {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  dialogOpen: false,
  setDialogOpen: (open) => set({ dialogOpen: open }),
}));
