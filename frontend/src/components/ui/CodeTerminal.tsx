"use client";

import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";

type CodeTerminalProps = {
  code: string;
  title?: string;
  language?: "shell" | "yaml" | "plain";
};

/** Theme-independent dark terminal — readable in light and dark site themes. */
export function CodeTerminal({
  code,
  title = "Terminal",
  language = "plain",
}: CodeTerminalProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="kp-terminal overflow-hidden rounded-xl shadow-lg ring-1 ring-black/10">
      <div className="kp-terminal-header flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="font-mono text-xs text-[#8b949e]">{title}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#8b949e] transition-colors hover:bg-white/5 hover:text-[#e6edf3]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#3fb950]" />
              Copied
            </>
          ) : (
            <>
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="kp-terminal-body overflow-x-auto p-4 font-mono text-[13px] leading-[1.65]">
        <code>
          {language === "shell" && <ShellHighlight code={code} />}
          {language === "yaml" && <YamlHighlight code={code} />}
          {language === "plain" && <span className="kp-tok-default whitespace-pre">{code}</span>}
        </code>
      </pre>
    </div>
  );
}

function ShellHighlight({ code }: { code: string }) {
  const lines = code.split("\n");
  return lines.map((line, i) => (
    <span key={i} className="block">
      {colorizeShellLine(line)}
      {i < lines.length - 1 ? "\n" : null}
    </span>
  ));
}

function colorizeShellLine(line: string) {
  const match = line.match(/^(\s*)(.*)$/);
  if (!match) return <span className="kp-tok-default">{line}</span>;
  const [, indent, content] = match;

  if (content.startsWith("helm ")) {
    return (
      <>
        {indent}
        <span className="kp-tok-keyword">helm</span>
        <span className="kp-tok-default"> {content.slice(5)}</span>
      </>
    );
  }

  if (content.startsWith("--set ")) {
    const eq = content.indexOf("=");
    if (eq > 0) {
      return (
        <>
          {indent}
          <span className="kp-tok-flag">{content.slice(0, eq + 1)}</span>
          <span className="kp-tok-value">{content.slice(eq + 1)}</span>
        </>
      );
    }
  }

  if (content.startsWith("--")) {
    return (
      <>
        {indent}
        <span className="kp-tok-flag">{content}</span>
      </>
    );
  }

  return <span className="kp-tok-default">{line || " "}</span>;
}

function YamlHighlight({ code }: { code: string }) {
  const lines = code.split("\n");
  return lines.map((line, i) => (
    <span key={i} className="block">
      {colorizeYamlLine(line)}
      {i < lines.length - 1 ? "\n" : null}
    </span>
  ));
}

function colorizeYamlLine(line: string) {
  const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_.-]+)(:)(.*)$/);
  if (keyMatch) {
    const [, indent, key, colon, rest] = keyMatch;
    return (
      <>
        {indent}
        <span className="kp-tok-flag">{key}</span>
        <span className="kp-tok-muted">{colon}</span>
        <span className="kp-tok-value">{rest}</span>
      </>
    );
  }
  return <span className="kp-tok-default">{line || " "}</span>;
}
