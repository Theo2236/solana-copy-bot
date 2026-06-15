"use client";

export type TabKey =
  | "overview"
  | "positions"
  | "history"
  | "logs"
  | "settings";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overzicht" },
  { key: "positions", label: "Posities" },
  { key: "history", label: "Historie" },
  { key: "logs", label: "Logs" },
  { key: "settings", label: "Instellingen" },
];

interface TabNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function TabNav({ active, onChange }: TabNavProps) {
  return (
    <nav className="border-b border-slate-800 bg-slate-900/40">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
              active === tab.key
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
