interface Props {
  onResetCache: () => void;
  installAvailable: boolean;
  onInstall: () => void;
}

export function Settings({ onResetCache, installAvailable, onInstall }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <button
        className="text-xs px-3 py-2 bg-panel2 rounded hover:bg-panel text-left"
        onClick={onResetCache}
      >
        Reset data cache
        <div className="text-[10px] text-slate-400">
          Clears cached Pokémon, moves and type chart, then re-fetches from PokéAPI.
        </div>
      </button>
      {installAvailable && (
        <button
          className="text-xs px-3 py-2 bg-accent rounded hover:bg-violet-500 text-left"
          onClick={onInstall}
        >
          Install App
        </button>
      )}
    </div>
  );
}
