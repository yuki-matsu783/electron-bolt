// @ts-check
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// ビルドディレクトリのパス
const buildDir = path.join(projectRoot, 'build/electron/main');

// Electronプロセスの管理
let electronProcess = null;
let startupDelay = 2000; // 初回は少し長めに待つ
let restartTimeout = null;

/**
 * Electronプロセスを起動する
 */
function startElectron() {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }

  if (electronProcess) {
    electronProcess.kill();
    electronProcess = null;
    // 再起動の場合は待ち時間を短くする
    startupDelay = 500;
  }

  console.log('📦 Starting Electron process...');
  
  // アプリを開発モードで起動
  restartTimeout = setTimeout(() => {
    const mainFile = path.join(buildDir, 'index.mjs');
    
    // ファイルが存在するか確認
    if (!fs.existsSync(mainFile)) {
      console.error(`❌ Main process file not found: ${mainFile}`);
      console.log('⏱️ Waiting for build to complete...');
      return;
    }
    
    // Electron起動
    const env = { ...process.env, ELECTRON_IS_DEV: '1' };
    electronProcess = spawn('electron', [mainFile], {
      stdio: 'inherit',
      env
    });
    
    console.log('✅ Electron started!');

    electronProcess.on('close', (code) => {
      if (code === null || code === 0) {
        console.log('🔁 Electron process exited cleanly.');
      } else {
        console.error(`❌ Electron process exited with code ${code}`);
      }
      electronProcess = null;
    });
  }, startupDelay);
}

/**
 * ビルドディレクトリを監視
 */
function watchBuildDir() {
  console.log(`👀 Watching for changes in: ${buildDir}`);
  
  fs.watch(buildDir, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.mjs') || filename.endsWith('.cjs'))) {
      console.log(`🔄 Detected change in ${filename}, restarting Electron...`);
      startElectron();
    }
  });
}

// エラーハンドリング
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('SIGINT', () => {
  if (electronProcess) {
    electronProcess.kill();
  }
  process.exit(0);
});

// メインプロセスの監視開始
console.log('🚀 Starting Electron development mode...');

// buildディレクトリが存在するか確認
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// 監視開始と初回起動
watchBuildDir();
startElectron();