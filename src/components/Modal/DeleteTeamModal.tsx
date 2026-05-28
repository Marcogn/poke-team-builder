import { Modal } from '../Modal/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  teamName: string;
}

export function DeleteTeamModal({ open, onClose, onConfirm, teamName }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Delete Team</h2>
        <p className="text-sm text-slate-300">
          Are you sure you want to delete <strong>{teamName}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-sm rounded bg-panel2 hover:bg-panel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-red-700 hover:bg-red-600 font-semibold"
            onClick={() => { onConfirm(); onClose(); }}
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}
