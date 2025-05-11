import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';
import { OPFSService } from '~/lib/filesystem/opfs/OPFSService';
import { path } from '~/utils/path';

interface WebContainerContext {
  loaded: boolean;
}

// Initialize OPFS for file system operations
export const fileSystem = typeof window !== 'undefined' 
  ? new OPFSService()
  : null as unknown as OPFSService; // SSRの場合はnullを返す（型キャストで互換性を保つ）

// Export shared constants
export const PREVIEW_CHANNEL = 'preview-updates';

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        return WebContainer.boot({
          coep: 'credentialless',
          workdirName: WORK_DIR_NAME,
          forwardPreviewErrors: true, // Enable error forwarding from iframes
        });
      })
      .then(async (webcontainer) => {
        webcontainerContext.loaded = true;

        // Initialize file sync scheduler
        const syncOPFS = async () => {
          const allFiles = await fileSystem.readDirectory('/', { recursive: true });
          
          // First, ensure all directories exist
          const directories = allFiles.filter(file => file.type === 'directory');
          for (const dir of directories) {
            const targetPath = path.join(WORK_DIR_NAME, dir.path);
            await webcontainer.fs.mkdir(targetPath, { recursive: true });
          }

          // Then sync all files
          const files = allFiles.filter(file => file.type === 'file');
          for (const file of files) {
            const content = await fileSystem.readFile(file.path);
            const targetPath = path.join(WORK_DIR_NAME, file.path);
            const parentDir = path.dirname(targetPath);
            await webcontainer.fs.mkdir(parentDir, { recursive: true });
            await webcontainer.fs.writeFile(targetPath, content);
          }
        };

        // Run initial sync
        await syncOPFS();

        // Set up periodic sync (every 2 seconds)
        const syncInterval = 2000;
        setInterval(() => {
          syncOPFS().catch(error => {
            console.error('Failed to sync OPFS to WebContainer:', error);
          });
        }, syncInterval);

        const { workbenchStore } = await import('~/lib/stores/workbench');

        // Listen for preview errors
        webcontainer.on('preview-message', (message) => {
          console.log('WebContainer preview message:', message);

          // Handle both uncaught exceptions and unhandled promise rejections
          if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
            const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
            workbenchStore.actionAlert.set({
              type: 'preview',
              title: isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception',
              description: message.message,
              content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
              source: 'preview',
            });
          }
        });

        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}
