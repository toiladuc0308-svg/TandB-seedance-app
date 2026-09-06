import { Panel, Dropdown, Label, Chip, PanelSkeleton } from './Ui.jsx';
import {
  getMediaOptionsFromSource,
  resolveVideoActiveSource,
  modelHasModePicker,
  getPriceForModelWithSettings,
  getModelNotices,
} from '../lib/modelCatalog.js';
import { formatCredit } from '../utils/format.js';

function OptionGroup({ label, options, value, onChange }) {
  if (!options || options.length === 0) return null;
  if (options.length > 8) {
    return (
      <Dropdown
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        searchable
      />
    );
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o.type} active={o.type === value} onClick={() => onChange(o.type)}>
            {o.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export default function ModelSettings({
  loading,
  error,
  models,
  selectedId,
  onSelectModel,
  settings,
  onPatchSettings,
  prompt,
  onPromptChange,
}) {
  const model = models.find((m) => m.id_base === selectedId) || null;
  const activeSource = model ? resolveVideoActiveSource(model, settings.mode) : null;
  const opts = getMediaOptionsFromSource(activeSource);
  const notices = getModelNotices(model);
  const price = model ? getPriceForModelWithSettings(model, settings, activeSource) : 0;

  const modelOptions = models.map((m) => ({
    type: m.id_base,
    name: m.name || m.id_base,
    description: m.server || '',
  }));

  return (
    <Panel
      title="4 · Model video"
      icon="ph-sliders-horizontal"
      right={
        model ? (
          <span className="text-xs font-bold text-[#c7ff44]">{formatCredit(price)} credit</span>
        ) : null
      }
    >
      {loading ? (
        <PanelSkeleton rows={4} />
      ) : (
        <div className="space-y-3">
          {error ? (
            <p className="rounded-xl bg-[#ef4444]/10 px-3 py-2 text-xs text-[#ef4444]">{error}</p>
          ) : null}

          <Dropdown
            label="Model"
            value={selectedId}
            options={modelOptions}
            onChange={onSelectModel}
            placeholder="Chọn model video"
            searchable
          />

          {notices?.select1?.message ? (
            <p className="rounded-xl bg-[#f59e0b]/10 px-3 py-2 text-[11px] text-[#f59e0b]">
              {notices.select1.title ? `${notices.select1.title}: ` : ''}
              {notices.select1.message}
            </p>
          ) : null}

          <OptionGroup
            label="Tỉ lệ"
            options={opts.ratios}
            value={settings.ratio}
            onChange={(v) => onPatchSettings({ ratio: v })}
          />
          <OptionGroup
            label="Độ phân giải"
            options={opts.resolutions}
            value={settings.resolution}
            onChange={(v) => onPatchSettings({ resolution: v })}
          />
          {opts.durations.length > 0 ? (
            <div>
              <OptionGroup
                label="Thời lượng (thủ công)"
                options={opts.durations}
                value={settings.duration}
                onChange={(v) => onPatchSettings({ duration: v })}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-[#777777]">
                Khi panel 5 đang bật “Theo video upload”, giá trị này sẽ được ghi đè theo thời
                lượng video tham chiếu.
              </p>
            </div>
          ) : null}
          {modelHasModePicker(activeSource) ? (
            <OptionGroup
              label="Mode"
              options={opts.modes}
              value={settings.mode}
              onChange={(v) => onPatchSettings({ mode: v })}
            />
          ) : null}

          <div>
            <Label>Prompt</Label>
            <textarea
              rows={8}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              className="sb-scroll w-full rounded-xl border-0 bg-black px-3 py-2.5 text-xs leading-relaxed text-white outline-none placeholder:text-[#777777] focus:ring-2 focus:ring-[#c7ff44]/35"
            />
            <p className="mt-1 text-[11px] text-[#777777]">
              @image1 = nhân vật · @image2 = thời trang · @video1 = video gốc
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}