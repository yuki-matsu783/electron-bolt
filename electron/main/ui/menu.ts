/**
 * アプリケーションのメニューを管理するモジュール
 */

import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';
import { isDev } from '../utils/constants';

/**
 * アプリケーションのメニューバーを設定する
 * @param win メインウィンドウのインスタンス
 */
export function setupMenu(win: BrowserWindow) {
  /**
   * メニューテンプレートを定義
   * - 開発モード時の追加メニュー
   * - 基本的なアプリケーションメニュー
   * @type {MenuItemConstructorOptions[]}
   */
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Application',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Command+,',
          click: () => {
            win.webContents.send('open-preferences');
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
  ];

  // 開発モード時のメニュー追加
  if (isDev) {
    template.push({
      label: 'Debug',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
