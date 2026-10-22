import type { RenameMode, RenameSettings } from '../types';
import { SettingsIcon, ZapIcon } from './Icons';

interface Props {
  settings: RenameSettings;
  onChange: (partial: Partial<RenameSettings>) => void;
}

const MODES: { id: RenameMode; label: string; hint: string }[] = [
  { id: 'sequential', label: 'Numbered', hint: 'image_001, image_002…' },
  { id: 'prefix-suffix', label: 'Prefix / Suffix', hint: 'Add text before or after' },
  { id: 'find-replace', label: 'Find & Replace', hint: 'Swap text in names' },
  { id: 'date-time', label: 'Date stamp', hint: 'Use file or today date' },
  { id: 'case', label: 'Change case', hint: 'lower, UPPER, Title…' },
  { id: 'remove-chars', label: 'Clean names', hint: 'Strip spaces & symbols' },
  { id: 'template', label: 'Template', hint: '{name}_{n}_{date}' },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 transition';

const selectClass = inputClass;

export function RenamePanel({ settings, onChange }: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
        <SettingsIcon size={18} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Rename rules</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Mode chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ mode: m.id })}
              className={`shrink-0 rounded-2xl px-3.5 py-2 text-xs font-semibold transition border ${
                settings.mode === m.id
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-900/40'
                  : 'bg-black/20 text-white/70 border-white/10 hover:bg-white/10'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-white/40 -mt-2">
          {MODES.find((m) => m.id === settings.mode)?.hint}
        </p>

        {/* Mode-specific fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {settings.mode === 'sequential' && (
            <>
              <Field label="Base name">
                <input
                  className={inputClass}
                  value={settings.baseName}
                  onChange={(e) => onChange({ baseName: e.target.value })}
                  placeholder="image"
                />
              </Field>
              <Field label="Start number">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={settings.startNumber}
                  onChange={(e) =>
                    onChange({ startNumber: Number(e.target.value) || 0 })
                  }
                />
              </Field>
              <Field label="Zero padding">
                <input
                  type="number"
                  min={1}
                  max={8}
                  className={inputClass}
                  value={settings.numberPadding}
                  onChange={(e) =>
                    onChange({
                      numberPadding: Math.min(8, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                />
              </Field>
              <Field label="Separator">
                <input
                  className={inputClass}
                  value={settings.separator}
                  onChange={(e) => onChange({ separator: e.target.value })}
                  placeholder="_"
                  maxLength={3}
                />
              </Field>
            </>
          )}

          {settings.mode === 'prefix-suffix' && (
            <>
              <Field label="Prefix">
                <input
                  className={inputClass}
                  value={settings.prefix}
                  onChange={(e) => onChange({ prefix: e.target.value })}
                  placeholder="vacation_"
                />
              </Field>
              <Field label="Suffix">
                <input
                  className={inputClass}
                  value={settings.suffix}
                  onChange={(e) => onChange({ suffix: e.target.value })}
                  placeholder="_final"
                />
              </Field>
            </>
          )}

          {settings.mode === 'find-replace' && (
            <>
              <Field label="Find">
                <input
                  className={inputClass}
                  value={settings.findText}
                  onChange={(e) => onChange({ findText: e.target.value })}
                  placeholder="IMG_"
                />
              </Field>
              <Field label="Replace with">
                <input
                  className={inputClass}
                  value={settings.replaceText}
                  onChange={(e) => onChange({ replaceText: e.target.value })}
                  placeholder="photo_"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-white/70 pt-6">
                <input
                  type="checkbox"
                  checked={settings.caseSensitive}
                  onChange={(e) => onChange({ caseSensitive: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                Case sensitive
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70 pt-6">
                <input
                  type="checkbox"
                  checked={settings.useRegex}
                  onChange={(e) => onChange({ useRegex: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                Use regex
              </label>
            </>
          )}

          {settings.mode === 'date-time' && (
            <>
              <Field label="Date format">
                <select
                  className={selectClass}
                  value={settings.dateFormat}
                  onChange={(e) => onChange({ dateFormat: e.target.value })}
                >
                  <option value="YYYY-MM-DD">2026-03-22</option>
                  <option value="YYYYMMDD">20260322</option>
                  <option value="DD-MM-YYYY">22-03-2026</option>
                  <option value="YYYY-MM-DD_HHmmss">2026-03-22_143052</option>
                  <option value="YYYY/MM/DD">2026/03/22</option>
                </select>
              </Field>
              <Field label="Separator">
                <input
                  className={inputClass}
                  value={settings.separator}
                  onChange={(e) => onChange({ separator: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-white/70 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={settings.includeOriginal}
                  onChange={(e) => onChange({ includeOriginal: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                Keep original name + date
              </label>
            </>
          )}

          {settings.mode === 'case' && (
            <Field label="Case style">
              <select
                className={selectClass}
                value={settings.caseOption}
                onChange={(e) =>
                  onChange({
                    caseOption: e.target.value as RenameSettings['caseOption'],
                  })
                }
              >
                <option value="lowercase">lowercase</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="titlecase">Title Case</option>
                <option value="camelcase">camelCase</option>
                <option value="kebabcase">kebab-case</option>
                <option value="snakecase">snake_case</option>
              </select>
            </Field>
          )}

          {settings.mode === 'remove-chars' && (
            <>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={settings.removeSpaces}
                  onChange={(e) => onChange({ removeSpaces: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                Remove spaces
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={settings.removeSpecial}
                  onChange={(e) => onChange({ removeSpecial: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                Remove special chars
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={settings.removeNumbers}
                  onChange={(e) => onChange({ removeNumbers: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                Remove numbers
              </label>
              <Field label="Also remove these chars">
                <input
                  className={inputClass}
                  value={settings.customRemove}
                  onChange={(e) => onChange({ customRemove: e.target.value })}
                  placeholder="e.g. -~"
                />
              </Field>
            </>
          )}

          {settings.mode === 'template' && (
            <>
              <div className="sm:col-span-2">
                <Field label="Template pattern">
                  <input
                    className={inputClass}
                    value={settings.template}
                    onChange={(e) => onChange({ template: e.target.value })}
                    placeholder="{name}_{n}"
                  />
                </Field>
                <p className="mt-2 text-[11px] text-white/40 leading-relaxed">
                  Tokens: {'{name}'} {'{n}'} {'{N}'} {'{date}'} {'{today}'} {'{yyyy}'}{' '}
                  {'{mm}'} {'{dd}'} {'{ext}'} {'{size}'}
                </p>
              </div>
              <Field label="Start #">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.startNumber}
                  onChange={(e) =>
                    onChange({ startNumber: Number(e.target.value) || 0 })
                  }
                />
              </Field>
              <Field label="Padding">
                <input
                  type="number"
                  min={1}
                  max={8}
                  className={inputClass}
                  value={settings.numberPadding}
                  onChange={(e) =>
                    onChange({ numberPadding: Number(e.target.value) || 1 })
                  }
                />
              </Field>
            </>
          )}
        </div>

        {/* Global options */}
        <div className="flex flex-wrap gap-4 pt-2 border-t border-white/10">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={settings.keepExtension}
              onChange={(e) => onChange({ keepExtension: e.target.checked })}
              className="rounded accent-emerald-500"
            />
            Keep extension
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={settings.onlyImages}
              onChange={(e) => onChange({ onlyImages: e.target.checked })}
              className="rounded accent-emerald-500"
            />
            Prefer images
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={settings.skipUnchanged}
              onChange={(e) => onChange({ skipUnchanged: e.target.checked })}
              className="rounded accent-emerald-500"
            />
            Skip unchanged in ZIP
          </label>
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-3 py-2.5">
          <ZapIcon size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-100/80 leading-relaxed">
            Preview updates live. Download a ZIP with all renamed files — perfect
            for Android when the system won&apos;t rename in place.
          </p>
        </div>
      </div>
    </div>
  );
}
