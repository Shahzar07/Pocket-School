import { create } from 'zustand';

interface TutorContextState {
  lessonTitle: string | null;
  lessonContext: string | null;
  setLessonContext: (title: string | null, context: string | null) => void;
  clearLessonContext: () => void;
}

export const useTutorContext = create<TutorContextState>((set) => ({
  lessonTitle: null,
  lessonContext: null,
  setLessonContext: (lessonTitle, lessonContext) => set({ lessonTitle, lessonContext }),
  clearLessonContext: () => set({ lessonTitle: null, lessonContext: null }),
}));
