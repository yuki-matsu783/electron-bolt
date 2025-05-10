import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames('flex items-center p-5 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <div className="flex items-center gap-1">
          <a href="/" className="flex items-center">
            ReactUI生成アプリ
          </a>
          <span className="text-xs text-bolt-elements-textSecondary">powered by</span>
          <a href="/" className="flex items-center">
            <img src="/logo-light-styled.png" alt="logo" className="h-6 inline-block dark:hidden" />
            <img src="/logo-dark-styled.png" alt="logo" className="h-6 inline-block hidden dark:block" />
          </a>
        </div>
      </div>
      {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="mr-1">
                <HeaderActionButtons />
              </div>
            )}
          </ClientOnly>
        </>
      )}
    </header>
  );
}
