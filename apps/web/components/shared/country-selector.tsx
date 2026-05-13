"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KEYWORD_LOCATIONS } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface CountrySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function CountrySelector({
  value,
  onValueChange,
  className,
  placeholder = "Location",
}: CountrySelectorProps) {
  const selected = KEYWORD_LOCATIONS.find((item) => item.value === value);
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("min-w-44", className)}>
        <SelectValue placeholder={placeholder}>
          {selected && (
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{selected.flag}</span>
              <span>{selected.label}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {KEYWORD_LOCATIONS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{item.flag}</span>
              <span>{item.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
