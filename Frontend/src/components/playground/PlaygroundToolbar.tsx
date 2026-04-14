interface PlaygroundToolbarProps {
  onRun: () => void;
  isRunning: boolean;
}

function PlaygroundToolbar({ onRun, isRunning }: PlaygroundToolbarProps) {
  return (
    <div className="flex items-center justify-end rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3">
      <button
        onClick={onRun}
        disabled={isRunning}
        className="px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300 transition-colors"
      >
        {isRunning ? "Running..." : "Run MeTTa"}
      </button>
    </div>
  );
}

export default PlaygroundToolbar;