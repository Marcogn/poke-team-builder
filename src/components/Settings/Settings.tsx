interface Props {
  installAvailable: boolean;
  onInstall: () => void;
}

export function Settings({ installAvailable, onInstall }: Props) {
  return (
    <div className="flex flex-col gap-2">
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
