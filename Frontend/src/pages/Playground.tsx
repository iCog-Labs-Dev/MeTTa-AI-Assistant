import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import PlaygroundEditor from "../components/playground/PlaygroundEditor";
import PlaygroundOutput from "../components/playground/PlaygroundOutput";
import PlaygroundToolbar from "../components/playground/PlaygroundToolbar";
// import { isAuthenticated } from "../lib/auth";

const INITIAL_DOC = `; Try typing inside parentheses for MeTTa-aware suggestions
(: parent (-> Symbol Symbol Atom))
(Parent Tom Bob)
(Parent Tom Alice)

!(match &self (Parent Tom $x) $x)
`;

function Playground() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const workerRef = useRef<Worker | null>(null);

  const [code, setCode] = useState(INITIAL_DOC);
  const [output, setOutput] = useState("Loading Wasm...");
  const [isRunning, setIsRunning] = useState(false);
  const [requestId, setRequestId] = useState(0);

  // // Auth guard: redirect to /login if not authenticated
  // useEffect(() => {
  //   if (!isAuthenticated() && location.pathname !== "/login") {
  //     navigate("/login");
  //   }
  // }, [location.pathname, navigate]);

  // // Don't render chat UI if not authenticated
  // if (!isAuthenticated()) {
  //   return null;
  // }
  
  useEffect(() => {
    const worker = new Worker(new URL("../workers/metta.worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current = worker;
    worker.postMessage({ type: "init" });

    worker.onmessage = (event) => {
      const message = event.data;

      if (message.type === "ready") {
        setOutput("Wasm loaded. Start typing MeTTa.");
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">MeTTa Playground</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Write and execute MeTTa with syntax highlighting and smarter autocomplete.
            </p>
          </div>

          <button
            onClick={() => navigate("/chat")}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Back to Chat
          </button>
        </div>

        <PlaygroundToolbar onRun={handleRun} isRunning={isRunning} />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          <PlaygroundEditor
            value={code}
            onChange={setCode}
            theme={theme}
          />

          <PlaygroundOutput
            output={output}
            isRunning={isRunning}
          />
        </div>
      </div>
    </div>
  );
}

export default Playground;