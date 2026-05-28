import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import { Team } from '../../types';
import { exportTeamToShowdown } from '../../utils/showdownParser';

interface Props {
  open: boolean;
  onClose: () => void;
  team: Team;
}

export function ExportModal({ open, onClose, team }: Props) {
  const [copied, setCopied] = useState(false);
  const exported = exportTeamToShowdown(team.members);

  async function handleCopy() {
    await navigator.clipboard.writeText(exported);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([exported], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${team.name || 'team'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Export Team</h2>
        <textarea
          readOnly
          value={exported}
          className="w-full h-48 bg-panel2 rounded p-2 text-xs font-mono"
        />
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-sm rounded bg-panel2 hover:bg-panel"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-panel2 hover:bg-panel"
            onClick={handleDownload}
          >
            Download .txt
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-accent hover:bg-violet-500 font-semibold"
            onClick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
