import React from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { FileSystemType } from '~/utils/constants';
import { toast } from 'react-toastify';

export default function FileSystemTab() {
  const { fileSystemType, setFileSystemType } = useSettings();
  
  const isUsingWebContainer = fileSystemType === FileSystemType.WEB_CONTAINER;

  const handleToggleFileSystem = (checked: boolean) => {
    // checked: true = WebContainer, false = OPFS
    const newType = checked ? FileSystemType.WEB_CONTAINER : FileSystemType.OPFS;
    setFileSystemType(newType);
    toast.success(`File system switched to ${newType === FileSystemType.WEB_CONTAINER ? 'WebContainer' : 'Origin Private File System'}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <div className="i-ph:folders w-5 h-5 text-bolt-elements-item-contentAccent dark:text-bolt-elements-item-contentAccent" />
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
            File System Settings
          </h2>
        </div>
      </motion.div>

      {/* File System Selection */}
      <motion.div
        className="bg-bolt-elements-background dark:bg-bolt-elements-background rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="p-6">
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary mb-4">
            File Storage Type
          </h3>
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                {isUsingWebContainer ? 'WebContainer' : 'Origin Private File System (Default)'}
              </p>
              <p className="text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary mt-1">
                {isUsingWebContainer 
                  ? 'Uses WebContainer for file operations with virtual filesystem' 
                  : 'Uses Origin Private File System for local browser storage'}
              </p>
            </div>
            <Switch 
              checked={isUsingWebContainer}
              onCheckedChange={handleToggleFileSystem}
            />
          </div>
          
          <div className="bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded-lg p-4">
            <h4 className="text-sm font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary mb-2">
              About File System Options
            </h4>
            <ul className="text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary space-y-2">
              <li><strong>WebContainer:</strong> Uses a virtual file system in the browser. Best for compatibility with Node.js operations and previews.</li>
              <li><strong>Origin Private File System:</strong> The default option that uses the browser's built-in storage system. Files persist between sessions even after closing the browser.</li>
            </ul>
            <div className="mt-4 text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
              <p className="italic">Note: Changing this setting will reload the file system. Your work should be preserved, but it's recommended to save any changes first.</p>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Environment Variable Info */}
      <motion.div
        className="bg-bolt-elements-background dark:bg-bolt-elements-background rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="p-6">
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary mb-4">
            Environment Configuration
          </h3>
          <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary mb-2">
            You can also set the file system type using an environment variable in your <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded">.env.local</code> file:
          </p>
          <div className="bg-bolt-elements-code-background dark:bg-bolt-elements-code-background text-bolt-elements-code-text dark:text-bolt-elements-code-text p-3 rounded-lg font-mono text-sm mb-4">
            <pre>VITE_FILE_SYSTEM_TYPE={FileSystemType.OPFS}</pre>
          </div>
          <p className="text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
            Valid values are <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded">{FileSystemType.WEB_CONTAINER}</code> or <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded">{FileSystemType.OPFS}</code> (default)
          </p>
        </div>
      </motion.div>
    </div>
  );
}