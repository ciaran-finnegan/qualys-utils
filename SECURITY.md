# Security policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report privately via [GitHub Security Advisories][advisories]:
1. Go to the repository's "Security" tab
2. Click "Report a vulnerability"
3. Fill in the form with reproduction steps

You can expect an initial response within 7 days.

[advisories]: https://github.com/ciaran-finnegan/qualys-utils/security/advisories/new

## Credential hygiene

This tool reads Qualys credentials from a `.env` file. The `.gitignore`
excludes `.env`, `.env.*`, `tags-export.json`, and `tags-backup-target-*.json`,
but please double-check `git status` before committing — exported tag files
can contain operationally sensitive detail (IP ranges, cloud rule queries,
internal asset naming conventions).

If you suspect credentials may have been committed, rotate them immediately
in Qualys before doing anything else with the repo.
