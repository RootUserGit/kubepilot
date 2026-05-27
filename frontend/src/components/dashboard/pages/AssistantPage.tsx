"use client";

import { useState } from "react";
import { Bot, DollarSign, Send, Shield, Sparkles } from "lucide-react";

const QUICK_CARDS = [
  {
    icon: Bot,
    title: "Why are pods in prod-eks-apac restarting?",
    color: "text-red-400",
  },
  {
    icon: DollarSign,
    title: "Show me cost optimization opportunities?",
    color: "text-kp-green",
  },
  {
    icon: Shield,
    title: "Any security risks I should know of?",
    color: "text-kp-purple",
  },
  {
    icon: Sparkles,
    title: "Cluster health summary",
    color: "text-kp-blue-glow",
  },
];

const SUGGESTIONS = [
  "Show top 5 overprovisioned workloads",
  "Which clusters have critical alerts?",
  "Generate security summary report",
  "What is the monthly waste across all clusters?",
  "Show namespaces with high CPU usage",
];

export function AssistantPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);

  function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "assistant",
        text: "Based on read-only analysis across your fleet: prod-eks-apac shows elevated OOMKills in payment-service (critical). Estimated waste ₹1.8L/month with 56 rightsizing opportunities. Would you like a detailed investigation report?",
      },
    ]);
    setQuery("");
  }

  return (
    <>
      <div className="grid gap-6 p-4 lg:grid-cols-[1fr_280px] sm:p-6">
        <div className="flex min-h-[60vh] flex-col">
          {messages.length === 0 ? (
            <>
              <h2 className="text-center text-xl font-semibold text-kp-text sm:text-2xl">
                How can I help you today?
              </h2>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {QUICK_CARDS.map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => send(card.title)}
                    className="rounded-xl border border-kp-border bg-kp-surface/40 p-4 text-left transition-colors hover:border-kp-blue/40"
                  >
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                    <p className="mt-2 text-sm text-kp-text">{card.title}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[90%] rounded-lg px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "ml-auto bg-kp-blue/20 text-kp-text"
                      : "bg-kp-surface text-kp-muted"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
          )}

          <form
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(query);
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your Kubernetes environment…"
              className="min-w-0 flex-1 rounded-lg border border-kp-border bg-kp-bg-deep px-4 py-3 text-sm text-kp-text placeholder:text-kp-muted/60 focus:border-kp-blue focus:outline-none"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center justify-center rounded-lg bg-kp-blue px-4 text-white hover:bg-kp-blue/90"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-3 text-center text-[10px] text-kp-muted">
            All responses may not always be accurate. Please verify important information.
          </p>
        </div>

        <aside className="hidden rounded-xl border border-kp-border bg-kp-surface/40 p-4 lg:block">
          <h3 className="text-sm font-semibold text-kp-text">Suggested prompts</h3>
          <ul className="mt-3 space-y-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => send(s)}
                  className="w-full rounded-lg border border-kp-border/60 px-3 py-2 text-left text-xs text-kp-muted hover:border-kp-blue/30 hover:text-kp-text"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
