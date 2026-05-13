"use client";

import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type Device = "desktop" | "mobile";

interface Props {
  value: Device;
  onChange: (value: Device) => void;
  className?: string;
}

export function DeviceToggle({ value, onChange, className }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Device"
      className={cn("inline-flex items-center rounded-md border bg-background p-0.5", className)}
    >
      <Button selected={value === "desktop"} onClick={() => onChange("desktop")}>
        <Monitor className="h-3.5 w-3.5" />
        Desktop
      </Button>
      <Button selected={value === "mobile"} onClick={() => onChange("mobile")}>
        <Smartphone className="h-3.5 w-3.5" />
        Mobile
      </Button>
    </div>
  );
}

function Button({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
        selected
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
