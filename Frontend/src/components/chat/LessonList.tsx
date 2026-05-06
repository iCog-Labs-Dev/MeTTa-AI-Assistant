import React from "react";

interface LessonListProps {
  modules: Array<{ id: string; title: string; description?: string }>;
  onSelect?: (id: string) => void;
}

const LessonList: React.FC<LessonListProps> = ({ modules, onSelect }) => {
  if (!modules || modules.length === 0) return null;
  return (
    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
      <h2 className="text-lg font-semibold mb-2 text-blue-700 dark:text-blue-200">
        Lessons
      </h2>
      <ul className="space-y-2">
        {modules.map((mod) => (
          <li key={mod.id} className="flex items-center justify-between">
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-100">
                {mod.title}
              </span>
              {mod.description && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-300">
                  {mod.description}
                </span>
              )}
            </div>
            {onSelect && (
              <button
                className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700"
                onClick={() => onSelect(mod.id)}
              >
                Go
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LessonList;
