import { Minus, Plus } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  saved?: boolean;
};

export function ScoreInput({ value, onChange, disabled, saved }: Props) {
  const n = value === "" ? null : parseInt(value, 10);
  const step = (d: number) => {
    if (disabled) return;
    const cur = n ?? 0;
    const next = Math.max(0, Math.min(20, cur + d));
    onChange(String(next));
  };
  return (
    <div className="inline-flex items-center gap-0.5">
      <button type="button" onClick={() => step(-1)} disabled={disabled}
        className="grid h-9 w-7 place-items-center rounded-l-md border border-r-0 border-border bg-surface text-muted-foreground hover:bg-muted disabled:opacity-40 sm:hidden">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number" inputMode="numeric" min={0} max={20}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
        disabled={disabled}
        className={`h-9 w-10 text-center font-semibold text-base border border-border bg-surface rounded-none sm:rounded-md disabled:opacity-60 ${saved ? "border-primary bg-primary-soft text-primary" : ""}`}
      />
      <button type="button" onClick={() => step(1)} disabled={disabled}
        className="grid h-9 w-7 place-items-center rounded-r-md border border-l-0 border-border bg-surface text-muted-foreground hover:bg-muted disabled:opacity-40 sm:hidden">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
