import React, { useEffect, useState } from "react";
import { Button } from "./Button";

export function CopyButton(props: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
    } catch {
      // ignore
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onCopy}
      className={props.className}
      aria-label={props.label ?? "Copy"}
      title={props.label ?? "Copy"}
    >
      {copied ? "Copied" : props.label ?? "Copy"}
    </Button>
  );
}
