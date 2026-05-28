import { useState } from 'react';
import { Modal } from '../Modal/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreateEmpty: () => void;
  onImport: (text: string) => void;
}

export function NewTeamModal({ open, onClose, onCreateEmpty, onImport }: Props) {
  const [mode, setMode] = useState<'choose' | 'import'>('choose');
  const [text, setText] = useState('');

  function handleClose() {
    setMode('choose');
    setText('');
    onClose();
  }

  function handleImport() {
    if (text.trim()) {
      onImport(text);
      setMode('choose');
      setText('');
    }
  }

  return (
    <Modal open={open} onClose={handleClose}>
      {mode === 'choose' ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">New Team</h2>
          <button
            className="px-4 py-3 rounded bg-accent hover:bg-violet-500 font-semibold text-left"
            onClick={() => { onCreateEmpty(); handleClose(); }}
          >
            Create empty team
          </button>
          <button
            className="px-4 py-3 rounded bg-panel2 hover:bg-panel font-semibold text-left"
            onClick={() => setMode('import')}
          >
            Import from Showdown
          </button>
          <button
            className="text-xs text-slate-400 hover:text-slate-200 self-end"
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Import from Showdown</h2>
          <textarea
            placeholder="Paste your Showdown export here"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-40 bg-panel2 rounded p-2 text-xs font-mono"
          />
          <div className="flex gap-2 justify-end">
            <button
              className="px-3 py-1.5 text-sm rounded bg-panel2 hover:bg-panel"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded bg-accent hover:bg-violet-500 font-semibold"
              onClick={handleImport}
            >
              Import
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
