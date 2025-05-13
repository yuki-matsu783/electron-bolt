import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { PreviewTab } from '~/components/workbench/PreviewTab';
import * as Tabs from '@radix-ui/react-tabs';
import { useState } from 'react';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

/**
 * Landing page component for Bolt
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      {/* <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <Tabs.List className="flex border-b border-bolt-elements-border-strong bg-bolt-elements-background-depth-2 px-4">
          <Tabs.Trigger
            value="chat"
            className="flex items-center px-4 py-2 text-sm font-medium text-bolt-elements-textSecondary data-[state=active]:text-bolt-elements-textPrimary data-[state=active]:border-b-2 data-[state=active]:border-bolt-elements-borderPrimary"
          >
            チャット
          </Tabs.Trigger>
          <Tabs.Trigger
            value="preview"
            className="flex items-center px-4 py-2 text-sm font-medium text-bolt-elements-textSecondary data-[state=active]:text-bolt-elements-textPrimary data-[state=active]:border-b-2 data-[state=active]:border-bolt-elements-borderPrimary"
          >
            プレビュー
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="chat" className="flex-1"></Tabs.Content> */}
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      {/* <Tabs.Content value="preview" className="flex-1">
        <PreviewTab />
      </Tabs.Content>
    </Tabs.Root> */}
    </div >
  );
}
