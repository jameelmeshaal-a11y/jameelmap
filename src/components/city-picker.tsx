import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface Props {
  cities: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function CityPicker({ cities, selected, onChange, disabled }: Props) {
  const [q, setQ] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cities;
    return cities.filter((c) => c.toLowerCase().includes(needle));
  }, [cities, q]);

  const toggle = (city: string) => {
    const next = new Set(selectedSet);
    if (next.has(city)) next.delete(city);
    else next.add(city);
    onChange(cities.filter((c) => next.has(c)));
  };

  const selectAllVisible = () => {
    const next = new Set(selectedSet);
    for (const c of filtered) next.add(c);
    onChange(cities.filter((c) => next.has(c)));
  };

  const clearAllVisible = () => {
    const next = new Set(selectedSet);
    for (const c of filtered) next.delete(c);
    onChange(cities.filter((c) => next.has(c)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          المدن ({cities.length}) — <span className="text-primary">محدد: {selected.length}</span>
        </span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={selectAllVisible} disabled={disabled}>
            تحديد الكل {q ? "(الظاهر)" : ""}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAllVisible} disabled={disabled}>
            إلغاء الكل {q ? "(الظاهر)" : ""}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث عن مدينة..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pr-9"
          disabled={disabled}
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border bg-card p-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
          {filtered.map((city) => {
            const id = `city-${city}`;
            const checked = selectedSet.has(city);
            return (
              <label
                key={city}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() => toggle(city)}
                  disabled={disabled}
                />
                <span className="truncate">{city}</span>
              </label>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full p-4 text-center text-sm text-muted-foreground">
              لا توجد مدن مطابقة
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
