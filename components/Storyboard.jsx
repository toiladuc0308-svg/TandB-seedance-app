import SceneCard from './SceneCard.jsx';
import BulkDownload from './BulkDownload.jsx';
import ProjectLibrary from './ProjectLibrary.jsx';
import { Chip, Label } from './Ui.jsx';

export default function Storyboard({ session, columns, onColumns, timeoutSeconds, onRetry, tick }) {
  if (!session) {
    return (
      <div className="flex w-full flex-col gap-3">
        <div className="flex min-h-[240px] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-[#1a1a1a] p-6 text-center">
          <i className="ph ph-squares-four text-3xl text-[#333333]" aria-hidden="true" />
          <p className="text-sm text-[#777777]">
            Chưa có phiên nào. Cấu hình bên trái rồi bấm <span className="text-[#c7ff44]">Tạo</span>.
          </p>
        </div>
        <ProjectLibrary refreshSignal={0} />
      </div>
    );
  }

  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(1, Number(columns) || 4)}, minmax(0, 1fr))`,
  };

  const doneCount = session.scenes.filter((s) => s.status === 'done').length;

  return (
    <div className="flex w-full flex-col gap-3">
    <div className="w-full rounded-2xl bg-[#1a1a1a] p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <i className="ph ph-film-script text-[#c7ff44]" aria-hidden="true" />
          <h3 className="text-sm font-bold text-white">{session.name}</h3>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-[#b0b0b0]">
            {session.scenes.filter((s) => s.status === 'done').length}/{session.scenes.length} xong
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BulkDownload scenes={session.scenes} sessionName={session.name} />
          <Label>Cột</Label>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Chip key={n} active={Number(columns) === n} onClick={() => onColumns(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-3" style={gridStyle}>
        {session.scenes.map((scene, i) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={i}
            timeoutSeconds={timeoutSeconds}
            onRetry={onRetry}
            tick={tick}
          />
        ))}
      </div>
    </div>
    <ProjectLibrary refreshSignal={doneCount} />
    </div>
  );
}