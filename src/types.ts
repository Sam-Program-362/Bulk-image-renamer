export interface FileItem {
  id: string;
  file: File;
  originalName: string;
  newName: string;
  extension: string;
  size: number;
  type: string;
  previewUrl?: string;
  selected: boolean;
  status: 'pending' | 'renamed' | 'error' | 'skipped';
  error?: string;
}

export type RenameMode =
  | 'sequential'
  | 'prefix-suffix'
  | 'find-replace'
  | 'date-time'
  | 'case'
  | 'remove-chars'
  | 'template';

export type CaseOption = 'lowercase' | 'uppercase' | 'titlecase' | 'camelcase' | 'kebabcase' | 'snakecase';

export interface RenameSettings {
  mode: RenameMode;
  // Sequential
  baseName: string;
  startNumber: number;
  numberPadding: number;
  separator: string;
  // Prefix / Suffix
  prefix: string;
  suffix: string;
  // Find & Replace
  findText: string;
  replaceText: string;
  caseSensitive: boolean;
  useRegex: boolean;
  // Date
  dateFormat: string;
  includeOriginal: boolean;
  // Case
  caseOption: CaseOption;
  // Remove chars
  removeSpaces: boolean;
  removeSpecial: boolean;
  removeNumbers: boolean;
  customRemove: string;
  // Template
  template: string;
  // Global
  keepExtension: boolean;
  onlyImages: boolean;
  skipUnchanged: boolean;
}

export const DEFAULT_SETTINGS: RenameSettings = {
  mode: 'sequential',
  baseName: 'image',
  startNumber: 1,
  numberPadding: 3,
  separator: '_',
  prefix: '',
  suffix: '',
  findText: '',
  replaceText: '',
  caseSensitive: false,
  useRegex: false,
  dateFormat: 'YYYY-MM-DD',
  includeOriginal: false,
  caseOption: 'lowercase',
  removeSpaces: true,
  removeSpecial: true,
  removeNumbers: false,
  customRemove: '',
  template: '{name}_{n}',
  keepExtension: true,
  onlyImages: true,
  skipUnchanged: true,
};

export const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'avif', 'tiff', 'tif', 'ico',
]);

export function isImageFile(name: string, type?: string): boolean {
  if (type?.startsWith('image/')) return true;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

export function getExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1) : '';
}

export function getBaseName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
