"use client";

import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  state: SaveState;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  idleLabel?: string;
  errorLabel?: string;
}

export function SaveButton({
  state,
  onClick,
  disabled,
  className,
  idleLabel = "Save Changes",
  errorLabel = "Failed — Retry",
}: Props) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || state === "saving" || state === "saved"}
      className={cn(
        "min-w-[130px] transition-all",
        state === "saved" && "bg-green-600 hover:bg-green-600 text-white",
        state === "error" && "bg-destructive hover:bg-destructive text-destructive-foreground",
        className
      )}
    >
      {state === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {state === "saved" && <Check className="mr-2 h-4 w-4" />}
      {state === "saving"
        ? "Saving…"
        : state === "saved"
          ? "Saved!"
          : state === "error"
            ? errorLabel
            : idleLabel}
    </Button>
  );
}
