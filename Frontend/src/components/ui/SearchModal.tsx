import React, { useState, useEffect, useRef } from 'react';

interface SearchModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  items: T[];
  filterFn: (item: T, query: string) => boolean;
  renderItem: (item: T, isActive: boolean) => React.ReactNode;
  onSelectItem: (item: T) => void;
}

export function SearchModal<T>({ 
  isOpen, 
  onClose, 
  items, 
  filterFn, 
  renderItem, 
  onSelectItem 
}: SearchModalProps<T>) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = query ? items.filter(item => filterFn(item, query)) : [];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      inputRef.current?.focus();
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        if (filteredItems[activeIndex]) {
          onSelectItem(filteredItems[activeIndex]);
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, activeIndex, filteredItems, onSelectItem]);

  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Use a timeout to allow the component to mount before adding transition classes
      const timer = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [isOpen]);

  // We need to delay unmounting to allow for the closing animation.
  // Since the parent controls `isOpen`, we'll animate in and let it disappear on close.
  // For a full exit animation, a library like `react-transition-group` would be better.
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-[15vh] transition-opacity duration-300 ease-in-out ${show ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg transition-all duration-300 ease-in-out ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full px-4 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
          />
          <div className="mt-2 max-h-[50vh] overflow-y-auto scrollbar-thin">
            {filteredItems.length > 0 ? (
              <ul>
                {filteredItems.map((item, index) => (
                  <li key={index} onClick={() => onSelectItem(item)}>
                    {renderItem(item, index === activeIndex)}
                  </li>
                ))}
              </ul>
            ) : (
              query && <p className="text-center text-zinc-500 py-4">No results found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
