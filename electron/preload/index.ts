/**
 * Electronプリロードスクリプト
 * メインプロセスとレンダラープロセス間の安全な通信を提供
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * レンダラープロセスで利用可能なAPIをexpose
 * - メインプロセスとの通信用IPC
 * - システム情報の取得
 * - バージョン情報
 */
contextBridge.exposeInMainWorld('electron', {
  /**
   * IPCテスト用の関数
   * @param message 送信するメッセージ
   * @returns Promise<void>
   */
  ipcTest: async (message: string) => {
    return await ipcRenderer.invoke('ipcTest', message);
  },

  /**
   * メインプロセスからのメッセージを受信するイベントリスナー
   * @param callback メッセージを受け取るコールバック関数
   */
  onPing: (callback: (message: string) => void) => {
    ipcRenderer.on('ping', (_event, message) => callback(message));
  },

  /**
   * プラットフォーム情報を取得
   * @returns プラットフォーム名（win32, darwin, linux等）
   */
  getPlatform: () => process.platform,
});
