import { ActionBar } from './components/ActionBar';
import { DeviceSearch } from './components/DeviceSearch';
import { FileDropZone } from './components/FileDropZone';
import { FileList } from './components/FileList';
import { RenamePanel } from './components/RenamePanel';
import {
  ImageIcon,
  RenameIcon,
  SmartphoneIcon,
  ZapIcon,
} from './components/Icons';
import { useFileRenamer } from './hooks/useFileRenamer';

export default function App() {
  const {
    files,
    allFiles,
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
  } = useFileRenamer();

  const hasFiles = allFiles.length > 0;

  return (
    <div className="min-h-screen bg-[#07110d] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-teal-600/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-lime-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-8 pt-6 sm:pt-10">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                <SmartphoneIcon size={12} />
                Android-friendly
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-900/50">
                  <RenameIcon size={22} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Bulk Rename
                  </h1>
                  <p className="text-sm text-white/50">
                    Mass rename images & files from any folder
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!hasFiles && (
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                {
                  icon: <ImageIcon size={18} className="text-emerald-400" />,
                  title: 'Images first',
                  desc: 'JPG, PNG, WEBP, HEIC…',
                },
                {
                  icon: <ZapIcon size={18} className="text-amber-300" />,
                  title: 'Live preview',
                  desc: 'See names before save',
                },
                {
                  icon: <RenameIcon size={18} className="text-sky-300" />,
                  title: '7 rename modes',
                  desc: 'Number, clean, template…',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 space-y-1.5"
                >
                  <div>{card.icon}</div>
                  <p className="text-xs sm:text-sm font-semibold text-white leading-tight">
                    {card.title}
                  </p>
                  <p className="text-[10px] sm:text-xs text-white/40 leading-snug">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          )}
        </header>

        <main className="space-y-4 sm:space-y-5">
          <FileDropZone onFiles={addFiles} hasFiles={hasFiles} />

          <DeviceSearch onFiles={addFiles} />

          {hasFiles && (
            <>
              <RenamePanel settings={settings} onChange={updateSettings} />

              <FileList
                files={files}
                conflicts={conflicts}
                search={search}
                sortBy={sortBy}
                filterImagesOnly={filterImagesOnly}
                onSearch={setSearch}
                onSort={setSortBy}
                onFilterImages={setFilterImagesOnly}
                onToggle={toggleSelect}
                onRemove={removeFile}
                onSelectAll={selectAll}
              />

              <ActionBar
                stats={stats}
                isProcessing={isProcessing}
                progress={progress}
                doneCount={doneCount}
                folderName={folderName}
                onDownloadZip={downloadRenamed}
                onDownloadEach={downloadIndividually}
                onClear={clearFiles}
              />
            </>
          )}

          {!hasFiles && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white">How it works on Android</h2>
              <ol className="space-y-3 text-sm text-white/60">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    1
                  </span>
                  <span>
                    In the Android app, use <strong className="text-white/90">Search on this device</strong> to find photos & videos by title — or tap Pick folder and choose your Camera or Download album.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    2
                  </span>
                  <span>
                    Choose a rename mode — numbered sequences work great for hundreds of
                    photos (image_001, image_002…).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    3
                  </span>
                  <span>
                    Review the live preview, then download a ZIP with every file already
                    renamed. Extract it to replace the originals.
                  </span>
                </li>
              </ol>
              <p className="text-xs text-white/35 leading-relaxed border-t border-white/10 pt-4">
                Browsers can&apos;t overwrite files directly on your phone for security.
                This app packages everything with the new names so you stay in control —
                no install, no permissions beyond the files you pick.
              </p>
            </section>
          )}
        </main>

        <footer className="mt-10 pb-6 text-center text-[11px] text-white/25">
          Bulk Rename · Runs fully on your device · Files never uploaded
        </footer>
      </div>
    </div>
  );
}
