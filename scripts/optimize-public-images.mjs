#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const VALID_MODES = new Set(['audit', 'convert']);
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const DEFAULT_INCLUDE_DIRECTORIES = ['Birthday', 'v1.2.2', 'services'];
const DEFAULT_EXCLUDE_PATTERNS = [/^leaflet\//i, /^icon\.png$/i];

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join('/');
}

function parseCsv(input) {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPathPrefixRegExp(value) {
  const normalized = value.replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return null;
  }

  return new RegExp(`^${escapeRegExp(normalized)}(?:/|$)`, 'i');
}

function parseIntegerOption(name, value, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${name}: ${value}. Expected an integer between ${min} and ${max}.`);
  }

  return parsed;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function toWebpPath(relativePath) {
  return relativePath.replace(/\.(png|jpe?g)$/i, '.webp');
}

function resolveQuality(sourceBytes, hasAlpha, baseQuality) {
  if (hasAlpha) {
    if (sourceBytes >= 1_500_000) {
      return Math.max(70, baseQuality - 8);
    }

    if (sourceBytes >= 800_000) {
      return Math.max(72, baseQuality - 6);
    }

    return Math.max(74, baseQuality - 4);
  }

  if (sourceBytes >= 2_500_000) {
    return Math.max(68, baseQuality - 10);
  }

  if (sourceBytes >= 1_500_000) {
    return Math.max(70, baseQuality - 8);
  }

  if (sourceBytes >= 800_000) {
    return Math.max(72, baseQuality - 6);
  }

  return baseQuality;
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function collectFilesRecursively(rootDirectory, currentDirectory = rootDirectory) {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const collected = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFilesRecursively(rootDirectory, absolutePath);
      collected.push(...nested);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    collected.push(toPosixPath(path.relative(rootDirectory, absolutePath)));
  }

  return collected;
}

const { values } = parseArgs({
  options: {
    mode: {
      type: 'string',
      default: 'audit',
    },
    include: {
      type: 'string',
      default: DEFAULT_INCLUDE_DIRECTORIES.join(','),
    },
    exclude: {
      type: 'string',
      default: '',
    },
    includeAll: {
      type: 'boolean',
      default: false,
    },
    overwrite: {
      type: 'boolean',
      default: false,
    },
    publicDir: {
      type: 'string',
      default: 'public',
    },
    reportDir: {
      type: 'string',
      default: 'audit-output',
    },
    quality: {
      type: 'string',
      default: '78',
    },
    effort: {
      type: 'string',
      default: '5',
    },
  },
  allowPositionals: false,
});

const mode = String(values.mode).toLowerCase();
if (!VALID_MODES.has(mode)) {
  throw new Error(`Unsupported mode "${values.mode}". Use "audit" or "convert".`);
}

const baseQuality = parseIntegerOption('quality', values.quality, 1, 100);
const effort = parseIntegerOption('effort', values.effort, 0, 6);
const includeAll = Boolean(values.includeAll);
const overwrite = Boolean(values.overwrite);
const includeDirectories = includeAll ? [] : parseCsv(values.include).map((value) => value.toLowerCase());
const customExcludePatterns = parseCsv(values.exclude)
  .map(toPathPrefixRegExp)
  .filter(Boolean);
const excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...customExcludePatterns];

const publicDirectory = path.resolve(process.cwd(), String(values.publicDir));
const reportDirectory = path.resolve(process.cwd(), String(values.reportDir));
const collectedFiles = await collectFilesRecursively(publicDirectory);

const candidates = collectedFiles.filter((relativePath) => {
  const extension = path.extname(relativePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return false;
  }

  if (excludePatterns.some((pattern) => pattern.test(relativePath))) {
    return false;
  }

  if (includeDirectories.length === 0) {
    return true;
  }

  return includeDirectories.some(
    (directory) => relativePath.toLowerCase() === directory || relativePath.toLowerCase().startsWith(`${directory}/`),
  );
});

const records = [];
for (const relativePath of candidates) {
  const sourceAbsolutePath = path.join(publicDirectory, relativePath);
  const targetRelativePath = toWebpPath(relativePath);
  const targetAbsolutePath = path.join(publicDirectory, targetRelativePath);

  try {
    const [sourceStats, metadata, existingTargetStats] = await Promise.all([
      fs.stat(sourceAbsolutePath),
      sharp(sourceAbsolutePath).metadata(),
      safeStat(targetAbsolutePath),
    ]);

    const sourceBytes = sourceStats.size;
    const chosenQuality = resolveQuality(sourceBytes, Boolean(metadata.hasAlpha), baseQuality);
    let targetBytes = existingTargetStats?.size ?? null;
    let status = 'existing';

    if (!existingTargetStats || overwrite) {
      const webpBuffer = await sharp(sourceAbsolutePath)
        .webp({
          quality: chosenQuality,
          alphaQuality: Math.min(chosenQuality + 6, 100),
          effort,
          smartSubsample: true,
        })
        .toBuffer();

      targetBytes = webpBuffer.length;
      if (mode === 'convert') {
        await fs.writeFile(targetAbsolutePath, webpBuffer);
      }

      status = mode === 'convert'
        ? existingTargetStats
          ? 'reconverted'
          : 'converted'
        : existingTargetStats
          ? 'reaudited'
          : 'audited';
    } else if (mode === 'convert') {
      status = 'skipped-existing';
    }

    const savedBytes = targetBytes === null ? null : sourceBytes - targetBytes;
    const savedPercent = savedBytes === null || sourceBytes === 0
      ? null
      : Number(((savedBytes / sourceBytes) * 100).toFixed(2));

    records.push({
      sourcePath: relativePath,
      targetPath: targetRelativePath,
      status,
      sourceBytes,
      targetBytes,
      savedBytes,
      savedPercent,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      hasAlpha: Boolean(metadata.hasAlpha),
      quality: chosenQuality,
    });
  } catch (error) {
    records.push({
      sourcePath: relativePath,
      targetPath: targetRelativePath,
      status: 'error',
      sourceBytes: null,
      targetBytes: null,
      savedBytes: null,
      savedPercent: null,
      width: null,
      height: null,
      hasAlpha: null,
      quality: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

const summary = records.reduce(
  (accumulator, record) => {
    accumulator.statusCounts[record.status] = (accumulator.statusCounts[record.status] ?? 0) + 1;

    if (typeof record.sourceBytes === 'number') {
      accumulator.totalSourceBytes += record.sourceBytes;
    }

    if (typeof record.targetBytes === 'number') {
      accumulator.totalTargetBytes += record.targetBytes;
    }

    if (typeof record.savedBytes === 'number') {
      accumulator.totalSavedBytes += record.savedBytes;
    }

    return accumulator;
  },
  {
    totalCandidates: records.length,
    totalSourceBytes: 0,
    totalTargetBytes: 0,
    totalSavedBytes: 0,
    statusCounts: {},
  },
);

const totalSavedPercent = summary.totalSourceBytes === 0
  ? 0
  : Number(((summary.totalSavedBytes / summary.totalSourceBytes) * 100).toFixed(2));

const generatedAt = new Date().toISOString();
const timestamp = generatedAt.replace(/[:.]/g, '-');
const reportPath = path.join(reportDirectory, `public-image-webp-${mode}-${timestamp}.json`);
const reportPayload = {
  generatedAt,
  mode,
  publicDirectory: toPosixPath(path.relative(process.cwd(), publicDirectory)),
  includeAll,
  includeDirectories,
  excludePatterns: excludePatterns.map((pattern) => pattern.source),
  quality: baseQuality,
  effort,
  overwrite,
  summary: {
    ...summary,
    totalSavedPercent,
  },
  files: records.sort((a, b) => {
    const aBytes = typeof a.sourceBytes === 'number' ? a.sourceBytes : 0;
    const bBytes = typeof b.sourceBytes === 'number' ? b.sourceBytes : 0;
    return bBytes - aBytes;
  }),
};

await fs.mkdir(reportDirectory, { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(reportPayload, null, 2)}\n`, 'utf8');

console.log(`[webp:${mode}] Candidates: ${summary.totalCandidates}`);
console.log(`[webp:${mode}] Source bytes: ${formatBytes(summary.totalSourceBytes)}`);
console.log(`[webp:${mode}] WebP bytes: ${formatBytes(summary.totalTargetBytes)}`);
console.log(`[webp:${mode}] Savings: ${formatBytes(summary.totalSavedBytes)} (${totalSavedPercent}%)`);
console.log(`[webp:${mode}] Status: ${JSON.stringify(summary.statusCounts)}`);
console.log(`[webp:${mode}] Report: ${toPosixPath(path.relative(process.cwd(), reportPath))}`);

if ((summary.statusCounts.error ?? 0) > 0) {
  process.exitCode = 1;
}