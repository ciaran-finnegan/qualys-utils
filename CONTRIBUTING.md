# Contributing

Thanks for your interest in `qualys-utils`. This is a small utility — keep
contributions focused and the surface area minimal.

## Reporting issues

Please open a GitHub issue and include:

- what you ran and what you expected
- what happened instead (include error output, with secrets redacted)
- your Node version and OS
- the Qualys API base URL pattern (just the POD, e.g. `qualysapi.<pod>.apps.qualys.com`) — not your real one if you'd rather not share it

For suspected security issues, please follow [SECURITY.md](SECURITY.md)
instead of opening a public issue.

## Development setup

```sh
git clone https://github.com/<your-fork>/qualys-utils.git
cd qualys-utils
npm install
cp .env.example .env
# fill in source + target credentials in .env (NEVER commit .env)
```

Verify your environment:

```sh
npm run typecheck
```

## Pull request guidelines

- One change per PR. Bug fixes and features should not be mixed.
- Keep diffs small. If a refactor is needed, do it in a separate PR.
- New rule-type fields: if you add support for a new tag rule type, please
  include a sample (sanitised) JSON response in the PR description so the
  reviewer can sanity-check the field mapping.
- Run `npm run typecheck` before pushing — CI will fail otherwise.
- Don't commit your `.env`, `tags-export.json`, or `tags-backup-target-*.json`
  files. The `.gitignore` covers these but double-check `git status` before
  committing.

## Coding style

- TypeScript strict mode is on. Keep it that way.
- Don't add a comment that just describes what the code does — only explain
  *why* when the why isn't obvious.
- Prefer the smallest change that solves the problem. Don't refactor adjacent
  code unless it's directly related to the fix.

## Scope

This tool is deliberately narrow: it migrates asset tag configuration between
two Qualys subscriptions. It is not a general-purpose Qualys SDK. Proposals
that broaden the scope (e.g. asset migration, scan profile migration, policy
migration) will likely be declined — please open an issue first to discuss.
