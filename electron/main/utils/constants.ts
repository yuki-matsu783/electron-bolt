import { app } from 'electron';

// ELECTRON_IS_DEV環境変数を優先的に使用し、ない場合は従来のロジックを使用
export const isDev = 
  process.env.ELECTRON_IS_DEV === '1' || 
  !(global.process.env.NODE_ENV === 'production' || app.isPackaged);

export const DEFAULT_PORT = 5173;
