import React from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '~/lib/hooks/useSettings';
import { Switch } from '~/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { toast } from 'react-toastify';
import FileSystemTab from './FileSystemTab';

export default function FeaturesTab() {
  const {
    autoSelectTemplate,
    isLatestBranch,
    contextOptimizationEnabled,
    eventLogs,
    setAutoSelectTemplate,
    enableLatestBranch,
    enableContextOptimization,
    setEventLogs,
    setPromptId,
    promptId,
  } = useSettings();

  // Enable features by default on first load
  React.useEffect(() => {
    // Only set defaults if values are undefined
    if (isLatestBranch === undefined) {
      enableLatestBranch(false); // Default: OFF - Don't auto-update from main branch
    }

    if (contextOptimizationEnabled === undefined) {
      enableContextOptimization(true); // Default: ON - Enable context optimization
    }

    if (autoSelectTemplate === undefined) {
      setAutoSelectTemplate(true); // Default: ON - Enable auto-select templates
    }

    if (promptId === undefined) {
      setPromptId('default'); // Default: 'default'
    }

    if (eventLogs === undefined) {
      setEventLogs(true); // Default: ON - Enable event logs
    }
  }, [
    isLatestBranch,
    enableLatestBranch,
    contextOptimizationEnabled,
    enableContextOptimization,
    autoSelectTemplate,
    setAutoSelectTemplate,
    promptId,
    setPromptId,
    eventLogs,
    setEventLogs,
  ]);

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid grid-cols-2 mb-6">
        <TabsTrigger value="general">General Features</TabsTrigger>
        <TabsTrigger value="filesystem">File System</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="i-ph:star-fill w-5 h-5 text-bolt-elements-item-contentAccent dark:text-bolt-elements-item-contentAccent" />
            <h2 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
              Features & Behavior
            </h2>
          </motion.div>

          {/* Latest Branch Feature */}
          <motion.div
            className="bg-bolt-elements-background dark:bg-bolt-elements-background rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                    Latest Branch Updates
                  </h3>
                  <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
                    Automatically update to the latest experimental features from the main branch.
                  </p>
                </div>
                <Switch checked={isLatestBranch} onCheckedChange={enableLatestBranch} />
              </div>

              <div className="mt-4 p-3 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded-md">
                <p className="text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
                  <strong>Note:</strong> The main branch may contain unstable features. Enable this only if you want to
                  test the latest changes.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Context Optimization */}
          <motion.div
            className="bg-bolt-elements-background dark:bg-bolt-elements-background rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                    Context Optimization
                  </h3>
                  <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
                    Optimize context sent to the model to improve response quality and reduce token usage.
                  </p>
                </div>
                <Switch checked={contextOptimizationEnabled} onCheckedChange={enableContextOptimization} />
              </div>

              <div className="mt-4 p-3 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded-md">
                <p className="text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
                  <strong>Recommended:</strong> Keep this enabled for better performance and lower costs with large
                  codebases.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Auto-Select Template */}
          <motion.div
            className="bg-bolt-elements-background dark:bg-bolt-elements-background rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                    Auto-Select Template
                  </h3>
                  <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
                    Automatically select appropriate starter template based on the project type.
                  </p>
                </div>
                <Switch
                  checked={autoSelectTemplate}
                  onCheckedChange={(checked) => {
                    setAutoSelectTemplate(checked);
                    toast.success(`Auto-select template ${checked ? 'enabled' : 'disabled'}`);
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* Event Logs */}
          <motion.div
            className="bg-bolt-elements-background dark:bg-bolt-elements-background rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                    Event Logs
                  </h3>
                  <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
                    Record system events and user actions for diagnostics.
                  </p>
                </div>
                <Switch
                  checked={eventLogs}
                  onCheckedChange={(checked) => {
                    setEventLogs(checked);
                    toast.success(`Event logs ${checked ? 'enabled' : 'disabled'}`);
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </TabsContent>
      <TabsContent value="filesystem">
        <FileSystemTab />
      </TabsContent>
    </Tabs>
  );
}
