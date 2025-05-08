/**
 * IPC（プロセス間通信）を管理するモジュール
 * メインプロセスとレンダラープロセス間の安全な通信を実現
 */

import { ipcMain } from 'electron';
import { createScopedLogger } from '../../app/utils/logger';

const logger = createScopedLogger('IPC');

/**
 * IPCチャネルの登録を行う
 * - システム情報の取得
 * - ファイル操作
 * - アプリケーション制御
 */
export function setupIPC() {
  // システム情報の取得
  ipcMain.handle('get-system-info', async () => {
    try {
      const info = {
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
        env: process.env
      };
      logger.info('System info retrieved');
      return info;
    } catch (error) {
      logger.error('Failed to get system info:', error);
      throw error;
    }
  });

  // ファイルシステム操作
  ipcMain.handle('read-file', async (_event, filePath: string) => {
    try {
      // ファイル読み込み処理
      logger.info(`Reading file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to read file ${filePath}:`, error);
      throw error;
    }
  });

  // アプリケーション制御
  ipcMain.handle('app-control', async (_event, command: string) => {
    try {
      logger.info(`Executing app control command: ${command}`);
      // アプリケーション制御の処理
    } catch (error) {
      logger.error('Failed to execute app control:', error);
      throw error;
    }
  });
}