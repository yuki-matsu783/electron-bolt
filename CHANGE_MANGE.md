# 変更管理ログ

## 2025-05-10: WebContainerからOPFSへの移行 - ファイルシステム実装

### 背景
#### 現状の分析
- WebContainerは外部サービスに依存しており、インターネット接続が必要
- `@webcontainer/api`パッケージを通じてファイルシステムを提供
- プレビュー機能も外部ドメイン（webcontainer-api.io）に依存

#### 課題点
- インターネット接続が必要なため、オフライン環境での利用が制限される
- 外部サービスの可用性に依存するため、安定性に課題
- パフォーマンスオーバーヘッドが存在

### 目的
- WebContainerの依存を削除し、Origin Private File System (OPFS)を使用したファイルシステム実装への移行
- より軽量で効率的なファイルシステム操作の実現
- ブラウザネイティブのAPIを活用した安定性の向上
- オフライン環境でも利用可能なアーキテクチャの実現

### 期待される効果
- インターネット接続への依存性の排除
- パフォーマンスの向上（中間レイヤーの削減）
- ブラウザネイティブAPIによる安定性の向上
- オフライン環境での完全な機能提供
- 将来的な拡張性の確保

### 実装内容

#### 1. ディレクトリ構造
```
app/lib/filesystem/
├── interfaces/
│   ├── FileSystemService.ts    # メインインターフェース
│   ├── types.ts               # 共通型定義
│   └── file-system-handle.d.ts # OPFS API型定義
├── errors/
│   └── FileSystemError.ts     # カスタムエラー
└── opfs/
    ├── OPFSService.ts         # OPFS実装
    └── utils/
        ├── path.ts           # パス操作ユーティリティ
        └── opfs.ts           # OPFS操作ユーティリティ
```

#### 2. 主要コンポーネント

##### FileSystemService インターフェース
- ファイルシステム操作の標準インターフェースを定義
- 基本的なファイル操作（作成、読み取り、書き込み、削除）
- ディレクトリ操作（作成、一覧取得、削除）
- ストリーミング操作のサポート
- 明確な型定義と例外処理

##### OPFSService 実装
- FileSystemServiceインターフェースのOPFS実装
- ブラウザのOrigin Private File System APIを利用
- 非同期操作の効率的な処理
- 詳細なエラーハンドリング

##### エラー処理
- FileSystemErrorクラスによる統一的なエラーハンドリング
- エラー種別の明確な分類
- スタックトレースの保持
- エラーメッセージの多言語対応

##### ユーティリティ関数
- パス操作（正規化、結合、分割など）
- OPFSハンドル管理
- パーミッション制御
- ストリーム操作のサポート

### 主な機能

1. ファイル操作
   - ファイルの作成・読み取り・書き込み・削除
   - バイナリデータのサポート
   - ストリーミング操作
   - ファイル情報の取得

2. ディレクトリ操作
   - ディレクトリの作成・削除
   - 再帰的な操作のサポート
   - ディレクトリ内容の列挙
   - パス解決と正規化

3. セキュリティ機能
   - パーミッション管理
   - エラーハンドリング
   - パス検証
   - クォータ管理

4. パフォーマンス最適化
   - 非同期操作の効率的な処理
   - ストリーミング処理による大容量ファイルの扱い
   - キャッシュ制御

### 型定義の拡張

1. OPFS API型定義
   ```typescript
   interface FileSystemHandle {
     readonly kind: 'file' | 'directory';
     readonly name: string;
     isSameEntry(other: FileSystemHandle): Promise<boolean>;
     queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
     requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
   }

   interface FileSystemFileHandle extends FileSystemHandle {
     readonly kind: 'file';
     getFile(): Promise<File>;
     createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
   }

   interface FileSystemDirectoryHandle extends FileSystemHandle {
     readonly kind: 'directory';
     entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
     keys(): AsyncIterableIterator<string>;
     values(): AsyncIterableIterator<FileSystemHandle>;
     getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
     getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
     removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
   }
   ```

2. 基本型
   ```typescript
   type FilePath = string;
   type FileContent = string | Uint8Array;
   ```

2. インターフェース
   ```typescript
   interface FileInfo {
     name: string;
     path: string;
     type: 'file' | 'directory';
     size?: number;
     modified?: number;
     created?: number;
   }

   interface FileSystemCapabilities {
     canCreateFiles: boolean;
     canCreateDirectories: boolean;
     canDelete: boolean;
     canMove: boolean;
     canCopy: boolean;
     maxFileSize?: number;
     availableSpace?: number;
     persistenceSupported?: boolean;
     streamingSupported?: boolean;
     binarySupported?: boolean;
   }
   ```

### 今後の課題

1. パフォーマンス最適化
   - 大規模ディレクトリの処理効率化
   - キャッシュ戦略の実装
   - メモリ使用量の最適化

2. 機能拡張
   - ファイル監視機能の実装
   - メタデータの拡張
   - 検索機能の強化

3. エラーハンドリング
   - より詳細なエラー情報の提供
   - リカバリー機能の実装
   - エラーログの強化

### 移行手順

1. 既存のWebContainer依存の分析
   - WebContainerのファイルシステム操作の特定
   - 依存関係の調査（@webcontainer/api）
   - プレビュー機能の依存関係確認

2. OPFSベースシステムの実装
   - ファイルシステムインターフェースの定義
   - OPFS実装の開発
   - ユーティリティ関数の実装
   - エラーハンドリングの実装

3. 段階的な移行計画
   Phase 1: ファイルシステム基盤の移行
   - OPFSServiceの実装と検証
   - 基本的なファイル操作の移行
   - エラーハンドリングの整備

   Phase 2: プレビュー機能の再実装
   - Service Workerベースのプレビュー機能
   - ローカルサーバー機能の実装
   - プレビューUIの更新

   Phase 3: 完全移行とクリーンアップ
   - WebContainer依存の完全除去
   - 設定やメタデータの移行
   - 不要なコードの削除

4. テスト戦略
   - ユニットテストの作成と実行
   - 互換性テストの実施
   - パフォーマンステストの実施
   - エラーケースのテスト
   - ブラウザ互換性テスト

5. 展開計画
   - ステージング環境での検証
   - ベータテスターへの提供
   - 段階的なロールアウト
   - モニタリングとフィードバック収集

### 注意点

- ブラウザの互換性確認が必要
- 大容量ファイル処理の制限に注意
- パーミッション管理の重要性
- エラーハンドリングの徹底

### 参考リンク

- [Origin Private File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
