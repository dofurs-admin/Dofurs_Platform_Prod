'use client';

import { Search } from 'lucide-react';
import { IconTooltip } from './IconTooltip';

interface SearchBarProps {
  searchOpen: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpen: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function SearchBar({ searchOpen, searchQuery, onSearchQueryChange, onOpen, onSubmit }: SearchBarProps) {
  if (searchOpen) {
    return (
      <form
        onSubmit={onSubmit}
        className="group flex h-9 min-w-0 w-[min(400px,34vw)] items-center rounded-full border border-[#e2bc9a] bg-[linear-gradient(155deg,rgba(255,252,248,0.97),rgba(255,242,228,0.94))] pl-3 pr-1.5 shadow-[0_8px_16px_rgba(148,95,59,0.09)] transition-all focus-within:border-[#d89460] focus-within:shadow-[0_10px_20px_rgba(148,95,59,0.15)]"
        aria-label="Search services"
      >
        <Search className="h-4 w-4 text-[#9f7652]" aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search grooming, vet visits, pet sitting"
          className="ml-2 w-full bg-transparent text-[13px] font-medium text-ink placeholder:text-[#ae8b6c] focus:outline-none"
          aria-label="Search for pet services"
          autoFocus
        />
        <button
          type="submit"
          className="inline-flex h-7 min-w-[56px] items-center justify-center rounded-full border border-[#d98f5a] bg-[linear-gradient(135deg,#e7a16e,#d5854f)] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[linear-gradient(135deg,#de9864,#cb7742)]"
        >
          Go
        </button>
      </form>
    );
  }

  return (
    <IconTooltip label="Search">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-[#7d5536] transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-[#8d5f3c]"
        aria-label="Open search"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    </IconTooltip>
  );
}
