/**
 * アプリケーションとプレビューのポート管理モジュール
 * - アプリケーションの現在のポートを取得
 * - プレビュー用のポートを計算（アプリポート + 1）
 * - ポート情報をBroadcastChannelで共有
 */

import { useEffect, useState, useRef } from 'react';

const PORT_CHANNEL = 'port-updates';

export function usePortManager() {
  const [appPort, setAppPort] = useState<number | null>(null);
  const [previewPort, setPreviewPort] = useState<number | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel>();

  useEffect(() => {
    // 現在のポートを取得
    const currentPort = window.location.port;
    const portNumber = currentPort ? parseInt(currentPort, 10) : 5173; // デフォルトは5173
    setAppPort(portNumber);
    setPreviewPort(portNumber + 1);

    // BroadcastChannelを初期化
    broadcastChannelRef.current = new BroadcastChannel(PORT_CHANNEL);
    broadcastChannelRef.current.postMessage({
      type: 'port-update',
      appPort: portNumber,
      previewPort: portNumber + 1,
    });

    // 他のタブからのポート更新を監視
    broadcastChannelRef.current.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'port-update') {
        setAppPort(event.data.appPort);
        setPreviewPort(event.data.previewPort);
      }
    };

    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  return { appPort, previewPort };
}
