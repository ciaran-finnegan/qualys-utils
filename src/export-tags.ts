// Pulls every tag from the SOURCE Qualys instance and writes a JSON file
// that import-tags.ts can consume.
//
// Usage: npm run export -- [output-path]
//   default output: tags-export.json

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { QualysClient, loadConfigFromEnv } from './client.ts';
import type { ExportedTag, ExportFile } from './types.ts';

async function main() {
  const outputPath = resolve(process.cwd(), process.argv[2] ?? 'tags-export.json');

  const client = new QualysClient(loadConfigFromEnv('SOURCE'));
  console.log(`source: ${client.baseUrl}`);

  const expected = await client.countTags();
  console.log(`source reports ${expected} tags. fetching...`);

  const exported: ExportedTag[] = [];
  let page = 0;
  for await (const tag of client.iterateAllTags()) {
    if (tag.id == null) continue;
    exported.push({
      sourceId: tag.id,
      name: tag.name,
      color: tag.color ?? null,
      ruleType: tag.ruleType ?? null,
      ruleText: tag.ruleText ?? null,
      description: tag.description ?? null,
      criticalityScore: tag.criticalityScore ?? null,
      provider: tag.provider ?? null,
      parentSourceId: tag.parentTagId ?? null,
    });
    if (exported.length % 100 === 0) {
      page += 1;
      console.log(`  fetched ${exported.length}/${expected} (page ${page})`);
    }
  }

  const out: ExportFile = {
    exportedAt: new Date().toISOString(),
    sourceBaseUrl: client.baseUrl,
    count: exported.length,
    tags: exported,
  };

  await writeFile(outputPath, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`\n✓ wrote ${exported.length} tags to ${outputPath}`);

  if (expected > 0 && exported.length !== expected) {
    console.warn(
      `⚠ count mismatch: API reported ${expected} but iterated ${exported.length}. Check pagination.`,
    );
  }
}

main().catch((err) => {
  console.error('export failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
