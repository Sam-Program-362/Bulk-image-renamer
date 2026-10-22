import type { CaseOption, FileItem, RenameSettings } from '../types';
import { getBaseName, getExtension } from '../types';

function padNumber(n: number, padding: number): string {
  return String(n).padStart(padding, '0');
}

function formatDate(date: Date, format: string): string {
  const yyyy = date.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace(/YYYY/g, yyyy)
    .replace(/YY/g, yy)
    .replace(/MM/g, mm)
    .replace(/DD/g, dd)
    .replace(/HH/g, hh)
    .replace(/mm/g, mi)
    .replace(/ss/g, ss);
}

function applyCase(name: string, option: CaseOption): string {
  switch (option) {
    case 'lowercase':
      return name.toLowerCase();
    case 'uppercase':
      return name.toUpperCase();
    case 'titlecase':
      return name
        .toLowerCase()
        .replace(/(?:^|[\s_-])\w/g, (c) => c.toUpperCase())
        .replace(/[\s_-]+/g, ' ');
    case 'camelcase': {
      const parts = name.split(/[\s_-]+/).filter(Boolean);
      return parts
        .map((p, i) =>
          i === 0
            ? p.toLowerCase()
            : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        )
        .join('');
    }
    case 'kebabcase':
      return name
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
    case 'snakecase':
      return name
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
    default:
      return name;
  }
}

function sanitizeFileName(name: string): string {
  // Remove characters illegal on Android/Windows/common filesystems
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\.+$/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'unnamed';
}

function applyTemplate(
  template: string,
  originalBase: string,
  index: number,
  settings: RenameSettings,
  file: File
): string {
  const date = new Date(file.lastModified || Date.now());
  const now = new Date();

  return template
    .replace(/\{name\}/gi, originalBase)
    .replace(/\{n\}/gi, padNumber(settings.startNumber + index, settings.numberPadding))
    .replace(/\{N\}/g, String(settings.startNumber + index))
    .replace(/\{ext\}/gi, getExtension(file.name))
    .replace(/\{date\}/gi, formatDate(date, settings.dateFormat))
    .replace(/\{today\}/gi, formatDate(now, settings.dateFormat))
    .replace(/\{yyyy\}/gi, String(now.getFullYear()))
    .replace(/\{mm\}/gi, String(now.getMonth() + 1).padStart(2, '0'))
    .replace(/\{dd\}/gi, String(now.getDate()).padStart(2, '0'))
    .replace(/\{size\}/gi, String(file.size));
}

function renameSingle(
  item: FileItem,
  _index: number,
  selectedIndex: number,
  settings: RenameSettings
): string {
  const originalBase = getBaseName(item.originalName);
  const ext = getExtension(item.originalName);
  let base = originalBase;

  switch (settings.mode) {
    case 'sequential': {
      const num = padNumber(settings.startNumber + selectedIndex, settings.numberPadding);
      base = settings.baseName
        ? `${settings.baseName}${settings.separator}${num}`
        : num;
      break;
    }
    case 'prefix-suffix': {
      base = `${settings.prefix}${originalBase}${settings.suffix}`;
      break;
    }
    case 'find-replace': {
      if (!settings.findText) {
        base = originalBase;
        break;
      }
      try {
        if (settings.useRegex) {
          const flags = settings.caseSensitive ? 'g' : 'gi';
          const re = new RegExp(settings.findText, flags);
          base = originalBase.replace(re, settings.replaceText);
        } else if (settings.caseSensitive) {
          base = originalBase.split(settings.findText).join(settings.replaceText);
        } else {
          const re = new RegExp(
            settings.findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'gi'
          );
          base = originalBase.replace(re, settings.replaceText);
        }
      } catch {
        base = originalBase;
      }
      break;
    }
    case 'date-time': {
      const date = new Date(item.file.lastModified || Date.now());
      const formatted = formatDate(date, settings.dateFormat);
      base = settings.includeOriginal
        ? `${originalBase}${settings.separator}${formatted}`
        : formatted;
      // Make unique with index if many share same timestamp
      if (!settings.includeOriginal) {
        base = `${formatted}${settings.separator}${padNumber(
          settings.startNumber + selectedIndex,
          settings.numberPadding
        )}`;
      }
      break;
    }
    case 'case': {
      base = applyCase(originalBase, settings.caseOption);
      break;
    }
    case 'remove-chars': {
      base = originalBase;
      if (settings.removeSpaces) base = base.replace(/\s+/g, '');
      if (settings.removeNumbers) base = base.replace(/\d+/g, '');
      if (settings.removeSpecial) base = base.replace(/[^a-zA-Z0-9._-]/g, '');
      if (settings.customRemove) {
        const chars = settings.customRemove.split('').map((c) =>
          c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        if (chars.length) {
          base = base.replace(new RegExp(`[${chars.join('')}]`, 'g'), '');
        }
      }
      break;
    }
    case 'template': {
      base = applyTemplate(
        settings.template || '{name}_{n}',
        originalBase,
        selectedIndex,
        settings,
        item.file
      );
      break;
    }
    default:
      base = originalBase;
  }

  base = sanitizeFileName(base);

  if (settings.keepExtension && ext) {
    return `${base}.${ext.toLowerCase()}`;
  }
  return base;
}

/** Ensure unique names within the batch (append _2, _3, ...) */
function ensureUnique(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const lower = name.toLowerCase();
    const count = seen.get(lower) ?? 0;
    seen.set(lower, count + 1);
    if (count === 0) return name;

    const ext = getExtension(name);
    const base = getBaseName(name);
    const unique = ext ? `${base}_${count + 1}.${ext}` : `${base}_${count + 1}`;
    // Track the unique name too
    const uLower = unique.toLowerCase();
    let n = seen.get(uLower) ?? 0;
    if (n > 0) {
      // extremely rare cascade
      const again = ext ? `${base}_${count + 1 + n}.${ext}` : `${base}_${count + 1 + n}`;
      seen.set(again.toLowerCase(), 1);
      return again;
    }
    seen.set(uLower, 1);
    return unique;
  });
}

export function applyRenameRules(
  files: FileItem[],
  settings: RenameSettings
): FileItem[] {
  const selected = files.filter((f) => f.selected);
  const selectedIds = new Set(selected.map((f) => f.id));

  // Compute new names only for selected, in current order
  const newNamesRaw = selected.map((item, selectedIndex) => {
    const globalIndex = files.findIndex((f) => f.id === item.id);
    return renameSingle(item, globalIndex, selectedIndex, settings);
  });
  const uniqueNames = ensureUnique(newNamesRaw);

  const nameById = new Map<string, string>();
  selected.forEach((item, i) => {
    nameById.set(item.id, uniqueNames[i]);
  });

  return files.map((item) => {
    if (!selectedIds.has(item.id)) {
      return { ...item, newName: item.originalName, status: 'skipped' as const };
    }
    const newName = nameById.get(item.id) ?? item.originalName;
    const unchanged = newName === item.originalName;
    return {
      ...item,
      newName,
      status: unchanged ? ('pending' as const) : ('renamed' as const),
      error: undefined,
    };
  });
}

export function detectConflicts(files: FileItem[]): Set<string> {
  const counts = new Map<string, number>();
  for (const f of files) {
    if (!f.selected) continue;
    const key = f.newName.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const conflicts = new Set<string>();
  for (const f of files) {
    if (!f.selected) continue;
    if ((counts.get(f.newName.toLowerCase()) ?? 0) > 1) {
      conflicts.add(f.id);
    }
  }
  return conflicts;
}
