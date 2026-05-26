import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, RefreshCw } from "lucide-react";

interface Props {
  cities: { name: string; score: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
  onRefresh?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function DynamicCityPicker({ cities, selected, onChange, onRefresh, loading, disabled }: Props) {
  const [q, setQ] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const names = useMemo(() => cities.map((c) => c.name), [cities]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(needle));
  }, [cities, q]);

  const toggle = (name: string) => {
    const next = new Set(selectedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(names.filter((n) => next.has(n)));
  };

  const selectAll = () => onChange(names);
  const clearAll = () => onChange([]);
  const top10 = () => onChange(names.slice(0, 10));

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري جلب المدن...
      </div>
    );
  }

  if (cities.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          المدن ({cities.length}) — <span className="text-primary">محدد: {selected.length}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={selectAll} disabled={disabled}>تحديد الكل</Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAll} disabled={disabled}>إلغاء الكل</Button>
          <Button type="button" size="sm" variant="outline" onClick={top10} disabled={disabled}>أكبر 10</Button>
          {onRefresh && (
            <Button type="button" size="sm" variant="ghost" onClick={onRefresh} disabled={disabled} title="إعادة الجلب">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="ابحث عن مدينة..." value={q} onChange={(e) => setQ(e.target.value)} className="pr-9" disabled={disabled} />
      </div>

      <div className="overflow-y-auto rounded-md border bg-card p-2" style={{ maxHeight: 400 }}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
          {filtered.map((c) => {
            const id = `dyn-city-${c.name}`;
            const checked = selectedSet.has(c.name);
            return (
              <label key={c.name} htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <Checkbox id={id} checked={checked} onCheckedChange={() => toggle(c.name)} disabled={disabled} />
                <span className="truncate">{c.name}</span>
              </label>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full p-4 text-center text-sm text-muted-foreground">لا توجد مدن مطابقة</p>
          )}
        </div>
      </div>
    </div>
  );
}
