import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, GripVertical, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import PlaygroundEditor from "../playground/PlaygroundEditor";
import PlaygroundOutput from "../playground/PlaygroundOutput";

const INITIAL_DOC = `; Try a small MeTTa example
(Parent "Tom" "Bob")
(Parent "Tom" "Alice")

!(match &self (Parent "Tom" $x) $x)
`;

interface ChatPlaygroundDockProps {
  isOpen: boolean;
  onToggle: () => void;
}

function ChatPlaygroundDock({ isOpen, onToggle }: ChatPlaygroundDockProps) {
  const { theme } = useTheme();
  const workerRef = useRef<Worker | null>(null);

  const [code, setCode] = useState(INITIAL_DOC);
  const [output, setOutput] = useState("Loading Wasm...");
  const [isRunning, setIsRunning] = useState(false);
  const [requestId, setRequestId] = useState(0);

  const [dockWidth, setDockWidth] = useState(420);
  const [editorHeight, setEditorHeight] = useState(55);

  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1280);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isResizingHeight, setIsResizingHeight] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1280);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/metta.worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current = worker;
    worker.postMessage({ type: "init" });

    worker.onmessage = (event) => {
      const message = event.data;

      if (message.type === "ready") {
        setOutput("Wasm loaded. Run your MeTTa code here.");
        return;
      }

      if (message.type === "result") {
        setIsRunning(false);
        setOutput(message.output);
        return;
      }

      if (message.type === "error") {
        setIsRunning(false);
        setOutput(`Runtime error: ${message.error}`);
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (isResizingWidth && isDesktop) {
        const nextWidth = window.innerWidth - event.clientX;
        setDockWidth(Math.min(720, Math.max(340, nextWidth)));
      }

      if (isResizingHeight) {
        const container = document.getElementById("chat-playground-dock-body");
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const offset = event.clientY - rect.top;
        const percent = (offset / rect.height) * 100;
        setEditorHeight(Math.min(78, Math.max(24, percent)));
      }
    }

    function handleMouseUp() {
      setIsResizingWidth(false);
      setIsResizingHeight(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingWidth, isResizingHeight, isDesktop]);

  const handleRun = () => {
    if (!workerRef.current || isRunning) return;

    setIsRunning(true);
    setOutput("Running...");
    const nextId = requestId + 1;
    setRequestId(nextId);

    workerRef.current.postMessage({
      type: "run",
      requestId: nextId,
      code,
    });
  };

  const dockContent = (
    <div className="h-full min-h-0 flex flex-col bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-l border-zinc-200 dark:border-zinc-800">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            MeTTa Playground
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Test code while chatting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/playground"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            title="Open full playground"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full page
          </Link>

          <button
            onClick={onToggle}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            title="Collapse playground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black px-3 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-4 h-4" />
          {isRunning ? "Running..." : "Run MeTTa"}
        </button>
      </div>

      <div id="chat-playground-dock-body" className="flex-1 min-h-0 flex flex-col">
        <div className="min-h-[220px] min-w-0" style={{ height: `${editorHeight}%` }}>
          <PlaygroundEditor
            value={code}
            onChange={setCode}
            theme={theme}
            className="rounded-none border-0"
          />
        </div>

        <button
          onMouseDown={() => setIsResizingHeight(true)}
          className="h-3 shrink-0 flex items-center justify-center border-y border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/70 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 cursor-row-resize"
          title="Resize editor/output split"
        >
          <GripVertical className="w-4 h-4 rotate-90 text-zinc-500 dark:text-zinc-400" />
        </button>

        <div className="flex-1 min-h-[160px]">
          <PlaygroundOutput
            output={output}
            isRunning={isRunning}
            className="rounded-none border-0"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 text-sm font-medium shadow-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          title="Open MeTTa Playground"
        >
          <ChevronLeft className="w-4 h-4" />
          Playground
        </button>
      )} */}

      {!isDesktop && isOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onToggle} />
      )}

      {isDesktop ? (
        isOpen ? (
          <>
            <div
              onMouseDown={() => setIsResizingWidth(true)}
              className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors"
            />
            <aside
              className="relative h-full shrink-0 min-h-0"
              style={{ width: dockWidth }}
            >
              {dockContent}
            </aside>
          </>
        ) : null
      ) : (
        <aside
          className={[
            "fixed top-0 right-0 z-50 h-screen w-[92vw] max-w-[480px] transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          {dockContent}
        </aside>
      )}
    </>
  );
}

export default ChatPlaygroundDock;