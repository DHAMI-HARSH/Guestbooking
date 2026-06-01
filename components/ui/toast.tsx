"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ToastTone = "success" | "error" | "info";

interface ToastBannerProps {
  open: boolean;
  title: string;
  description?: string;
  tone?: ToastTone;
  onClose: () => void;
}

const toneStyles: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

export function ToastBanner({ open, title, description, tone = "success", onClose }: ToastBannerProps) {
  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,24rem)]">
      <div className={`rounded-2xl border px-4 py-3 shadow-xl ${toneStyles[tone]}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{title}</p>
            {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-black/5"
            onClick={onClose}
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
