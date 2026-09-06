import { Panel, Toggle, NumberField, Label, Chip } from './Ui.jsx';

export default function RunSettings({ value, onPatch }) {
  const v = value;
  const autoDuration = v.durationMode
    ? v.durationMode === 'auto'
    : v.durationFromVideo !== false;
  return (
    <Panel title="5 · Cấu hình chạy" icon="ph-gear">
      <div className="space-y-2">
        <div className="rounded-xl bg-black p-3">
          <Label>Thời lượng video</Label>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={autoDuration}
              onClick={() => onPatch({ durationMode: 'auto', durationFromVideo: true })}
            >
              Theo video upload
            </Chip>
            <Chip
              active={!autoDuration}
              onClick={() => onPatch({ durationMode: 'manual', durationFromVideo: false })}
            >
              Chọn thủ công
            </Chip>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-[#777777]">
            {autoDuration
              ? 'Mặc định — tự lấy thời lượng video tham chiếu (ref 15s → render 15s, hoặc duration gần nhất model hỗ trợ).'
              : 'Tự chọn 5s / 6s / 7s… ở panel 4 · Model video.'}
          </p>
        </div>
        <Toggle
          label="Random ảnh thời trang"
          checked={v.randomFashion}
          onChange={(x) => onPatch({ randomFashion: x })}
        />
        <Toggle
          label="Random video"
          checked={v.randomVideo}
          onChange={(x) => onPatch({ randomVideo: x })}
        />
        <Toggle
          label="Thời trang dùng 1 lần"
          hint="Chạy xong 1 task sẽ khoá ảnh đó — reset ở panel 2"
          checked={v.fashionOnce}
          onChange={(x) => onPatch({ fashionOnce: x })}
        />
        <Toggle
          label="Video dùng 1 lần"
          hint="Chạy xong 1 task sẽ khoá video đó — reset ở panel 3"
          checked={v.videoOnce}
          onChange={(x) => onPatch({ videoOnce: x })}
        />

        <Toggle
          label="Gửi thông báo Telegram khi thành công"
          checked={v.notifyTelegram}
          onChange={(x) => onPatch({ notifyTelegram: x })}
        />
        {v.notifyTelegram ? (
          <div className="space-y-2 rounded-xl bg-black p-3">
            <Toggle
              label="Đính kèm media"
              checked={v.notifyAttachMedia}
              onChange={(x) => onPatch({ notifyAttachMedia: x })}
            />
            {v.notifyAttachMedia ? (
              <NumberField
                label="Số media đính kèm"
                value={v.notifyMediaCount}
                min={0}
                onChange={(x) => onPatch({ notifyMediaCount: Number(x) || 0 })}
              />
            ) : null}
          </div>
        ) : null}

        <Toggle
          label="Gửi media về Telegram mỗi cụm thành công"
          checked={v.sendGroupMedia}
          onChange={(x) => onPatch({ sendGroupMedia: x })}
        />
        {v.sendGroupMedia ? (
          <div className="rounded-xl bg-black p-3">
            <NumberField
              label="Số video mỗi cụm"
              value={v.groupMediaCount}
              min={1}
              onChange={(x) => onPatch({ groupMediaCount: Math.max(1, Number(x) || 1) })}
            />
          </div>
        ) : null}

        <NumberField
          label="Timeout tạo video"
          suffix="giây"
          value={v.timeoutSeconds}
          min={60}
          onChange={(x) => onPatch({ timeoutSeconds: Math.max(60, Number(x) || 3600) })}
        />
      </div>
    </Panel>
  );
}