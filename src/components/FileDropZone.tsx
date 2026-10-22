import { useCallback, useRef, useState } from 'react';
import { FolderIcon, ImageIcon, PlusIcon } from './Icons';

interface Props {
  onFiles: (files: FileList | File[], folderName?: string) => void;
  hasFiles: boolean;
}

export function FileDropZone({ onFiles, hasFiles }: Props) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (list: FileList | null, fromFolder = false) => {
      if (!list || list.length === 0) return;
      const files = Array.from(list);
      let folderName: string | undefined;
      if (fromFolder && files[0]) {
        const path = (files[0] as File & { webkitRelativePath?: string })
          .webkitRelativePath;
        if (path) folderName = path.split('/')[0];
      }
      onFiles(files, folderName);
    },
    [onFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 ${
        dragging
          ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
          : hasFiles
            ? 'border-white/10 bg-white/5'
            : 'border-white/15 bg-gradient-to-br from-white/10 to-white/5'
      }`}
    >
      <div
        className={`flex flex-col items-center justify-center gap-4 px-6 ${
          hasFiles ? 'py-6' : 'py-14'
        }`}
      >
        {!hasFiles && (
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-2xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-900/40">
              <FolderIcon size={36} className="text-white" />
            </div>
          </div>
        )}

        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-white">
            {hasFiles ? 'Add more files' : 'Select a folder or images'}
          </h2>
          <p className="text-sm text-white/50 max-w-xs mx-auto">
            {hasFiles
              ? 'Drop more files here or pick another folder'
              : 'Bulk rename hundreds of photos at once. Works great on Android Chrome.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 active:scale-95 transition hover:bg-emerald-400"
          >
            <FolderIcon size={18} />
            Pick folder
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white border border-white/15 active:scale-95 transition hover:bg-white/15"
          >
            {hasFiles ? <PlusIcon size={18} /> : <ImageIcon size={18} />}
            {hasFiles ? 'Add files' : 'Pick images'}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,.avif,.svg"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folderRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files, true);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
