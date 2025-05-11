# 開発環境ガイド

## はじめに

このドキュメントでは、本アプリケーションの開発環境について説明します。Remix、Electron、およびホスティング環境での動作の違いを理解することで、効率的な開発が可能になります。

## Remixとは

Remixは、React製のフルスタックWebフレームワークです。以下の特徴を持っています：

1. **フルスタック開発**
   - フロントエンド（ブラウザで動作）とバックエンド（サーバーで動作）の両方のコードを1つのプロジェクトで管理
   - TypeScriptによる型安全な開発

2. **ファイル構成**
   ```
   app/
   ├── entry.client.tsx  # クライアントサイドのエントリーポイント
   ├── entry.server.tsx  # サーバーサイドのエントリーポイント
   ├── root.tsx         # アプリケーションのルート要素
   └── routes/          # ルーティング用のコンポーネント
   ```

3. **参考ドキュメント**
   - [Remix 公式ドキュメント](https://remix.run/docs/en/main)
   - [Remix チュートリアル](https://remix.run/docs/en/main/tutorials/blog)
   - [Remix Stacks](https://remix.run/stacks) - スターター用テンプレート集

## サーバーサイドレンダリング（SSR）とHydration

### SSRの基本的な流れ

1. **サーバーサイドでのレンダリング**
   ```
   ブラウザ → サーバー
            ↓
   Reactコンポーネントをレンダリング
            ↓
   静的なHTMLを生成
            ↓
   ブラウザにHTMLを返却
   ```

2. **Hydrationとは**
   - 「水分補給」という意味の言葉から来ています
   - サーバーから送られた「静的な」HTMLに「動的な」機能を付加する処理
   ```
   静的なHTML
      ↓
   JavaScriptを読み込み
      ↓
   イベントリスナーの追加
      ↓
   状態管理の初期化
      ↓
   インタラクティブなアプリとして利用可能
   ```
   
　　参考：
   https://zenn.dev/ak/articles/dd60f8b1712628

### 実装例
```typescript
// entry.client.tsx - クライアントサイドの初期化
import { RemixBrowser } from '@remix-run/react';
import { hydrateRoot } from 'react-dom/client';

hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
```

## 開発環境の種類と特徴

### 1. 通常の開発モード（`pnpm dev`）

```bash
pnpm dev
```

このコマンドで以下が起動します：
- Vite開発サーバー: ファイルの変更を検知して自動的にリロード
- Remixサーバー: SSRを担当

#### 動作の流れ
```
[ブラウザ] → [Vite開発サーバー + Remixサーバー（localhost）] → [LLM API]
```

#### 特徴
- ホットリロード: ファイルを保存すると自動的に変更が反映
- 開発者ツール: エラーメッセージやデバッグ情報が表示
- ローカル完結: インターネット接続なしで基本機能が動作

### 2. Electron開発モード（`pnpm electron:dev`）

```bash
pnpm electron:dev
```

#### 起動される3つのプロセス
1. **フロントエンド開発サーバー** (`pnpm dev`)
   - Remixアプリケーションの開発サーバー
   - UIの変更を即時反映

2. **メインプロセスの監視** (`electron:dev:main`)
   - Electronのメインプロセスをビルド
   - `--watch`モードで変更を検知

3. **プリロードスクリプトの監視** (`electron:dev:preload`)
   - プリロードスクリプトをビルド
   - `--watch`モードで変更を検知

#### 変更の反映方法
| 変更の種類 | 反映方法 | 備考 |
|------------|----------|-------|
| UI（React） | 即時反映 | ホットリロードが動作 |
| メインプロセス | 要再起動 | アプリケーションの再起動が必要 |
| プリロード | 要再起動 | アプリケーションの再起動が必要 |

## デプロイメント環境

### 1. Electron版（デスクトップアプリケーション）

#### ビルドコマンド
```bash
# macOS用ビルド
pnpm electron:build:mac

# Windows用ビルド
pnpm electron:build:win

# Linux用ビルド
pnpm electron:build:linux
```

#### 特徴
- ローカルで完結した動作
- オフライン対応
- ネイティブ機能の利用
- システムリソースへのアクセス

### 2. Cloudflare Pages（Webアプリケーション）

#### デプロイコマンド
```bash
pnpm deploy
```

#### 特徴
- グローバルなCDN
- 高可用性
- スケーラビリティ
- エッジでの実行

## サーバーサイドレンダリングの実装の違い

### Electron版

```
[Electronブラウザ] → [ローカルサーバー（Electronメインプロセス）]
                           ↓
                    HTMLレンダリング
                           ↓
                    LLMとの通信
```

- メインプロセスがサーバーの役割
- ローカルで完結した処理
- オフライン動作可能

### Cloudflare Pages版

```
[ブラウザ] → [Cloudflare Workers]
                    ↓
             HTMLレンダリング
                    ↓
             LLMとの通信
```

- Cloudflare Workersがサーバーの役割
- グローバルな分散処理
- インターネット接続が必要

## 開発時の注意点

### 1. 環境変数の設定
- `.env.example`を参考に`.env`ファイルを作成
- 開発モードとプロダクションモードで異なる設定が必要な場合あり

### 2. パフォーマンス最適化
- 開発モードではホットリロードが有効
- プロダクションビルドでは最適化が適用

### 3. デバッグのコツ
- Remix Dev Toolsを活用（開発モードで自動的に有効）
- ChromeのDevToolsでネットワークタブを確認
- エラーメッセージをよく読む

### 4. ディレクトリ構造のベストプラクティス
```
app/
├── components/  # 再利用可能なコンポーネント
├── routes/      # ページコンポーネント
├── styles/      # スタイルシート
└── utils/       # ユーティリティ関数
```

## トラブルシューティング

1. **ホットリロードが効かない場合**
   - Vite開発サーバーが正常に起動しているか確認
   - ファイルの保存が正しく行われているか確認

2. **ビルドエラーが発生した場合**
   - エラーメッセージを確認
   - 依存関係のバージョンを確認
   - `pnpm clean`を実行して再度試す

3. **Electron開発で変更が反映されない場合**
   - アプリケーションを完全に終了して再起動
   - `pnpm clean`を実行してキャッシュをクリア

## 便利なコマンド集

```bash
# 開発サーバーの起動
pnpm dev          # 通常の開発モード
pnpm electron:dev # Electron開発モード

# ビルド
pnpm build              # Webアプリケーション用ビルド
pnpm electron:build:mac # Mac用Electronアプリのビルド

# その他
pnpm clean   # ビルドキャッシュのクリーン
pnpm preview # ビルド後のプレビュー
```

## コードリーディングガイド

初学者がこのアプリケーションのコードを理解するための推奨読解順序：

1. **アプリケーションのエントリーポイント**
   - `app/root.tsx` - アプリケーションのルート要素、全体の構造
   - `app/entry.client.tsx` - クライアントサイドの初期化処理
   - `app/entry.server.tsx` - サーバーサイドレンダリングの実装

2. **メインページとルーティング**
   - `app/routes/_index.tsx` - トップページの実装
   - `app/routes/chat.$id.tsx` - チャット機能の実装

3. **共通コンポーネント**
   - `app/components/chat/` - チャット関連のコンポーネント
   - `app/components/ui/` - 共通UIコンポーネント

4. **Electron関連**
   - `electron/main/index.ts` - Electronメインプロセス
   - `scripts/electron-dev-runner.js` - 開発環境の設定

## 主要な機能の実装箇所

### 1. サーバーサイドレンダリングとHydration
```typescript
// app/entry.server.tsx - サーバーサイドレンダリング
export default async function handleRequest(request: Request, ...) {
  const readable = await renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} />
  );
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

// app/entry.client.tsx - クライアントサイドhydration
hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
```

### 2. Electronでのサーバー機能
```typescript
// electron/main/index.ts
protocol.handle('http', async (req) => {
  const serverBuild = await loadServerBuild();
  const handler = createRequestHandler(serverBuild, 'production');
  return await handler(req, { cloudflare: {} });
});
```

### 3. ホットリロード機能
```typescript
// scripts/electron-dev-runner.js
async function waitForDevServer() {
  const ports = [5173, 5174, 5175];
  console.log('Waiting for development server...');
  
  for (let i = 0; i < 60; i++) {
    for (const port of ports) {
      if (await isServerListening(port)) {
        console.log(`Development server detected on port ${port}`);
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// vite.config.ts
export default defineConfig({
  // ...
  plugins: [
    remixVitePlugin({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
      },
    }),
    // ...その他のプラグイン
  ],
});
```

## 参考資料

- [Remix 公式ドキュメント](https://remix.run/docs/en/main)
- [Electron 公式ドキュメント](https://www.electronjs.org/docs/latest/)
- [Vite 公式ドキュメント](https://vitejs.dev/guide/)
- [React 公式ドキュメント](https://react.dev/)
