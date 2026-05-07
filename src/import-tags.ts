// Reads an export file and recreates the tags on the TARGET Qualys instance.
// Hierarchy is preserved: parents are created before children, and children
// are created with parentTagId pointing at the new parent on the target.
//
// Conflict handling: if a tag with the same name already exists on the target,
// it is skipped (logged) and its existing id is reused as a parent reference
// for any of its children in the export.
//
// Safety: before any writes happen, every tag currently on the target is
// snapshotted to tags-backup-target-<timestamp>.json. The script aborts if
// the snapshot can't be written. Use export-tags.ts against the target with
// this file as input to roll back if needed.
//
// Usage: npm run import -- [input-path]
//   default input: tags-export.json

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { QualysClient, QualysApiError, loadConfigFromEnv } from './client.ts';
import type { ExportFile, ExportedTag, Tag } from './types.ts';

interface ImportStats {
  created: number;
  skipped: number;
  failed: number;
}

async function main() {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tags-export.json');

  const raw = await readFile(inputPath, 'utf-8');
  const exportFile = JSON.parse(raw) as ExportFile;
  console.log(
    `loaded ${exportFile.count} tags from ${inputPath}\n  exported at: ${exportFile.exportedAt}\n  source url:  ${exportFile.sourceBaseUrl}`,
  );

  const client = new QualysClient(loadConfigFromEnv('TARGET'));
  console.log(`target: ${client.baseUrl}\n`);

  // Snapshot the target as it stands now. This serves two purposes:
  //  1. Backup — restorable via this same tool if a write goes wrong.
  //  2. Conflict detection — names already on target are skipped on import.
  const { tags: targetTags, byName: targetByName } = await snapshotTarget(client);
  const backupPath = await writeBackup(targetTags, client.baseUrl);
  console.log(`backup written: ${backupPath}\n  ${targetTags.length} tags snapshotted\n`);

  const ordered = topologicalOrder(exportFile.tags);

  // Maps source tag id → id on the target (newly created or pre-existing).
  const sourceToTarget = new Map<number, number>();
  const stats: ImportStats = { created: 0, skipped: 0, failed: 0 };

  for (const tag of ordered) {
    const existingId = targetByName.get(tag.name);
    if (existingId !== undefined) {
      console.log(`  skip "${tag.name}" — already exists on target (id ${existingId})`);
      sourceToTarget.set(tag.sourceId, existingId);
      stats.skipped += 1;
      continue;
    }

    let parentTargetId: number | null = null;
    if (tag.parentSourceId != null) {
      const mapped = sourceToTarget.get(tag.parentSourceId);
      if (mapped == null) {
        console.error(
          `  ✗ "${tag.name}" — parent source-id ${tag.parentSourceId} not yet mapped (this should not happen after topo sort)`,
        );
        stats.failed += 1;
        continue;
      }
      parentTargetId = mapped;
    }

    try {
      const created = await client.createTag({
        name: tag.name,
        color: tag.color,
        ruleType: tag.ruleType,
        ruleText: tag.ruleText,
        description: tag.description,
        criticalityScore: tag.criticalityScore,
        provider: tag.provider,
        parentTagId: parentTargetId,
      });
      const newId = created.id!;
      sourceToTarget.set(tag.sourceId, newId);
      targetByName.set(tag.name, newId);
      console.log(
        `  ✓ "${tag.name}" → id ${newId}${parentTargetId != null ? ` (parent ${parentTargetId})` : ''}`,
      );
      stats.created += 1;
    } catch (err) {
      const msg = err instanceof QualysApiError ? `${err.message} — ${err.body}` : String(err);
      console.error(`  ✗ "${tag.name}" — ${msg}`);
      stats.failed += 1;
    }
  }

  console.log(
    `\nimport complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.failed} failed`,
  );
  console.log(`pre-import backup of target: ${backupPath}`);
  if (stats.failed > 0) process.exitCode = 1;
}

async function snapshotTarget(
  client: QualysClient,
): Promise<{ tags: ExportedTag[]; byName: Map<string, number> }> {
  console.log('snapshotting target tags before any writes...');
  const tags: ExportedTag[] = [];
  const byName = new Map<string, number>();
  for await (const tag of client.iterateAllTags()) {
    if (tag.id == null) continue;
    byName.set(tag.name, tag.id);
    tags.push(toExported(tag));
  }
  return { tags, byName };
}

function toExported(tag: Tag): ExportedTag {
  return {
    sourceId: tag.id!,
    name: tag.name,
    color: tag.color ?? null,
    ruleType: tag.ruleType ?? null,
    ruleText: tag.ruleText ?? null,
    description: tag.description ?? null,
    criticalityScore: tag.criticalityScore ?? null,
    provider: tag.provider ?? null,
    parentSourceId: tag.parentTagId ?? null,
  };
}

async function writeBackup(tags: ExportedTag[], baseUrl: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = resolve(process.cwd(), `tags-backup-target-${stamp}.json`);
  const out: ExportFile = {
    exportedAt: new Date().toISOString(),
    sourceBaseUrl: baseUrl,
    count: tags.length,
    tags,
  };
  await writeFile(path, JSON.stringify(out, null, 2), 'utf-8');
  return path;
}

// Sort so that every parent appears before its children. Tags whose parent is
// missing from the export (orphans) are treated as roots — they'll be created
// without a parent on the target.
function topologicalOrder(tags: ExportedTag[]): ExportedTag[] {
  const byId = new Map<number, ExportedTag>();
  for (const t of tags) byId.set(t.sourceId, t);

  const visited = new Set<number>();
  const out: ExportedTag[] = [];

  function visit(t: ExportedTag, stack: Set<number>) {
    if (visited.has(t.sourceId)) return;
    if (stack.has(t.sourceId)) {
      throw new Error(`cycle detected involving tag id ${t.sourceId} ("${t.name}")`);
    }
    stack.add(t.sourceId);
    if (t.parentSourceId != null) {
      const parent = byId.get(t.parentSourceId);
      if (parent) visit(parent, stack);
    }
    stack.delete(t.sourceId);
    visited.add(t.sourceId);
    out.push(t);
  }

  for (const t of tags) visit(t, new Set());
  return out;
}

main().catch((err) => {
  console.error('import failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
