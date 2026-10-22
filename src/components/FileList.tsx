import type { FileItem } from '../types';
import { formatBytes, isImageFile } from '../types';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  FileIcon,
  SearchIcon,
  TrashIcon,
} from './Icons';

interface Props {
  files: FileItem[];
  conflicts: Set<string>;
  search: string;
  sortBy: 'name' | 'size' | 'type';
  filterImagesOnly: boolean;
  onSearch: (v: string) => void;
  onSort: (v: 'name' | 'size' | 'type') => void;
  onFilterImages: (v: boolean) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onSelectAll: (value: boolean, imagesOnly?: boolean) => void;
}

export function FileList({
  files,
  conflicts,
  search,
  sortBy,
  filterImagesOnly,
  onSearch,
  onSort,
  onFilterImages,
  onToggle,
  onRemove,
  onSelectAll,
}: Props) {
  if (files.length === 0 && !search && !filterImagesOnly) {
    return null;
  }

  const selectedCount = files.filter((f) => f.selected).length;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-white/10 space-y-3 bg-white/5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">
            Preview{' '}
            <span className="text-white/40 font-normal">
              ({selectedCount}/{files.length})
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectAll(true, filterImagesOnly)}
              className="text-xs text-emerald-400 font-medium hover:text-emerald-300"
            >
              Select all
            </button>
            <span className="text-white/20">·</span>
            <button
              type="button"
              onClick={() => onSelectAll(false)}
              className="text-xs text-white/50 font-medium hover:text-white/70"
            >
              None
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <SearchIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Filter files…"
              className="w-full rounded-xl bg-black/30 border border-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-400/50"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => onSort(e.target.value as 'name' | 'size' | 'type')}
              className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="name">Sort: Name</option>
              <option value="size">Sort: Size</option>
              <option value="type">Sort: Type</option>
            </select>
            <button
              type="button"
              onClick={() => onFilterImages(!filterImagesOnly)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold border transition ${
                filterImagesOnly
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : 'bg-black/30 border-white/10 text-white/60'
              }`}
            >
              Images
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <ul className="max-h-[min(52vh,520px)] overflow-y-auto divide-y divide-white/5 overscroll-contain">
        {files.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-white/40">
            No files match your filters
          </li>
        ) : (
          files.map((file) => {
            const changed = file.newName !== file.originalName;
            const conflict = conflicts.has(file.id);
            const isImg = isImageFile(file.originalName, file.type);

            return (
              <li
                key={file.id}
                className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 transition ${
                  file.selected ? 'bg-white/[0.03]' : 'opacity-50'
                } ${conflict ? 'bg-red-500/10' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(file.id)}
                  className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-md border transition ${
                    file.selected
                      ? 'bg-emerald-500 border-emerald-400 text-white'
                      : 'border-white/25 bg-transparent'
                  }`}
                  aria-label={file.selected ? 'Deselect' : 'Select'}
                >
                  {file.selected && <CheckIcon size={12} />}
                </button>

                {/* Thumbnail */}
                <div className="shrink-0 h-11 w-11 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : isImg ? (
                    <span className="text-[10px] font-bold text-white/40 uppercase">
                      {file.extension || 'img'}
                    </span>
                  ) : (
                    <FileIcon size={18} className="text-white/30" />
                  )}
                </div>

                {/* Names */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p
                      className={`truncate text-sm ${
                        changed ? 'text-white/50 line-through' : 'text-white font-medium'
                      }`}
                      title={file.originalName}
                    >
                      {file.originalName}
                    </p>
                  </div>
                  {changed && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ArrowRightIcon size={12} className="text-emerald-400 shrink-0" />
                      <p
                        className={`truncate text-sm font-medium ${
                          conflict ? 'text-red-300' : 'text-emerald-300'
                        }`}
                        title={file.newName}
                      >
                        {file.newName}
                      </p>
                    </div>
                  )}
                  <p className="text-[11px] text-white/35">
                    {formatBytes(file.size)}
                    {file.extension ? ` · ${file.extension}` : ''}
                    {conflict && (
                      <span className="text-red-300 inline-flex items-center gap-1 ml-2">
                        <AlertIcon size={11} /> duplicate name
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="shrink-0 p-2 rounded-xl text-white/30 hover:text-red-300 hover:bg-red-500/10 transition"
                  aria-label="Remove file"
                >
                  <TrashIcon size={16} />
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
