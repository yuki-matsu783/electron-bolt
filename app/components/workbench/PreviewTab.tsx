import React from 'react';
import { classNames } from '~/utils/classNames';

/**
 * PreviewTab Component
 * localhost:5174をiframe内に表示するためのタブコンポーネント
 */
export const PreviewTab: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * iframeのロード完了時のハンドラー
   */
  const handleLoad = () => {
    setIsLoading(false);
  };

  /**
   * iframeのエラー発生時のハンドラー
   */
  const handleError = () => {
    setError('プレビューの読み込みに失敗しました。localhost:5174が起動しているか確認してください。');
    setIsLoading(false);
  };

  return (
    <div className="relative h-full w-full">
      {/* ローディング表示 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bolt-background-default">
          <div className="i-ph:spinner animate-spin text-2xl text-bolt-elements-textPrimary" />
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-bolt-background-default">
          <div className="text-bolt-elements-textPrimary">{error}</div>
        </div>
      )}

      {/* プレビューiframe */}
      <iframe
        src="http://localhost:5174"
        className={classNames(
          'h-full w-full border-none',
          {
            'invisible': isLoading,
            'hidden': !!error
          }
        )}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
