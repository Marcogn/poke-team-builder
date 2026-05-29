import { useState } from 'react';
import { Team } from '../../types';
import { NewTeamModal } from '../Modal/NewTeamModal';

interface Props {
  teams: Team[];
  onSelectTeam: (id: string) => void;
  onCreateEmpty: () => void;
  onImport: (text: string) => void;
  onRenameTeam: (id: string, name: string) => void;
  onDuplicateTeam: (id: string) => void;
  onSurpriseMe: () => void;
}

export function TeamsPage({ teams, onSelectTeam, onCreateEmpty, onImport, onRenameTeam, onDuplicateTeam, onSurpriseMe }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function startRename(id: string, name: string) {
    setEditingId(id);
    setEditValue(name);
  }

  function commitRename() {
    if (editingId && editValue.trim()) {
      onRenameTeam(editingId, editValue.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Your Teams</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {teams.map((t) => (
          <div
            key={t.id}
            className="bg-panel border border-panel2 rounded-lg p-3 flex flex-col gap-2 cursor-pointer hover:border-accent transition-colors"
            onClick={() => {
              if (editingId !== t.id) onSelectTeam(t.id);
            }}
          >
            {editingId === t.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold bg-transparent border-b border-accent outline-none px-0.5"
              />
            ) : (
              <span
                className="text-sm font-semibold truncate"
                onDoubleClick={(e) => { e.stopPropagation(); startRename(t.id, t.name); }}
                title="Double-click to rename"
              >
                {t.name}
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {t.members.filter(Boolean).length}/6
            </span>
            {/* Preview: only filled members, max 3 per row, centered (1, 2, 3, 3+1, 3+2, 3+3).
                Width = 3 sprites (w-9 = 2.25rem) + 2 gaps (gap-1 = 0.25rem) = 7.25rem;
                rounded to 7.5rem to leave a hair of breathing room. */}
            <div className="flex flex-wrap justify-center gap-1 mx-auto max-w-[7.5rem]">
              {t.members
                .filter((m): m is NonNullable<typeof m> => m !== null)
                .map((m, i) =>
                  m.spriteUrl ? (
                    <img key={m.id ?? i} src={m.spriteUrl} alt="" className="w-9 h-9 object-contain" />
                  ) : (
                    <div
                      key={m.id ?? i}
                      className="w-9 h-9 rounded-full bg-gray-200 dark:bg-panel2"
                    />
                  ),
                )}
            </div>
            <div className="flex gap-1 justify-end mt-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-panel2 hover:bg-gray-200 dark:hover:bg-panel text-gray-700 dark:text-slate-100"
                onClick={() => onDuplicateTeam(t.id)}
                title="Duplicate team"
                aria-label={`Duplicate ${t.name}`}
              >
                Duplicate
              </button>
            </div>
          </div>
        ))}
        {/* New team card */}
        <div
          className="border-2 border-dashed border-panel2 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-colors min-h-[100px]"
          onClick={() => setModalOpen(true)}
        >
          <span className="text-2xl text-slate-400">+</span>
          <span className="text-xs text-slate-400 mt-1">New team</span>
        </div>
      </div>
      <NewTeamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreateEmpty={onCreateEmpty}
        onImport={onImport}
        onSurpriseMe={onSurpriseMe}
      />
    </div>
  );
}
