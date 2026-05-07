# qualys-utils

Utilities for migrating configuration between Qualys instances.

## tag migration

Exports every asset tag (label, colour, rule type, rule text, parent/child
hierarchy) from a **source** Qualys instance and recreates them on a
**target** instance.

### setup

```sh
npm install
cp .env.example .env
# edit .env and fill in source + target credentials
```

The `.env` file is gitignored. Both source and target credentials live in the
same file, prefixed with `SOURCE_` and `TARGET_`.

### usage

```sh
# pull every tag from source → tags-export.json
npm run export

# push tags-export.json → target
npm run import
```

Custom paths:

```sh
npm run export -- ./snapshots/2026-05-07.json
npm run import -- ./snapshots/2026-05-07.json
```

### what gets migrated

Per tag: `name`, `color`, `ruleType`, `ruleText`, and the parent-child
hierarchy. Static tags (no rule) are migrated as name-only.

### conflict handling

If a tag with the same name already exists on the target, it is **skipped**
with a log line. Its existing target-id is still recorded, so any of its
children that are new to the target will be created underneath it.

### endpoints used

Qualys Asset Management & Tagging API v2:

- `POST /qps/rest/2.0/count/am/tag` — sanity check
- `POST /qps/rest/2.0/search/am/tag` — paginated tag listing
- `POST /qps/rest/2.0/create/am/tag` — create on target

[API guide](https://cdn2.qualys.com/docs/qualys-asset-management-tagging-api-v2-user-guide.pdf)

### typecheck

```sh
npm run typecheck
```
