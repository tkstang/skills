import { createDocsConfig } from '@open-agent-toolkit/docs-config';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

// FP-11: pin Turbopack's workspace root to this app dir. This repo is
// nested-standalone (the docs app has its own lockfile inside the skills repo),
// so Next/Turbopack otherwise infers the repo-root lockfile and warns. Merge
// into (don't overwrite) the MDX loader rules createDocsConfig sets on
// `turbopack`. Node >=22 provides import.meta.dirname.
const docsConfig = createDocsConfig(basePath ? { basePath } : {});

export default {
  ...docsConfig,
  turbopack: { ...docsConfig.turbopack, root: import.meta.dirname },
};
