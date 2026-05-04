# Releasing

v0.1 is not ready to tag until the full project validation and provider smoke tests pass.

## Checklist

- Run `npm test`.
- Run `npm run validate`.
- Verify `consensus-refine` on a real markdown artifact.
- Verify Claude Code plugin install and Bash permission shape.
- Verify Cursor plugin install and exec permission shape.
- Verify Codex Git/local install, interface metadata, skill path syntax, and exec permission shape.
- Verify `npx skills add <username>/skills` discovery.
- Confirm the README install matrix matches the live provider CLIs.
- Confirm no plugin manifest references `.oat/` or project-local infrastructure.

## Versioning

Update `CHANGELOG.md` and all provider manifests together.

Use:

```bash
node scripts/bump-version.mjs 0.1.0
```

The bump script updates the three provider plugin manifests and any marketplace `version` fields that are already present. It does not add version fields to marketplace schemas that omit them.

Before pushing a release tag, verify the tag and manifests match:

```bash
node scripts/bump-version.mjs --check-tag v0.1.0
```

The structural validator enforces provider manifest consistency during normal development; the release workflow also checks the pushed tag against provider manifests and present marketplace version fields.
