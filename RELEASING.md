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

Update `CHANGELOG.md` and all provider manifests together. The structural validator enforces version consistency for plugin manifests.
