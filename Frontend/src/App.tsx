import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import Auth from "./pages/Auth";
// import Chat from "./pages/Chat";
// import Admin from "./pages/Admin";
// import NotFoundPage from "./pages/NotFound";
import LearningModePage from "./pages/LearningModePage";
import { useEffect, lazy, Suspense } from "react";
import { isAuthenticated } from "./lib/auth";

const Auth = lazy(() => import("./pages/Auth"));
const Chat = lazy(() => import("./pages/Chat"));
const Admin = lazy(() => import("./pages/Admin"));
const Home = lazy(() => import("./pages/Home"));
const Playground = lazy(() => import("./pages/Playground"));
const NotFoundPage = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50 animate-pulse">
      <div className="flex min-h-screen">
        {/* Sidebar skeleton */}
        <aside className="hidden md:flex w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 flex-col">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="h-6 w-32 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div className="p-4 space-y-3">
            <div className="h-9 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-9 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-9 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div className="px-4 pt-2 space-y-2">
            <div className="h-3 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-8 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-8 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-8 w-5/6 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div className="mt-auto p-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="h-8 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </aside>

        {/* Main content skeleton */}
        <main className="flex-1 flex flex-col">
          {/* Top bar */}
          <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between">
            <div className="h-9 w-36 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* Center content */}
          <div className="flex-1 px-6 py-8">
            <div className="mx-auto max-w-4xl">
              <div className="space-y-4 mb-10">
                <div className="h-10 w-72 mx-auto rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-5 w-96 max-w-full mx-auto rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                <div className="h-24 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                  <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 mb-3" />
                  <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="h-24 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                  <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 mb-3" />
                  <div className="h-3 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="h-24 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                  <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 mb-3" />
                  <div className="h-3 w-44 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="h-24 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                  <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 mb-3" />
                  <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom input skeleton */}
          <div className="p-4">
            <div className="mx-auto max-w-3xl h-16 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 flex items-center justify-between">
              <div className="h-4 w-72 max-w-[70%] rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-9 w-9 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  const authed = isAuthenticated();
  useEffect(() => {
    // Optionally, you can refresh authentication state here if needed
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={authed ? "/chat" : "/login"} replace />}
          />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/learning" element={<LearningModePage />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
