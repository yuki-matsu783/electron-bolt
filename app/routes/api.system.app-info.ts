/**
 * アプリケーションシステム情報を提供するAPI
 * - アプリケーションバージョン
 * - パッケージ情報
 * - Git情報
 * - 依存関係
 */

import type { ActionFunctionArgs, LoaderFunction } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

// Viteによって注入される環境変数
declare const __APP_VERSION: string;
declare const __PKG_NAME: string;
declare const __PKG_DESCRIPTION: string;
declare const __PKG_LICENSE: string;
declare const __PKG_DEPENDENCIES: Record<string, string>;
declare const __PKG_DEV_DEPENDENCIES: Record<string, string>;
declare const __PKG_PEER_DEPENDENCIES: Record<string, string>;
declare const __PKG_OPTIONAL_DEPENDENCIES: Record<string, string>;
declare const __COMMIT_HASH: string;
declare const __GIT_BRANCH: string;
declare const __GIT_COMMIT_TIME: string;
declare const __GIT_AUTHOR: string;
declare const __GIT_EMAIL: string;
declare const __GIT_REMOTE_URL: string;
declare const __GIT_REPO_NAME: string;

/**
 * Gitリポジトリの情報を取得
 * @returns Gitリポジトリの詳細情報
 */
const getGitInfo = () => {
  return {
    commitHash: __COMMIT_HASH || 'unknown',
    branch: __GIT_BRANCH || 'unknown',
    commitTime: __GIT_COMMIT_TIME || 'unknown',
    author: __GIT_AUTHOR || 'unknown',
    email: __GIT_EMAIL || 'unknown',
    remoteUrl: __GIT_REMOTE_URL || 'unknown',
    repoName: __GIT_REPO_NAME || 'unknown',
  };
};

/**
 * パッケージの依存関係情報を取得
 * @returns 各種依存パッケージの情報
 */
const getDependencies = () => {
  return {
    dependencies: __PKG_DEPENDENCIES || {},
    devDependencies: __PKG_DEV_DEPENDENCIES || {},
    peerDependencies: __PKG_PEER_DEPENDENCIES || {},
    optionalDependencies: __PKG_OPTIONAL_DEPENDENCIES || {},
  };
};

/**
 * システム情報全体を構築して返す
 * @returns アプリケーションの完全なシステム情報
 */
const getAppInfo = () => {
  return {
    name: __PKG_NAME || 'unknown',
    version: __APP_VERSION || 'unknown',
    description: __PKG_DESCRIPTION || '',
    license: __PKG_LICENSE || 'unknown',
    git: getGitInfo(),
    dependencies: getDependencies(),
  };
};

/**
 * GETリクエストのハンドラー
 * システム情報を取得して返す
 */
export const loader: LoaderFunction = async ({ request: _request }) => {
  try {
    return json(getAppInfo());
  } catch (error) {
    console.error('Failed to get app info:', error);
    return json({ error: 'Failed to get app info' }, { status: 500 });
  }
};

/**
 * POSTリクエストのハンドラー
 * システム情報の更新を処理（現在は読み取り専用）
 */
export const action = async ({ request: _request }: ActionFunctionArgs) => {
  try {
    return json(getAppInfo());
  } catch (error) {
    console.error('Failed to get app info:', error);
    return json({ error: 'Failed to get app info' }, { status: 500 });
  }
};
