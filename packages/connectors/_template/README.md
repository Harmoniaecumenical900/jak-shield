# Connector template

Copy this directory to `packages/connectors/<your-connector>` and edit:

1. `package.json` — set `name` to `@jak-shield/connector-<your-connector>`
2. `src/index.ts` — implement one or more `ConnectorTool` instances and export a `register*Connector()` function
3. Add the package to `packages/connectors/bundle/package.json` and call your register function inside `packages/connectors/bundle/src/index.ts`
4. Add a tsconfig reference in `packages/connectors/bundle/tsconfig.json`

That's it — JAK Shield will gate your tool through the same policy engine, DLP, audit log, and approval queue.
