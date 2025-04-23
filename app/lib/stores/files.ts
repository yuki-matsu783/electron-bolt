import type { PathWatcherEvent, WebContainer } from '@webcontainer/api';
import { getEncoding } from 'istextorbinary';
import { map, type MapStore } from 'nanostores';
import { Buffer } from 'node:buffer';
import { path } from '~/utils/path';
import { bufferWatchEvents } from '~/utils/buffer';
import { WORK_DIR } from '~/utils/constants';
import { computeFileModifications } from '~/utils/diff';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import { createFileSystem } from '~/utils/file-system-interface';
import type { FileSystemInterface } from '~/utils/file-system-interface';
import { FileSystemType, getFileSystemType } from '~/utils/constants';
import { fileSystemTypeStore } from '~/lib/stores/settings';

const logger = createScopedLogger('FilesStore');

const utf8TextDecoder = new TextDecoder('utf8', { fatal: true });

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
}

export interface Folder {
  type: 'folder';
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

export class FilesStore {
  #webcontainer: Promise<WebContainer>;
  #fileSystem: Promise<FileSystemInterface>;

  /**
   * Tracks the number of files without folders.
   */
  #size = 0;

  /**
   * @note Keeps track all modified files with their original content since the last user message.
   * Needs to be reset when the user sends another message and all changes have to be submitted
   * for the model to be aware of the changes.
   */
  #modifiedFiles: Map<string, string> = import.meta.hot?.data.modifiedFiles ?? new Map();

  /**
   * Keeps track of deleted files and folders to prevent them from reappearing on reload
   */
  #deletedPaths: Set<string> = import.meta.hot?.data.deletedPaths ?? new Set();

  /**
   * Map of files that matches the state of WebContainer.
   */
  files: MapStore<FileMap> = import.meta.hot?.data.files ?? map({});

  get filesCount() {
    return this.#size;
  }

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    // Initialize the file system with the current preference
    this.#fileSystem = this.#initializeFileSystem(webcontainerPromise);

    // Subscribe to file system type changes and reinitialize when it changes
    if (typeof window !== 'undefined') {
      fileSystemTypeStore.subscribe(async () => {
        logger.info('File system type changed, reinitializing file system');
        this.#fileSystem = this.#initializeFileSystem(webcontainerPromise);
        await this.#init(); // Reinitialize file watching
      });
    }

    // Load deleted paths from localStorage if available
    try {
      if (typeof localStorage !== 'undefined') {
        const deletedPathsJson = localStorage.getItem('bolt-deleted-paths');

        if (deletedPathsJson) {
          const deletedPaths = JSON.parse(deletedPathsJson);

          if (Array.isArray(deletedPaths)) {
            deletedPaths.forEach((path) => this.#deletedPaths.add(path));
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load deleted paths from localStorage', error);
    }

    if (import.meta.hot) {
      // Persist our state across hot reloads
      import.meta.hot.data.files = this.files;
      import.meta.hot.data.modifiedFiles = this.#modifiedFiles;
      import.meta.hot.data.deletedPaths = this.#deletedPaths;
    }

    this.#init();
  }

  async #initializeFileSystem(webcontainer: Promise<WebContainer>): Promise<FileSystemInterface> {
    const useWebContainer = getFileSystemType() === FileSystemType.WEB_CONTAINER;
    logger.info(`Initializing file system with ${useWebContainer ? 'WebContainer' : 'OPFS'}`);
    return createFileSystem(useWebContainer, webcontainer);
  }

  async getFile(filePath: string) {
    const dirent = this.files.get()[filePath];

    if (dirent?.type !== 'file') {
      return undefined;
    }

    // If the file content isn't in the cache and we're using OPFS,
    // we need to explicitly load the content
    if (dirent.content === undefined && getFileSystemType() === FileSystemType.OPFS) {
      try {
        const fileSystem = await this.#fileSystem;
        const buffer = await fileSystem.readFile(filePath);
        const isBinary = isBinaryFile(buffer);

        let content = '';
        if (isBinary) {
          content = Buffer.from(buffer).toString('base64');
        } else {
          content = this.#decodeFileContent(buffer);
        }

        // Update the file content in the store
        this.files.setKey(filePath, { ...dirent, content, isBinary });

        return { type: 'file', content, isBinary };
      } catch (error) {
        logger.error(`Failed to load file content for ${filePath}`, error);
        return dirent;
      }
    }

    return dirent;
  }

  getFileModifications() {
    return computeFileModifications(this.files.get(), this.#modifiedFiles);
  }

  getModifiedFiles() {
    let modifiedFiles: { [path: string]: File } | undefined = undefined;

    for (const [filePath, originalContent] of this.#modifiedFiles) {
      const file = this.files.get()[filePath];

      if (file?.type !== 'file') {
        continue;
      }

      if (file.content === originalContent) {
        continue;
      }

      if (!modifiedFiles) {
        modifiedFiles = {};
      }

      modifiedFiles[filePath] = file;
    }

    return modifiedFiles;
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async saveFile(filePath: string, content: string) {
    const fileSystem = await this.#fileSystem;

    try {
      const file = await this.getFile(filePath);
      const oldContent = file?.content;

      if (!oldContent && oldContent !== '') {
        unreachable('Expected content to be defined');
      }

      await fileSystem.writeFile(filePath, content);

      if (!this.#modifiedFiles.has(filePath)) {
        this.#modifiedFiles.set(filePath, oldContent);
      }

      // we immediately update the file and don't rely on the `change` event coming from the watcher
      this.files.setKey(filePath, { type: 'file', content, isBinary: false });

      logger.info('File updated');
    } catch (error) {
      logger.error('Failed to update file content\n\n', error);

      throw error;
    }
  }

  async #init() {
    const fileSystem = await this.#fileSystem;

    // Clean up any files that were previously deleted
    this.#cleanupDeletedFiles();

    // Set up file watcher
    if (getFileSystemType() === FileSystemType.WEB_CONTAINER) {
      // WebContainer implementation
      fileSystem.watchPath(
        { include: [`${WORK_DIR}/**`], exclude: ['**/node_modules', '.git'], includeContent: true },
        bufferWatchEvents(100, this.#processEventBuffer.bind(this)),
      );
    } else {
      // OPFS implementation - use the same API but with polling
      fileSystem.watchPath(
        { include: [`${WORK_DIR}/**`], exclude: ['**/node_modules', '.git'], includeContent: true },
        bufferWatchEvents(100, this.#processEventBuffer.bind(this)),
      );
    }
  }

  /**
   * Removes any deleted files/folders from the store
   */
  #cleanupDeletedFiles() {
    if (this.#deletedPaths.size === 0) {
      return;
    }

    const currentFiles = this.files.get();

    for (const deletedPath of this.#deletedPaths) {
      if (currentFiles[deletedPath]) {
        this.files.setKey(deletedPath, undefined);

        if (currentFiles[deletedPath]?.type === 'file') {
          this.#size--;
        }
      }

      for (const [path, dirent] of Object.entries(currentFiles)) {
        if (path.startsWith(deletedPath + '/')) {
          this.files.setKey(path, undefined);

          if (dirent?.type === 'file') {
            this.#size--;
          }

          if (dirent?.type === 'file' && this.#modifiedFiles.has(path)) {
            this.#modifiedFiles.delete(path);
          }
        }
      }
    }
  }

  #processEventBuffer(events: Array<[events: PathWatcherEvent[]]>) {
    const watchEvents = events.flat(2);
    const currentFileSystemType = getFileSystemType();

    for (const { type, path: eventPath, buffer } of watchEvents) {
      // Skip undefined paths
      if (!eventPath) {
        continue;
      }

      // Remove any trailing slashes
      const sanitizedPath = eventPath.replace(/\/+$/g, '');

      // Skip processing if this file/folder was explicitly deleted
      if (this.#deletedPaths.has(sanitizedPath)) {
        continue;
      }

      let isInDeletedFolder = false;
      for (const deletedPath of this.#deletedPaths) {
        if (sanitizedPath.startsWith(deletedPath + '/')) {
          isInDeletedFolder = true;
          break;
        }
      }

      if (isInDeletedFolder) {
        continue;
      }

      switch (type) {
        case 'add_dir': {
          this.files.setKey(sanitizedPath, { type: 'folder' });
          break;
        }
        case 'remove_dir': {
          this.files.setKey(sanitizedPath, undefined);

          for (const [direntPath] of Object.entries(this.files)) {
            if (direntPath.startsWith(sanitizedPath)) {
              this.files.setKey(direntPath, undefined);
            }
          }

          break;
        }
        case 'add_file':
        case 'change': {
          if (type === 'add_file') {
            this.#size++;
          }

          let content = '';
          const isBinary = isBinaryFile(buffer);

          if (isBinary && buffer) {
            // For binary files, we need to preserve the content as base64
            content = Buffer.from(buffer).toString('base64');
          } else if (!isBinary) {
            content = this.#decodeFileContent(buffer);

            // If the content is a single space and this is from our empty file workaround,
            // convert it back to an actual empty string
            if (content === ' ' && type === 'add_file') {
              content = '';
            }
          }

          const existingFile = this.files.get()[sanitizedPath];

          if (existingFile?.type === 'file' && existingFile.isBinary && existingFile.content && !content) {
            content = existingFile.content;
          }

          // For OPFS, ensure we have content if buffer is undefined (may happen with poll-based watchers)
          if (currentFileSystemType === FileSystemType.OPFS && !buffer && type === 'change') {
            this.#loadFileContentAsync(sanitizedPath).catch((error) => {
              logger.error(`Failed to load content for ${sanitizedPath}`, error);
            });
            // We'll update the content when the async operation completes
            break;
          }

          this.files.setKey(sanitizedPath, { type: 'file', content, isBinary });
          break;
        }
        case 'remove_file': {
          this.#size--;
          this.files.setKey(sanitizedPath, undefined);
          break;
        }
        case 'update_directory': {
          // we don't care about these events
          break;
        }
      }
    }
  }

  // Helper method to load file content asynchronously for OPFS files
  async #loadFileContentAsync(filePath: string) {
    try {
      const fileSystem = await this.#fileSystem;
      const buffer = await fileSystem.readFile(filePath);

      const isBinary = isBinaryFile(buffer);
      let content = '';

      if (isBinary) {
        content = Buffer.from(buffer).toString('base64');
      } else {
        content = this.#decodeFileContent(buffer);
      }

      this.files.setKey(filePath, { type: 'file', content, isBinary });
    } catch (error) {
      // The file might have been deleted
      logger.debug(`Could not load content for ${filePath}`, error);
    }
  }

  #decodeFileContent(buffer?: Uint8Array) {
    if (!buffer || buffer.byteLength === 0) {
      return '';
    }

    try {
      return utf8TextDecoder.decode(buffer);
    } catch (error) {
      console.log(error);
      return '';
    }
  }

  async createFile(filePath: string, content: string | Uint8Array = '') {
    const fileSystem = await this.#fileSystem;

    try {
      const dirPath = path.dirname(filePath);

      if (dirPath !== '.') {
        await fileSystem.mkdir(dirPath, { recursive: true });
      }

      const isBinary = content instanceof Uint8Array;

      if (isBinary) {
        await fileSystem.writeFile(filePath, Buffer.from(content));

        const base64Content = Buffer.from(content).toString('base64');
        this.files.setKey(filePath, { type: 'file', content: base64Content, isBinary: true });

        this.#modifiedFiles.set(filePath, base64Content);
      } else {
        const contentToWrite = (content as string).length === 0 ? ' ' : content;
        await fileSystem.writeFile(filePath, contentToWrite);

        this.files.setKey(filePath, { type: 'file', content: content as string, isBinary: false });

        this.#modifiedFiles.set(filePath, content as string);
      }

      logger.info(`File created: ${filePath}`);

      return true;
    } catch (error) {
      logger.error('Failed to create file\n\n', error);
      throw error;
    }
  }

  async createFolder(folderPath: string) {
    const fileSystem = await this.#fileSystem;

    try {
      await fileSystem.mkdir(folderPath, { recursive: true });

      this.files.setKey(folderPath, { type: 'folder' });

      logger.info(`Folder created: ${folderPath}`);

      return true;
    } catch (error) {
      logger.error('Failed to create folder\n\n', error);
      throw error;
    }
  }

  async deleteFile(filePath: string) {
    const fileSystem = await this.#fileSystem;

    try {
      await fileSystem.rm(filePath);

      this.#deletedPaths.add(filePath);

      this.files.setKey(filePath, undefined);
      this.#size--;

      if (this.#modifiedFiles.has(filePath)) {
        this.#modifiedFiles.delete(filePath);
      }

      this.#persistDeletedPaths();

      logger.info(`File deleted: ${filePath}`);

      return true;
    } catch (error) {
      logger.error('Failed to delete file\n\n', error);
      throw error;
    }
  }

  async deleteFolder(folderPath: string) {
    const fileSystem = await this.#fileSystem;

    try {
      await fileSystem.rm(folderPath, { recursive: true });

      this.#deletedPaths.add(folderPath);

      this.files.setKey(folderPath, undefined);

      const allFiles = this.files.get();

      for (const [path, dirent] of Object.entries(allFiles)) {
        if (path.startsWith(folderPath + '/')) {
          this.files.setKey(path, undefined);

          this.#deletedPaths.add(path);

          if (dirent?.type === 'file') {
            this.#size--;
          }

          if (dirent?.type === 'file' && this.#modifiedFiles.has(path)) {
            this.#modifiedFiles.delete(path);
          }
        }
      }

      this.#persistDeletedPaths();

      logger.info(`Folder deleted: ${folderPath}`);

      return true;
    } catch (error) {
      logger.error('Failed to delete folder\n\n', error);
      throw error;
    }
  }

  // method to persist deleted paths to localStorage
  #persistDeletedPaths() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bolt-deleted-paths', JSON.stringify([...this.#deletedPaths]));
      }
    } catch (error) {
      logger.error('Failed to persist deleted paths to localStorage', error);
    }
  }
}

function isBinaryFile(buffer: Uint8Array | undefined) {
  if (buffer === undefined) {
    return false;
  }

  return getEncoding(convertToBuffer(buffer), { chunkLength: 100 }) === 'binary';
}

/**
 * Converts a `Uint8Array` into a Node.js `Buffer` by copying the prototype.
 * The goal is to  avoid expensive copies. It does create a new typed array
 * but that's generally cheap as long as it uses the same underlying
 * array buffer.
 */
function convertToBuffer(view: Uint8Array): Buffer {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}
