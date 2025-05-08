/**
 * メインウィンドウを作成・管理するモジュール
 */

import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { isDev } from '../utils/constants';
import { store } from '../utils/store';

/**
 * メインウィンドウを作成する
 * @param rendererURL レンダラープロセスのURL
 * @returns 作成されたBrowserWindowインスタンス
 */
export async function createWindow(rendererURL: string): Promise<BrowserWindow> {
  console.log('Creating window with URL:', rendererURL);

  // 以前保存されたウィンドウの位置とサイズを復元
  const bounds = store.get('bounds');
  console.log('restored bounds:', bounds);

  /**
   * ウィンドウの基本設定を定義
   * - ウィンドウサイズと位置
   * - 視覚効果
   * - プリロードスクリプト
   */
  const win = new BrowserWindow({
    ...{
      width: 1200,
      height: 800,
      ...bounds,
    },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'build', 'electron', 'preload', 'index.cjs'),
    },
  });

  /**
   * ウィンドウの位置とサイズの変更を監視し保存
   */
  win.on('moved', () => {
    store.set('bounds', win.getBounds());
  });

  win.on('resized', () => {
    store.set('bounds', win.getBounds());
  });

  // 開発モードの場合はDevToolsを開く
  if (isDev) {
    win.webContents.openDevTools();
  }

  await win.loadURL(rendererURL);
  return win;
}
