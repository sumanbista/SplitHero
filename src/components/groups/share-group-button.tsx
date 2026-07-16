"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type CopyStatus = "idle" | "copied" | "error";

function copyWithLegacyFallback(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Copy command was unavailable.");
  }
}

export function ShareGroupButton() {
  const [status, setStatus] = useState<CopyStatus>("idle");

  async function copyGroupLink() {
    const groupUrl = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(groupUrl);
      } else {
        copyWithLegacyFallback(groupUrl);
      }
      setStatus("copied");
    } catch {
      try {
        copyWithLegacyFallback(groupUrl);
        setStatus("copied");
      } catch {
        setStatus("error");
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Link2 className="size-4" aria-hidden="true" />
        </span>
        <p className="text-sm leading-6 text-muted-foreground">
          Anyone with this link can view and update the group.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={copyGroupLink}
      >
        {status === "copied" ? (
          <Check data-icon="inline-start" />
        ) : (
          <Copy data-icon="inline-start" />
        )}
        {status === "copied" ? "Link copied" : "Copy group link"}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm text-muted-foreground"
      >
        {status === "copied" ? "Ready to share." : null}
        {status === "error"
          ? "Couldn’t copy the link. Copy it from your address bar."
          : null}
      </p>
    </div>
  );
}
