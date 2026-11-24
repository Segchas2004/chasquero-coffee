import { createContext, useContext } from 'react';
import type { Data, User, EditorSpec, Range } from './types';
export type AppContextValue = {
  data: Data; user: User; range: Range; setRange: (r: Range) => void;
  open: (spec: EditorSpec) => void; close: () => void;
  command: (type: string, payload: any, requestId: string) => Promise<void>;
  notify: (message: string) => void; refresh: () => Promise<void>;
};
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error('Falta el contexto de aplicación'); return ctx; }
