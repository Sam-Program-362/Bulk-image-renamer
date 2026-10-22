import { useCallback, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { FileItem, RenameSettings } from '../types';
import {
  DEFAULT_SETTINGS,
  formatBytes,
  getExtension,
  isImageFile,
} from '../types';
import { applyRenameRules, detectConflicts } from '../utils/renameEngine';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useFileRenamer() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [settings, setSettings] = useState<RenameSettings>(DEFAULT_SETTINGS);
  const [folderName, setFolderName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name');
  const [filterImagesOnly, setFilterImagesOnly] = useState(true);

  const addFiles = useCallback(
    (incoming: FileList | File[], sourceFolder?: string) => {
      const list = Array.from(incoming);
      if (sourceFolder) setFolderName(sourceFolder);

      const mapped: FileItem[] = list.map((file) => {
        const isImg = isImageFile(file.name, file.type);
        let previewUrl: string | undefined;
        if (isImg && file.size < 8 * 1024 * 1024) {
          try {
            previewUrl = URL.createObjectURL(file);
          } catch {
            previewUrl = undefined;
          }
        }
        return {
          id: uid(),
          file,
          originalName: file.name,
          newName: file.name,
          extension: getExtension(file.name).toLowerCase(),
          size: file.size,
          type: file.type || 'unknown',
          previewUrl,
          selected: settings.onlyImages ? isImg : true,
          status: 'pending' as const,
        };
      });

      setFiles((prev) => {
        // Dedupe by name+size
        const existing = new Set(prev.map((f) => `${f.originalName}:${f.size}`));
        const fresh = mapped.filter(
          (f) => !existing.has(`${f.originalName}:${f.size}`)
        );
        return [...prev, ...fresh];
      });
    },
    [settings.onlyImages]
  );

  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      return [];
    });
    setFolderName('');
    setDoneCount(0);
    setProgress(0);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f))
    );
  }, []);

  const selectAll = useCallback((value: boolean, imagesOnly = false) => {
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        selected: imagesOnly
          ? value && isImageFile(f.originalName, f.type)
          : value,
      }))
    );
  }, []);

  const updateSettings = useCallback((partial: Partial<RenameSettings>) => {
    setSettings((s) => ({ ...s, ...partial }));
  }, []);

  const previewedFiles = useMemo(() => {
    if (files.length === 0) return [];
    return applyRenameRules(files, settings);
  }, [files, settings]);

  const conflicts = useMemo(
    () => detectConflicts(previewedFiles),
    [previewedFiles]
  );

  const filteredFiles = useMemo(() => {
    let list = previewedFiles;
    if (filterImagesOnly) {
      list = list.filter((f) => isImageFile(f.originalName, f.type));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.originalName.toLowerCase().includes(q) ||
          f.newName.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'size') return b.size - a.size;
      if (sortBy === 'type') return a.extension.localeCompare(b.extension);
      return a.originalName.localeCompare(b.originalName, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
    return list;
  }, [previewedFiles, filterImagesOnly, search, sortBy]);

  const stats = useMemo(() => {
    const selected = previewedFiles.filter((f) => f.selected);
    const changed = selected.filter((f) => f.newName !== f.originalName);
    const images = files.filter((f) => isImageFile(f.originalName, f.type));
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    return {
      total: files.length,
      selected: selected.length,
      changed: changed.length,
      images: images.length,
      conflicts: conflicts.size,
      totalSizeLabel: formatBytes(totalSize),
    };
  }, [previewedFiles, files, conflicts]);

  const downloadRenamed = useCallback(async () => {
    const toExport = applyRenameRules(files, settings).filter(
      (f) => f.selected && (!settings.skipUnchanged || f.newName !== f.originalName)
    );

    // If skip unchanged is on but nothing changed, export all selected
    const exportList =
      toExport.length > 0
        ? toExport
        : applyRenameRules(files, settings).filter((f) => f.selected);

    if (exportList.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setDoneCount(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder(folderName || 'renamed_files') ?? zip;

      for (let i = 0; i < exportList.length; i++) {
        const item = exportList[i];
        folder.file(item.newName, item.file);
        setDoneCount(i + 1);
        setProgress(Math.round(((i + 1) / exportList.length) * 100));
        // Yield to UI every few files
        if (i % 5 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => {
          setProgress(Math.round(meta.percent));
        }
      );

      const stamp = new Date().toISOString().slice(0, 10);
      saveAs(blob, `renamed_${folderName || 'files'}_${stamp}.zip`);
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  }, [files, settings, folderName]);

  const downloadIndividually = useCallback(async () => {
    const exportList = applyRenameRules(files, settings).filter((f) => f.selected);
    if (exportList.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    for (let i = 0; i < exportList.length; i++) {
      const item = exportList[i];
      saveAs(item.file, item.newName);
      setDoneCount(i + 1);
      setProgress(Math.round(((i + 1) / exportList.length) * 100));
      // Small delay so browser doesn't block multiple downloads
      await new Promise((r) => setTimeout(r, 150));
    }

    setIsProcessing(false);
  }, [files, settings]);

  return {
    files: filteredFiles,
    allFiles: files,
    settings,
    folderName,
    isProcessing,
    progress,
    doneCount,
    search,
    sortBy,
    filterImagesOnly,
    conflicts,
    stats,
    setSearch,
    setSortBy,
    setFilterImagesOnly,
    addFiles,
    clearFiles,
    removeFile,
    toggleSelect,
    selectAll,
    updateSettings,
    downloadRenamed,
    downloadIndividually,
  };
}
