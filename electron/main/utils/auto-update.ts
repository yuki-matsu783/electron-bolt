/**
 * Electronアプリケーションの自動更新機能を管理するモジュール
 */

import logger from 'electron-log';
import type { MessageBoxOptions } from 'electron';
import { app, dialog } from 'electron';
import type { AppUpdater, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import path from 'node:path';

// NOTE: workaround to use electron-updater.
import * as electronUpdater from 'electron-updater';
import { isDev } from './constants';

const autoUpdater: AppUpdater = (electronUpdater as any).default.autoUpdater;

/**
 * アプリケーションの自動更新機能をセットアップする
 * - ロガーの設定
 * - アップデート設定ファイルの読み込み
 * - アップデートイベントのハンドラー設定
 */
export async function setupAutoUpdater() {
  // ロガーの設定
  logger.transports.file.level = 'debug';
  autoUpdater.logger = logger;

  // アップデート設定ファイルのパス設定
  const resourcePath = isDev
    ? path.join(process.cwd(), 'electron-update.yml')
    : path.join(app.getAppPath(), 'electron-update.yml');
  logger.info('Update config path:', resourcePath);
  autoUpdater.updateConfigPath = resourcePath;

  // Disable auto download - we want to ask user first
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    logger.info('checking-for-update...');
  });

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    logger.info('Update available.', info);

    const dialogOpts: MessageBoxOptions = {
      type: 'info' as const,
      buttons: ['Update', 'Later'],
      title: 'Application Update',
      message: `Version ${info.version} is available.`,
      detail: 'A new version is available. Would you like to update now?',
    };

    const response = await dialog.showMessageBox(dialogOpts);

    if (response.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('Update not available.');
  });

  /**
   * アップデートのエラーハンドラー
   */
  autoUpdater.on('error', (error) => {
    logger.error('Error in auto-updater:', error);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.info('Download progress:', progressObj);
  });

  /**
   * アップデートのダウンロード完了ハンドラー
   */
  autoUpdater.on('update-downloaded', async (event: UpdateDownloadedEvent) => {
    logger.info('Update downloaded:', formatUpdateDownloadedEvent(event));

    const dialogOpts: MessageBoxOptions = {
      type: 'info',
      buttons: ['再起動', '後で'],
      title: 'アプリケーションアップデート',
      message: 'アップデートがダウンロードされました',
      detail: 'アプリケーションを再起動して、アップデートを適用します。',
    };

    const { response } = await dialog.showMessageBox(dialogOpts);
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // Check for updates
  try {
    logger.info('Checking for updates. Current version:', app.getVersion());
    await autoUpdater.checkForUpdates();
  } catch (err) {
    logger.error('Failed to check for updates:', err);
  }

  // Set up periodic update checks (every 4 hours)
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.error('Periodic update check failed:', err);
      });
    },
    4 * 60 * 60 * 1000,
  );
}

/**
 * アップデートイベントの情報をJSON形式に変換する
 * @param event アップデートのダウンロード完了イベント
 * @returns JSON形式のアップデート情報
 */
function formatUpdateDownloadedEvent(event: UpdateDownloadedEvent): string {
  return JSON.stringify({
    version: event.version,
    downloadedFile: event.downloadedFile,
    files: event.files.map((e) => ({ files: { url: e.url, size: e.size } })),
  });
}
