interface PlaygroundOutputProps {
  output: string;
  isRunning: boolean;
  className?: string;
}

function PlaygroundOutput({
  output,
  isRunning,
  className = "",
}: PlaygroundOutputProps) {
  return (
    <div
      className={`h-full min-h-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden ${className}`}
    >
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Output
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {isRunning ? "Running..." : "Execution result"}
        </p>
      </div>

      <div className="h-[calc(100%-57px)] min-h-0 overflow-auto">
        <pre className="p-4 text-sm leading-7 whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
          {output}
        </pre>
      </div>
    </div>
  );
}

export default PlaygroundOutput;