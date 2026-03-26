import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { Course } from "../types/course";

interface SearchBoxProps {
  courses: Course[];
  onSearch: (courseId: string) => void;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "#fef9c3", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchBox({ courses, onSearch }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return courses
      .filter(
        (c) =>
          c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, courses]);

  const isOpen = filtered.length > 0;

  const handleSelect = useCallback(
    (courseId: string) => {
      onSearch(courseId);
      setQuery("");
      setActiveIndex(-1);
    },
    [onSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && filtered[activeIndex]) {
          handleSelect(filtered[activeIndex].id);
        } else if (filtered.length === 1) {
          handleSelect(filtered[0].id);
        }
      } else if (e.key === "Escape") {
        setQuery("");
        setActiveIndex(-1);
      }
    },
    [activeIndex, filtered, handleSelect]
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setQuery("");
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="search-box-wrapper"
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
    >
      {/* Search icon */}
      <svg
        className="search-icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search courses…"
        aria-label="Search courses"
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
        }
      />

      {query && (
        <button
          className="search-clear"
          onClick={() => {
            setQuery("");
            setActiveIndex(-1);
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      )}

      {isOpen && (
        <ul role="listbox" className="search-dropdown">
          {filtered.map((course, i) => (
            <li
              key={course.id}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`search-suggestion${i === activeIndex ? " active" : ""}`}
              onMouseDown={() => handleSelect(course.id)}
            >
              <span className="suggestion-id">
                {highlightMatch(course.id, query)}
              </span>
              <span className="suggestion-name">
                {highlightMatch(course.name, query)}
              </span>
              {!course.isCS && (
                <span className="suggestion-badge">ext</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
