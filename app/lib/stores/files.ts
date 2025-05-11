import { getEncoding } from 'istextorbinary';
import { map, type MapStore } from 'nanostores';
import { Buffer } from 'node:buffer';
import { path } from '~/utils/path';
import { computeFileModifications } from '~/utils/diff';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { FileSystemService } from '../filesystem/interfaces/FileSystemService';
import type { FileContent } from '../filesystem/interfaces/types';

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
  #fileSystem: FileSystemService;
  #size = 0;
  #modifiedFiles: Map<string, string> = import.meta.hot?.data.modifiedFiles ?? new Map();
  #deletedPaths: Set<string> = import.meta.hot?.data.deletedPaths ?? new Set();
  files: MapStore<FileMap> = import.meta.hot?.data.files ?? map({});

  get filesCount() {
    return this.#size;
  }

  constructor(fileSystem: FileSystemService) {
    this.#fileSystem = fileSystem;

    // クライアントサイドでのみローカルストレージを使用
    if (typeof window !== 'undefined') {
      this.#loadDeletedPaths();
    }

    if (import.meta.hot) {
      import.meta.hot.data.files = this.files;
      import.meta.hot.data.modifiedFiles = this.#modifiedFiles;
      import.meta.hot.data.deletedPaths = this.#deletedPaths;
    }

    this.#init();
  }

  /**
   * 削除されたパスをローカルストレージから読み込む
   */
  #loadDeletedPaths() {
    try {
      const deletedPathsJson = localStorage.getItem('bolt-deleted-paths');
      if (deletedPathsJson) {
        const deletedPaths = JSON.parse(deletedPathsJson);
        if (Array.isArray(deletedPaths)) {
          deletedPaths.forEach((path) => this.#deletedPaths.add(path));
        }
      }
    } catch (error: any) {
      logger.error('Failed to load deleted paths from localStorage', error);
    }
  }

  getFile(filePath: string) {
    const dirent = this.files.get()[filePath];
    if (dirent?.type !== 'file') {
      return undefined;
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
      if (file?.type !== 'file') continue;
      if (file.content === originalContent) continue;
      if (!modifiedFiles) modifiedFiles = {};
      modifiedFiles[filePath] = file;
    }

    return modifiedFiles;
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async saveFile(filePath: string, content: string) {
    try {
      const oldContent = this.getFile(filePath)?.content;
      if (!oldContent && oldContent !== '') {
        unreachable('Expected content to be defined');
      }

      await this.#fileSystem.writeFile(filePath, content);

      if (!this.#modifiedFiles.has(filePath)) {
        this.#modifiedFiles.set(filePath, oldContent);
      }

      this.files.setKey(filePath, { type: 'file', content, isBinary: false });
      logger.info('File updated');
    } catch (error: any) {
      logger.error('Failed to update file content\n\n', error);
      throw error;
    }
  }

  async #init() {
    this.#cleanupDeletedFiles();
    await this.#fileSystem.initialize();
    await this.#loadInitialFiles();
  }

  async #loadInitialFiles() {
    try {
      const files = await this.#fileSystem.readDirectory('/', { recursive: true });
      for (const file of files) {
        if (file.type === 'file') {
          const content = await this.#fileSystem.readFile(file.path);
          this.files.setKey(file.path, {
            type: 'file',
            content: content as string,
            isBinary: false
          });
          this.#size++;
        } else {
          this.files.setKey(file.path, { type: 'folder' });
        }
      }
    } catch (error: any) {
      logger.error('Failed to load initial files\n\n', error);
    }
  }

  #cleanupDeletedFiles() {
    if (this.#deletedPaths.size === 0) return;

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
            if (this.#modifiedFiles.has(path)) {
              this.#modifiedFiles.delete(path);
            }
          }
        }
      }
    }
  }

  async createFile(filePath: string, content: string | Uint8Array = '') {
    try {
      const dirPath = path.dirname(filePath);
      if (dirPath !== '.') {
        await this.#fileSystem.createDirectory(dirPath, { recursive: true });
      }

      const isBinary = content instanceof Uint8Array;
      let fileContent: FileContent;

      if (isBinary) {
        fileContent = Buffer.from(content);
        const base64Content = Buffer.from(content).toString('base64');
        this.files.setKey(filePath, { type: 'file', content: base64Content, isBinary: true });
        this.#modifiedFiles.set(filePath, base64Content);
      } else {
        fileContent = (content as string).length === 0 ? ' ' : content;
        this.files.setKey(filePath, { type: 'file', content: content as string, isBinary: false });
        this.#modifiedFiles.set(filePath, content as string);
      }

      await this.#fileSystem.createFile(filePath, fileContent);
      this.#processEvent('add_file', filePath, fileContent);
      logger.info(`File created: ${filePath}`);
      return true;
    } catch (error: any) {
      logger.error('Failed to create file\n\n', error);
      throw error;
    }
  }

  async createFolder(folderPath: string) {
    try {
      await this.#fileSystem.createDirectory(folderPath, { recursive: true });
      this.#processEvent('add_dir', folderPath);
      logger.info(`Folder created: ${folderPath}`);
      return true;
    } catch (error: any) {
      logger.error('Failed to create folder\n\n', error);
      throw error;
    }
  }

  async deleteFile(filePath: string) {
    try {
      await this.#fileSystem.deleteFile(filePath);
      this.#processEvent('remove_file', filePath);
      this.#deletedPaths.add(filePath);
      this.#persistDeletedPaths();
      logger.info(`File deleted: ${filePath}`);
      return true;
    } catch (error: any) {
      logger.error('Failed to delete file\n\n', error);
      throw error;
    }
  }

  async deleteFolder(folderPath: string) {
    try {
      await this.#fileSystem.deleteDirectory(folderPath, { recursive: true });
      this.#processEvent('remove_dir', folderPath);
      this.#deletedPaths.add(folderPath);
      this.#persistDeletedPaths();
      logger.info(`Folder deleted: ${folderPath}`);
      return true;
    } catch (error: any) {
      logger.error('Failed to delete folder\n\n', error);
      throw error;
    }
  }

  #processEvent(type: 'add_file' | 'change' | 'add_dir' | 'remove_dir' | 'remove_file', eventPath: string, fileContent?: FileContent) {
    const sanitizedPath = eventPath.replace(/\/+$/g, '');

    if (this.#deletedPaths.has(sanitizedPath)) return;
    for (const deletedPath of this.#deletedPaths) {
      if (sanitizedPath.startsWith(deletedPath + '/')) return;
    }

    switch (type) {
      case 'add_dir':
        this.files.setKey(sanitizedPath, { type: 'folder' });
        break;

      case 'remove_dir':
        this.files.setKey(sanitizedPath, undefined);
        for (const [direntPath] of Object.entries(this.files.get())) {
          if (direntPath.startsWith(sanitizedPath + '/')) {
            this.files.setKey(direntPath, undefined);
          }
        }
        break;

      case 'add_file':
      case 'change': {
        if (type === 'add_file') {
          this.#size++;
        }

        if (!fileContent) return;

        const isBinary = fileContent instanceof Uint8Array;
        let content: string;

        if (isBinary) {
          content = Buffer.from(fileContent as Uint8Array).toString('base64');
        } else {
          content = fileContent as string;
          if (content === ' ' && type === 'add_file') {
            content = '';
          }
        }

        this.files.setKey(sanitizedPath, { type: 'file', content, isBinary });
        break;
      }

      case 'remove_file':
        this.#size--;
        this.files.setKey(sanitizedPath, undefined);
        break;
    }
  }

  /**
   * 削除されたパスをローカルストレージに保存
   */
  #persistDeletedPaths() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('bolt-deleted-paths', JSON.stringify([...this.#deletedPaths]));
    } catch (error: any) {
      logger.error('Failed to persist deleted paths to localStorage', error);
    }
  }
}
