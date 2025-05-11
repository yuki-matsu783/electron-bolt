import { spawn } from 'child_process';
import electron from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import fetch from 'node-fetch';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MAIN_FILE_PATH = join(__dirname, '../build/electron/main/index.mjs');

/**
 * サーバーがポートをリッスンしているかチェック
 * @param {number} port ポート番号
 * @returns {Promise<boolean>} サーバーが起動している場合はtrue
 */
async function isServerListening(port) {
  try {
    const response = await fetch(`http://localhost:${port}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * 開発サーバーの準備完了を待機
 * @returns {Promise<void>}
 */
async function waitForDevServer() {
  const ports = [5173, 5174, 5175]; // viteが試行する可能性のあるポート
  console.log('Waiting for development server...');
  
  for (let i = 0; i < 60; i++) { // 60秒までは待機（長めに設定）
    for (const port of ports) {
      if (await isServerListening(port)) {
        console.log(`Development server detected on port ${port}`);
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Development server did not start within 60 seconds');
}

/**
 * メインプロセスのビルド完了を待機
 * @returns {Promise<void>}
 */
async function waitForMainBuild() {
  for (let i = 0; i < 30; i++) { // 30秒までは待機
    if (existsSync(MAIN_FILE_PATH)) {
      console.log('Main process build detected');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Main process build did not complete within 30 seconds');
}

/**
 * Electronアプリケーションを起動
 */
function startElectron() {
  const electronProcess = spawn(electron, [MAIN_FILE_PATH], {
    stdio: 'inherit'
  });

  electronProcess.on('exit', (code) => {
    if (code === 0) {
      console.log('Electron process exited successfully');
    } else {
      console.error(`Electron process exited with code ${code}`);
    }
    process.exit(code);
  });

  // エラーハンドリング
  electronProcess.on('error', (err) => {
    console.error('Failed to start electron process:', err);
    process.exit(1);
  });

  // SIGINT (Ctrl+C) のハンドリング
  process.on('SIGINT', () => {
    electronProcess.kill();
    process.exit(0);
  });
}

console.log('Starting Electron in development mode...');
console.log('Main process path:', MAIN_FILE_PATH);

// ビルドと開発サーバーの準備が整ってからElectronを起動
Promise.all([
  waitForMainBuild(),
  waitForDevServer()
])
.then(() => {
  console.log('All prerequisites are ready, starting Electron...');
  startElectron();
})
.catch((error) => {
  console.error('Failed to start development environment:', error);
  process.exit(1);
});
