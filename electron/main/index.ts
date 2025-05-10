/**
 * Electronアプリケーションのメインエントリーポイント
 * - アプリケーションの初期化
 * - プロトコルハンドラーの設定
 * - サーバービルドのロード
 * - ウィンドウの作成
 * - IPCハンドラーの設定
 */

/// <reference types="vite/client" />
import { createRequestHandler } from '@remix-run/node';
import electron, { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import log from 'electron-log';
import path from 'node:path';
import * as pkg from '../../package.json';
import { setupAutoUpdater } from './utils/auto-update';
import { isDev, DEFAULT_PORT } from './utils/constants';
import { initViteServer, viteServer } from './utils/vite-server';
import { setupMenu } from './ui/menu';
import { createWindow } from './ui/window';
import { initCookies, storeCookies } from './utils/cookie';
import { loadServerBuild, serveAsset } from './utils/serve';
import { reloadOnChange } from './utils/reload';

Object.assign(console, log.functions);

console.debug('main: import.meta.env:', import.meta.env);
console.log('main: isDev:', isDev);
console.log('NODE_ENV:', global.process.env.NODE_ENV);
console.log('isPackaged:', app.isPackaged);

/**
 * 未処理のエラーをログに記録するハンドラー
 */
process.on('uncaughtException', async (error) => {
  console.log('Uncaught Exception:', error);
});

/**
 * 未処理のPromiseリジェクションをログに記録するハンドラー
 */
process.on('unhandledRejection', async (error) => {
  console.log('Unhandled Rejection:', error);
});

/**
 * アプリケーションのパス設定を初期化する
 * - アプリデータディレクトリ
 * - ユーザーデータディレクトリ
 * - セッションデータディレクトリ
 * - ログディレクトリ
 */
(() => {
  const root = global.process.env.APP_PATH_ROOT ?? import.meta.env.VITE_APP_PATH_ROOT;

  if (root === undefined) {
    console.log('no given APP_PATH_ROOT or VITE_APP_PATH_ROOT. default path is used.');
    return;
  }

  if (!path.isAbsolute(root)) {
    console.log('APP_PATH_ROOT must be absolute path.');
    global.process.exit(1);
  }

  console.log(`APP_PATH_ROOT: ${root}`);

  const subdirName = pkg.name;

  for (const [key, val] of [
    ['appData', ''],
    ['userData', subdirName],
    ['sessionData', subdirName],
  ] as const) {
    app.setPath(key, path.join(root, val));
  }

  app.setAppLogsPath(path.join(root, subdirName, 'Logs'));
})();

console.log('appPath:', app.getAppPath());

const keys: Parameters<typeof app.getPath>[number][] = ['home', 'appData', 'userData', 'sessionData', 'logs', 'temp'];
keys.forEach((key) => console.log(`${key}:`, app.getPath(key)));
console.log('start whenReady');

/**
 * ElectronアプリケーションのViteサーバー関連の型定義
 */
declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __electron__: typeof electron;
}

/**
 * アプリケーションの初期化とメインプロセスの設定を行う
 * - アプリケーションの準備完了を待機
 * - クッキーの初期化
 * - サーバービルドのロード
 * - プロトコルハンドラーの設定
 * - レンダラーURLの設定
 * - メインウィンドウの作成
 */
(async () => {
  await app.whenReady();
  console.log('App is ready');

  // Load any existing cookies from ElectronStore, set as cookie
  await initCookies();

  const serverBuild = await loadServerBuild();

  /**
   * プロトコルリクエストを処理するハンドラー
   * @param req プロトコルリクエスト
   * @returns レスポンス
   */
  protocol.handle('http', async (req) => {
    console.log('Handling request for:', req.url);

    if (isDev) {
      console.log('Dev mode: forwarding to vite server');
      return await fetch(req);
    }

    req.headers.append('Referer', req.referrer);

    try {
      const url = new URL(req.url);

      // Forward requests to specific local server ports
      if (url.port !== `${DEFAULT_PORT}`) {
        console.log('Forwarding request to local server:', req.url);
        return await fetch(req);
      }

      // Always try to serve asset first
      const assetPath = path.join(app.getAppPath(), 'build', 'client');
      const res = await serveAsset(req, assetPath);

      if (res) {
        console.log('Served asset:', req.url);
        return res;
      }

      // Forward all cookies to remix server
      const cookies = await session.defaultSession.cookies.get({});

      if (cookies.length > 0) {
        req.headers.set('Cookie', cookies.map((c) => `${c.name}=${c.value}`).join('; '));

        // Store all cookies
        await storeCookies(cookies);
      }

      // Create request handler with the server build
      const handler = createRequestHandler(serverBuild, 'production');
      console.log('Handling request with server build:', req.url);

      const result = await handler(req, {
        /*
         * Remix app access cloudflare.env
         * Need to pass an empty object to prevent undefined
         */
        // @ts-ignore:next-line
        cloudflare: {},
      });

      return result;
    } catch (err) {
      console.log('Error handling request:', {
        url: req.url,
        error:
          err instanceof Error
            ? {
                message: err.message,
                stack: err.stack,
                cause: err.cause,
              }
            : err,
      });

      const error = err instanceof Error ? err : new Error(String(err));

      return new Response(`Error handling request to ${req.url}: ${error.stack ?? error.message}`, {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
    }
  });

  const rendererURL = await (isDev
    ? (async () => {
        await initViteServer();

        if (!viteServer) {
          throw new Error('Vite server is not initialized');
        }

        const listen = await viteServer.listen();
        global.__electron__ = electron;
        viteServer.printUrls();

        return `http://localhost:${listen.config.server.port}`;
      })()
    : `http://localhost:${DEFAULT_PORT}`);

  console.log('Using renderer URL:', rendererURL);

  const win = await createWindow(rendererURL);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(rendererURL);
    }
  });

  console.log('end whenReady');

  return win;
})()
  .then((win) => {
    /**
     * IPCサンプル通信の設定
     * - メインプロセスからレンダラーへの定期的なメッセージ送信
     * - レンダラーからのメッセージ受信ハンドラー
     */
    let count = 0;
    setInterval(() => win.webContents.send('ping', `hello from main! ${count++}`), 60 * 1000);
    ipcMain.handle('ipcTest', (event, ...args) => console.log('ipc: renderer -> main', { event, ...args }));

    return win;
  })
  .then((win) => setupMenu(win));

/**
 * すべてのウィンドウが閉じられた時の処理
 * - macOS以外の場合はアプリケーションを終了
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アプリケーション開始時の初期化処理
reloadOnChange();
setupAutoUpdater();
