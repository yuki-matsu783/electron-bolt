/**
 * Electronアプリケーションの自動更新機能を管理するモジュール
 * - アップデートの確認と通知
 * - ダウンロードの制御
 * - インストールの管理
 */

import logger from 'electron-log';
import type { MessageBoxOptions } from 'electron';
import { app, dialog } from 'electron';
import type { AppUpdater, UpdateDownloadedEvent } from 'electron-updater';
import path from 'node:path';
import * as electronUpdater from 'electron-updater';
import { isDev } from './constants';

// electron-updaterのAutoUpdaterインスタンスを取得
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

  // 自動ダウンロードを無効化（ユーザーの確認を得てからダウンロード）
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  /**
   * アップデートチェック開始時のハンドラー
   */
  autoUpdater.on('checking-for-update', () => {
    logger.info('アップデートの確認を開始...');
  });

  /**
   * アップデート可能バージョン発見時のハンドラー
   * - ユーザーにダウンロードの確認を求める
   */
  autoUpdater.on('update-available', async (info) => {
    logger.info('新しいバージョンが利用可能です:', info);

    const dialogOpts: MessageBoxOptions = {
      type: 'info',
      buttons: ['アップデート', '後で'],
      title: 'アプリケーションアップデート',
      message: `バージョン ${info.version} が利用可能です`,
      detail: '新しいバージョンが利用可能です。今すぐアップデートしますか？',
    };

    const response = await dialog.showMessageBox(dialogOpts);

    if (response.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  /**
   * アップデートが不要な場合のハンドラー
   */
  autoUpdater.on('update-not-available', () => {
    logger.info('利用可能なアップデートはありません');
  });

  /**
   * アップデートのエラー発生時のハンドラー
   */
  autoUpdater.on('error', (error) => {
    logger.error('自動更新でエラーが発生しました:', error);
  });

  /**
   * アップデートのダウンロード進捗ハンドラー
   */
  autoUpdater.on('download-progress', (progressObj) => {
    logger.info('ダウンロード進捗:', progressObj);
  });

  /**
   * アップデートのダウンロード完了ハンドラー
   * - ユーザーに再起動の確認を求める
   */
  autoUpdater.on('update-downloaded', async (event: UpdateDownloadedEvent) => {
    logger.info('アップデートのダウンロードが完了しました:', formatUpdateDownloadedEvent(event));

    const dialogOpts: MessageBoxOptions = {
      type: 'info',
      buttons: ['再起動', '後で'],
      title: 'アプリケーションアップデート',
      message: 'アップデートのダウンロードが完了しました',
      detail: 'アプリケーションを再起動して、アップデートを適用します。',
    };

    const { response } = await dialog.showMessageBox(dialogOpts);
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // 初回のアップデートチェックを実行
  try {
    logger.info('アップデートの確認を開始。現在のバージョン:', app.getVersion());
    await autoUpdater.checkForUpdates();
  } catch (err) {
    logger.error('アップデートの確認に失敗しました:', err);
  }

  // 定期的なアップデートチェックを設定（4時間ごと）
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.error('定期的なアップデートチェックに失敗しました:', err);
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
