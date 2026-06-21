---
title: Getting Started
description: 'Set up the local docs toolchain and preview the site.'
---

# Getting Started

Use this guide to set up your local environment and preview skills.

## Prerequisites

- Node.js 20+ (or whatever your repo's `.nvmrc` / `package.json` `engines.node` pins — match that)
- pnpm 10+ (or npm/yarn)

## Install dependencies

```bash
cd documentation && pnpm install
```

## Run the docs locally

```bash
cd documentation && pnpm dev
```

## Build for production

```bash
cd documentation && pnpm build
```

The static output is generated in the `out/` directory.

## Editing workflow

1. Update Markdown files under `docs/`.
2. Check the preview site for formatting and navigation.
3. Run the formatter and linter before committing.
4. Keep every directory discoverable through its `index.md` file.
