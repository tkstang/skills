# Authored MJS boundary

This runtime remains authored dependency-free MJS because its control, hook,
lease, and installer modules are consumed directly as JavaScript installation
artifacts. Each runtime entrypoint has one adjacent handwritten `.d.mts`
declaration so NodeNext resolves the MJS module contract directly.
`ambient-types.ts` and `tsconfig.types.json` compile those declarations, while
the colocated Vitest suites exercise the runtime implementation. The packaging
builder bundles these declared entrypoints into the generated standalone unit;
no authored runtime file is copied into an installation implicitly.
