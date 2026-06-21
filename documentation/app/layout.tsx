import { DocsLayout } from '@open-agent-toolkit/docs-theme';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';

import './globals.css';
import StaticSearchDialog from '@/components/search';
import { source } from '@/lib/source';

export const metadata = {
  title: 'skills',
  description:
    'A personal home for Agent Skills and plugins, including the consensus deliberation plugin.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider
          search={{
            SearchDialog: StaticSearchDialog,
          }}
        >
          <DocsLayout
            branding={{
              title: 'skills',
              description:
                'A personal home for Agent Skills and plugins, including the consensus deliberation plugin.',
            }}
            tree={source.getPageTree()}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
