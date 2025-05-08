/**
 * 開発モードでのホットリロード機能を提供するモジュール
 * - ファイル変更の監視
 * - プリロードスクリプトの更新
 * - アプリケーションの再起動
 */

import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { isDev } from './constants';

let isQuited = false;
let reloadTimeout: NodeJS.Timeout | null = null;
const abort = new AbortController();
const { signal } = abort;

/**
 * 開発モードでのファイル変更監視とホットリロードを設定する
 * - プリロードスクリプトの変更時はウィンドウのみをリロード
 * - メインプロセスの変更時はアプリケーション全体を再起動
 * - 重複リロードを防ぐために遅延を設定
 */
export async function reloadOnChange() {
  // 開発モードでなければ監視不要
  if (!isDev) {
    return;
  }
  
  // ビルドディレクトリのパスを取得
  const dir = path.join(app.getAppPath(), 'build', 'electron');

  try {
    // ファイル変更の監視を開始
    const watcher = fs.watch(dir, { signal, recursive: true });

    for await (const event of watcher) {
      // 既にアプリが終了している場合は何もしない
      if (isQuited) {
        break;
      }

      // イベントとファイル情報をログに残す
      console.log(`Detected file change: ${event.filename}`);
      
      // 変更が検出されたらリロードを準備（短時間内の複数変更をまとめて処理）
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }

      reloadTimeout = setTimeout(() => {
        reloadTimeout = null;

        // プリロードファイルの変更の場合、ウィンドウのみをリロード
        if (event.filename?.includes('preload')) {
          const windows = BrowserWindow.getAllWindows();
          console.log('Reloading browser windows...');
          windows.forEach(win => {
            if (!win.isDestroyed()) {
              win.webContents.reloadIgnoringCache();
            }
          });
        } 
        // メインプロセスの変更の場合、アプリを再起動
        else {
          console.log('Relaunching application...');
          isQuited = true;
          app.relaunch();
          app.quit();
        }
      }, 500); // 500ms待機して重複リロードを防止
    }
  } catch (err) {
    if (!(err instanceof Error)) {
      throw err;
    }

    // AbortErrorは正常な終了なので無視
    if (err.name === 'AbortError') {
      return;
    }

    console.error('ファイル監視エラー:', err);
  }
}

// アプリ終了時に監視を停止
app.on('quit', () => {
  abort.abort();
  if (reloadTimeout) {
    clearTimeout(reloadTimeout);
  }
});
