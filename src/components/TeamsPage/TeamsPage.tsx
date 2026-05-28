import { useState } from 'react';
import { Team } from '../../types';
import { NewTeamModal } from '../Modal/NewTeamModal';

interface Props {
  teams: Team[];
  onSelectTeam: (id: string) => void;
  onCreateEmpty: () => void;
  onImport: (text: string) => void;
  onRenameTeam: (id: string, name: string) => void;
}

export function TeamsPage({ teams, onSelectTeam, onCreateEmpty, onImport, onRenameTeam }: Props) {
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
            <span className="text-xs text-slate-400">
              {t.members.filter(Boolean).length}/6
            </span>
            <div className="flex gap-1">
              {Array.from({ length: 6 }).map((_, i) => {
                const m = t.members[i];
                return m?.spriteUrl ? (
                  <img key={i} src={m.spriteUrl} alt="" className="w-6 h-6 object-contain" />
                ) : (
                  <div key={i} className="w-6 h-6 rounded-full bg-panel2" />
                );
              })}
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
      />
    </div>
  );
}
