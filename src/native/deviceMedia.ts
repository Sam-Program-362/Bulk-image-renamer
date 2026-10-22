import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Bridge to the native DeviceMedia plugin
 * (android/app/src/main/java/com/bulkrenamer/app/DeviceMediaPlugin.java).
 *
 * On the web these calls are unavailable — the UI hides the device-search
 * panel unless `isNative()` is true, and the regular file/folder picker
 * remains the way to add files.
 */

export type MediaKind = 'image' | 'video';

export interface DeviceMediaItem {
  /** MediaStore row id (stringified long). */
  id: string;
  /** MediaStore TITLE column (name without extension), may be null. */
  title: string | null;
  displayName: string;
  mimeType: string;
  size: number;
  /** Milliseconds since epoch. */
  dateModified: number;
  kind: MediaKind;
  /** content:// uri for this item. */
  uri: string;
  width?: number;
  height?: number;
  /** Video duration in ms. */
  duration?: number;
}

export interface StagedFile {
  id: string;
  /** Name inside the staging cache dir. */
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  /** Absolute file:// path in the app cache. */
  path: string;
}

export type MediaFilter =
  | 'all'
  | 'images'
  | 'gif'
  | 'jpg'
  | 'png'
  | 'webp'
  | 'videos'
  | 'mp4';

const FILTER_MIME_TYPES: Record<MediaFilter, string[] | undefined> = {
  all: undefined,
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/avif',
    'image/bmp',
  ],
  gif: ['image/gif'],
  jpg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  videos: ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/3gpp'],
  mp4: ['video/mp4'],
};

interface DeviceMediaPlugin {
  search(options: {
    query?: string;
    mimeTypes?: string[];
    limit?: number;
  }): Promise<{ items: DeviceMediaItem[]; count: number }>;
  stageFiles(options: { ids: string[] }): Promise<{ files: StagedFile[] }>;
  checkPermission(): Promise<{ granted: boolean }>;
}

const DeviceMedia = registerPlugin<DeviceMediaPlugin>('DeviceMedia');

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Thumbnail/preview URL for a device item (works in the Capacitor WebView). */
export function mediaPreviewUrl(item: DeviceMediaItem): string {
  return Capacitor.convertFileSrc(item.uri);
}

/** Search the whole device media library by title / file name. */
export async function searchDeviceMedia(
  query: string,
  filter: MediaFilter,
  limit = 200
): Promise<DeviceMediaItem[]> {
  const { items } = await DeviceMedia.search({
    query: query.trim(),
    mimeTypes: FILTER_MIME_TYPES[filter],
    limit,
  });
  return items;
}

/**
 * Loads selected device items as web `File`s so they can join the normal
 * rename queue (preview, rename rules, ZIP export all work unchanged).
 * Native side copies each item into the app cache; we stream it from there.
 */
export async function loadDeviceFiles(items: DeviceMediaItem[]): Promise<File[]> {
  if (items.length === 0) return [];
  const { files } = await DeviceMedia.stageFiles({ ids: items.map((i) => i.id) });
  const byId = new Map(items.map((i) => [i.id, i]));

  const loaded: File[] = [];
  for (const staged of files) {
    const url = Capacitor.convertFileSrc(`file://${staged.path}`);
    const response = await fetch(url);
    if (!response.ok) continue;
    const blob = await response.blob();
    const original = byId.get(staged.id);
    loaded.push(
      new File([blob], staged.originalName, {
        type: staged.mimeType || original?.mimeType || blob.type,
        lastModified: original?.dateModified ?? Date.now(),
      })
    );
  }
  return loaded;
}
