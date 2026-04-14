import init, { run_metta, type InitOutput } from "../../metta-playground/pkg/metta_playground";

let initPromise: Promise<InitOutput> | null = null;

function ensureInit(): Promise<InitOutput> {
  if (!initPromise) {
    initPromise = init();
  }
  return initPromise;
}

self.onmessage = async (event: MessageEvent) => {
  const message = event.data;

  try {
    if (message.type === 'init') {
      await ensureInit();
      self.postMessage({ type: 'ready' });
      return;
    }

    if (message.type === 'run') {
      await ensureInit();
      const output = run_metta(message.code);
      self.postMessage({ type: 'result', requestId: message.requestId, output });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: message?.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
