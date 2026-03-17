"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { aiApi, oeeApi, advancedLeanApi, leanApi, adminApi } from "@/lib/api";
import { useI18n } from "@/stores/useI18n";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isLocal?: boolean;
}

interface FactoryContext {
  oee: number | null;
  oeeTrend: number | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  andonActive: number | null;
  kaizenOpen: number | null;
  ciltCompliance: number | null;
  factoryName: string | null;
  factoryLines: number | null;
  dataSource: "live" | "demo";
}

interface Insight {
  severity: "critical" | "warning" | "success";
  textKey: string;
  replacements: Record<string, string | number>;
  prompt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "leanpilot_copilot_chat";

/* ------------------------------------------------------------------ */
/*  LocalStorage helpers                                               */
/* ------------------------------------------------------------------ */

function saveMessages(msgs: Message[]) {
  try {
    const serializable = msgs.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    /* quota exceeded or SSR */
  }
}

function loadMessages(): Message[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Unique ID generator                                                */
/* ------------------------------------------------------------------ */

let idCounter = 0;
function uid(): string {
  return `msg-${Date.now()}-${++idCounter}`;
}

/* ------------------------------------------------------------------ */
/*  Markdown renderer                                                  */
/* ------------------------------------------------------------------ */

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc list-inside space-y-1 my-1 text-th-text">
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  const flushCode = () => {
    if (codeBuffer.length === 0) return;
    nodes.push(
      <pre
        key={`code-${nodes.length}`}
        className="bg-th-bg-3 border border-th-border rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-th-text"
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>,
    );
    codeBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence toggle
    if (line.startsWith("```")) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Numbered list items
    if (/^\d+\.\s+/.test(line)) {
      flushList(); // flush bullet list if any
      const content = line.replace(/^\d+\.\s+/, "");
      // Collect consecutive numbered items
      const olItems: string[] = [content];
      while (i + 1 < lines.length && /^\d+\.\s+/.test(lines[i + 1])) {
        i++;
        olItems.push(lines[i].replace(/^\d+\.\s+/, ""));
      }
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="list-decimal list-inside space-y-1 my-1 text-th-text">
          {olItems.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Bullet list items
    if (/^[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    flushList();

    // Empty line
    if (line.trim() === "") {
      nodes.push(<div key={`br-${i}`} className="h-2" />);
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      nodes.push(
        <h3 key={`h1-${i}`} className="font-bold text-base mt-3 mb-1 text-th-text">
          {renderInline(line.slice(2))}
        </h3>,
      );
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      nodes.push(
        <h4 key={`h2-${i}`} className="font-bold text-sm mt-2 mb-1 text-th-text">
          {renderInline(line.slice(3))}
        </h4>,
      );
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      nodes.push(
        <h5 key={`h3-${i}`} className="font-semibold text-xs mt-2 mb-0.5 text-th-text-2">
          {renderInline(line.slice(4))}
        </h5>,
      );
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={`p-${i}`} className="my-0.5 text-th-text">
        {renderInline(line)}
      </p>,
    );
  }
  flushList();
  flushCode();
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match **bold**, `code`, and metric arrows
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|[\d.]+%?\s*[▲▼])/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const seg = match[0];
    if (seg.startsWith("**") && seg.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold">
          {seg.slice(2, -2)}
        </strong>,
      );
    } else if (seg.startsWith("`") && seg.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="bg-th-bg-3 text-th-text px-1 py-0.5 rounded text-xs font-mono"
        >
          {seg.slice(1, -1)}
        </code>,
      );
    } else if (seg.includes("\u25B2")) {
      parts.push(
        <span key={match.index} className="text-green-600 dark:text-green-400 font-medium">
          {seg}
        </span>,
      );
    } else if (seg.includes("\u25BC")) {
      parts.push(
        <span key={match.index} className="text-red-600 dark:text-red-400 font-medium">
          {seg}
        </span>,
      );
    }
    lastIdx = match.index + seg.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return <>{parts}</>;
}

/* ------------------------------------------------------------------ */
/*  Local fallback response engine                                     */
/* ------------------------------------------------------------------ */

function buildLocalResponse(message: string, ctx: FactoryContext): string {
  const lower = message.toLowerCase();
  const oee = ctx.oee ?? 0;
  const avail = ctx.availability ?? 0;
  const perf = ctx.performance ?? 0;
  const qual = ctx.quality ?? 0;

  if (/oee|trend|efficien/.test(lower)) {
    const breakdown = [
      `## OEE Analysis`,
      "",
      `Current OEE: **${oee.toFixed(1)}%** ${oee < 70 ? "\u25BC" : "\u25B2"}`,
      ctx.oeeTrend != null
        ? `Trend: **${ctx.oeeTrend > 0 ? "+" : ""}${ctx.oeeTrend.toFixed(1)}%** ${ctx.oeeTrend < 0 ? "\u25BC" : "\u25B2"}`
        : "",
      "",
      "### Breakdown",
      `- **Availability**: ${avail.toFixed(1)}%`,
      `- **Performance**: ${perf.toFixed(1)}%`,
      `- **Quality**: ${qual.toFixed(1)}%`,
      "",
      "### Recommendations",
      `- Focus on ${avail <= perf && avail <= qual ? "Availability" : perf <= qual ? "Performance" : "Quality"} as the biggest loss driver`,
      "- Set up hourly OEE micro-tracking on the worst-performing line",
      "- Review changeover procedures for SMED opportunities",
    ];
    return breakdown.filter(Boolean).join("\n");
  }

  if (/improve|suggest|kaizen/.test(lower)) {
    return [
      "## Improvement Suggestions",
      "",
      `Based on current data (OEE: ${oee.toFixed(1)}%, ${ctx.andonActive ?? 0} active Andon events, ${ctx.kaizenOpen ?? 0} open Kaizen items):`,
      "",
      "- [ ] **Quick Win**: Address active Andon events to restore flow",
      "- [ ] **Short-term**: Run a Pareto analysis on top downtime causes",
      "- [ ] **Medium-term**: Schedule SMED workshop for bottleneck machine",
      "- [ ] **Strategic**: Implement TPM autonomous maintenance program",
      "",
      `CILT compliance is at **${(ctx.ciltCompliance ?? 0).toFixed(0)}%** \u2014 ${(ctx.ciltCompliance ?? 0) < 90 ? "improving this will reduce unplanned stops" : "good compliance level, maintain it"}`,
    ].join("\n");
  }

  if (/root\s*cause|5\s*why|five\s*why|why/.test(lower)) {
    return [
      "## Root Cause Analysis Template",
      "",
      "### 5 Why Method",
      "- **Problem**: Define the specific problem from production data",
      "- **Why 1**: Why did the machine stop? \u2014 (enter finding after Gemba observation)",
      "- **Why 2**: Why did that condition occur? \u2014 (enter finding)",
      "- **Why 3**: Why was it not detected earlier? \u2014 (enter finding)",
      "- **Why 4**: Why was it not prevented? \u2014 (enter finding)",
      "- **Why 5**: What systemic gap allowed this? \u2014 (enter finding)",
      "",
      "### Next Steps",
      "- [ ] Go to Gemba and verify each Why with data",
      "- [ ] Document findings with countermeasures, owners, and deadlines",
      "- [ ] Follow up within 1 week to verify effectiveness",
    ].join("\n");
  }

  if (/standup|daily|summary|morning/.test(lower)) {
    return [
      "## Daily Standup Summary",
      "",
      `### Factory: ${ctx.factoryName ?? "Factory"} (${ctx.factoryLines ?? 0} lines)`,
      "",
      "### Key Metrics",
      `- **OEE**: ${oee.toFixed(1)}% ${ctx.oeeTrend != null ? `(trend: ${ctx.oeeTrend > 0 ? "+" : ""}${ctx.oeeTrend.toFixed(1)}%)` : ""}`,
      `- **Active Andon events**: ${ctx.andonActive ?? 0}`,
      `- **Open Kaizen items**: ${ctx.kaizenOpen ?? 0}`,
      `- **CILT compliance**: ${(ctx.ciltCompliance ?? 0).toFixed(0)}%`,
      "",
      "### Focus Areas Today",
      ctx.andonActive && ctx.andonActive > 0
        ? `- Resolve ${ctx.andonActive} active Andon event(s) immediately`
        : "- No active Andon events \u2014 focus on preventive actions",
      (ctx.ciltCompliance ?? 100) < 90
        ? `- CILT compliance below target \u2014 ensure inspections are completed`
        : "- CILT compliance on track",
      `- Review Kaizen board (${ctx.kaizenOpen ?? 0} open items)`,
    ].join("\n");
  }

  if (/andon|stop|down/.test(lower)) {
    return [
      "## Andon Status",
      "",
      `Active events: **${ctx.andonActive ?? 0}**`,
      "",
      ctx.andonActive && ctx.andonActive > 0
        ? "### Actions\n- [ ] Prioritize and resolve active Andon events\n- [ ] Document root cause for each resolved event\n- [ ] Check for recurring patterns"
        : "All clear \u2014 no active Andon events. Review recent history for patterns.",
    ].join("\n");
  }

  // Default help
  return [
    `I can help you analyze your factory data. Currently using **${ctx.dataSource}** data.`,
    "",
    "Try asking about:",
    "",
    "- **OEE** \u2014 current performance, trends, and breakdown",
    "- **Improvements** \u2014 prioritized suggestions based on data",
    "- **Root cause** \u2014 guided 5 Why analysis",
    "- **Standup** \u2014 daily summary for your morning meeting",
    "- **Andon** \u2014 active events and stoppages",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/*  Build system prompt with real factory data for AI                   */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(ctx: FactoryContext): string {
  return `You are the Factory Copilot for a Lean Manufacturing platform (LeanPilot).
You help factory managers and operators improve OEE, reduce waste, and implement lean practices.

CURRENT FACTORY STATUS (${ctx.dataSource === "live" ? "LIVE DATA" : "DEMO DATA"}):
- Factory: ${ctx.factoryName ?? "Unknown"} (${ctx.factoryLines ?? "?"} lines)
- OEE: ${ctx.oee != null ? ctx.oee.toFixed(1) + "%" : "N/A"} ${ctx.oeeTrend != null ? `(trend: ${ctx.oeeTrend > 0 ? "+" : ""}${ctx.oeeTrend.toFixed(1)}%)` : ""}
- Availability: ${ctx.availability != null ? ctx.availability.toFixed(1) + "%" : "N/A"}
- Performance: ${ctx.performance != null ? ctx.performance.toFixed(1) + "%" : "N/A"}
- Quality: ${ctx.quality != null ? ctx.quality.toFixed(1) + "%" : "N/A"}
- Active Andon Events: ${ctx.andonActive ?? "N/A"}
- Open Kaizen Items: ${ctx.kaizenOpen ?? "N/A"}
- CILT Compliance: ${ctx.ciltCompliance != null ? ctx.ciltCompliance.toFixed(0) + "%" : "N/A"}

GUIDELINES:
- Always reference specific numbers from the factory data above.
- Suggest concrete, actionable improvements.
- Use lean terminology: OEE, SMED, 5 Why, Gemba, Kaizen, Andon, TPM, Poka-Yoke, CILT.
- Keep responses focused and practical for a factory floor audience.
- Format with markdown: ## headings, **bold** for emphasis, bullet lists, code blocks if needed.
- When discussing OEE, break it into Availability, Performance, Quality components.`;
}

/* ------------------------------------------------------------------ */
/*  Export chat                                                        */
/* ------------------------------------------------------------------ */

function exportChat(messages: Message[]) {
  const lines = messages.map((m) => {
    const time = m.timestamp.toLocaleString();
    const role = m.role === "user" ? "YOU" : "COPILOT";
    return `[${time}] ${role}:\n${m.content}\n`;
  });
  const blob = new Blob(
    ["Factory Copilot \u2014 Chat Export\n", "=".repeat(40), "\n\n", ...lines],
    { type: "text/plain;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `copilot-chat-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FactoryCopilot() {
  const { printView } = useExport();
  const { t, locale } = useI18n();

  /* ---------- Factory context state ---------- */

  const [ctx, setCtx] = useState<FactoryContext>({
    oee: null,
    oeeTrend: null,
    availability: null,
    performance: null,
    quality: null,
    andonActive: null,
    kaizenOpen: null,
    ciltCompliance: null,
    factoryName: null,
    factoryLines: null,
    dataSource: "demo",
  });
  const [ctxLoading, setCtxLoading] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);

  /* ---------- Fetch all factory context data ---------- */

  useEffect(() => {
    let cancelled = false;

    async function fetchContext() {
      setCtxLoading(true);
      const newCtx: FactoryContext = {
        oee: null,
        oeeTrend: null,
        availability: null,
        performance: null,
        quality: null,
        andonActive: null,
        kaizenOpen: null,
        ciltCompliance: null,
        factoryName: null,
        factoryLines: null,
        dataSource: "demo",
      };

      let hasLiveData = false;

      // First fetch factory to get real line IDs
      let lineId = 0;
      try {
        const factoryPreRes = await adminApi.getFactory();
        const f = factoryPreRes.data;
        if (f?.lines && Array.isArray(f.lines) && f.lines.length > 0) {
          lineId = f.lines[0].id;
        }
      } catch {
        // will use lineId = 0 which skips OEE calls
      }

      const [oeeRes, oeeTrendRes, andonRes, kaizenRes, ciltRes, factoryRes] =
        await Promise.allSettled([
          lineId > 0 ? oeeApi.getSummary(lineId, 30) : Promise.reject("no line"),
          lineId > 0 ? oeeApi.getTrend(lineId, 30) : Promise.reject("no line"),
          advancedLeanApi.getAndonStatus(),
          leanApi.getKaizenBoard(),
          advancedLeanApi.getCILTCompliance(),
          adminApi.getFactory(),
        ]);

      // OEE Summary
      if (oeeRes.status === "fulfilled" && oeeRes.value?.data) {
        const d = oeeRes.value.data;
        newCtx.oee = d.oee ?? d.current_oee ?? null;
        newCtx.availability = d.availability ?? null;
        newCtx.performance = d.performance ?? null;
        newCtx.quality = d.quality ?? null;
        if (newCtx.oee != null) hasLiveData = true;
      }

      // OEE Trend
      if (oeeTrendRes.status === "fulfilled" && oeeTrendRes.value?.data) {
        const td = oeeTrendRes.value.data;
        if (Array.isArray(td) && td.length >= 2) {
          const recent = td[td.length - 1]?.oee ?? td[td.length - 1]?.value;
          const prev = td[td.length - 2]?.oee ?? td[td.length - 2]?.value;
          if (recent != null && prev != null) {
            newCtx.oeeTrend = recent - prev;
          }
        } else if (td.trend != null) {
          newCtx.oeeTrend = td.trend;
        }
      }

      // Andon
      if (andonRes.status === "fulfilled" && andonRes.value?.data) {
        const andon = andonRes.value.data;
        if (typeof andon.active_count === "number") {
          newCtx.andonActive = andon.active_count;
        } else if (Array.isArray(andon.active_events)) {
          newCtx.andonActive = andon.active_events.length;
        } else if (Array.isArray(andon)) {
          newCtx.andonActive = andon.length;
        } else if (typeof andon.count === "number") {
          newCtx.andonActive = andon.count;
        }
        if (newCtx.andonActive != null) hasLiveData = true;
      }

      // Kaizen Board
      if (kaizenRes.status === "fulfilled" && kaizenRes.value?.data) {
        const kb = kaizenRes.value.data;
        if (typeof kb.open_count === "number") {
          newCtx.kaizenOpen = kb.open_count;
        } else if (Array.isArray(kb.items)) {
          newCtx.kaizenOpen = kb.items.filter(
            (it: any) => it.status !== "completed" && it.status !== "closed",
          ).length;
        } else if (Array.isArray(kb)) {
          newCtx.kaizenOpen = kb.filter(
            (it: any) => it.status !== "completed" && it.status !== "closed",
          ).length;
        }
        if (newCtx.kaizenOpen != null) hasLiveData = true;
      }

      // CILT Compliance
      if (ciltRes.status === "fulfilled" && ciltRes.value?.data) {
        const cilt = ciltRes.value.data;
        newCtx.ciltCompliance =
          cilt.compliance_rate ?? cilt.compliance ?? cilt.rate ?? null;
        if (newCtx.ciltCompliance != null) hasLiveData = true;
      }

      // Factory Info
      if (factoryRes.status === "fulfilled" && factoryRes.value?.data) {
        const f = factoryRes.value.data;
        newCtx.factoryName = f.name ?? f.factory_name ?? null;
        newCtx.factoryLines =
          f.line_count ??
          (Array.isArray(f.lines) ? f.lines.length : null) ??
          null;
      }

      newCtx.dataSource = hasLiveData ? "live" : "demo";

      // Demo fallbacks if no live data
      if (!hasLiveData) {
        newCtx.oee = newCtx.oee ?? 68.5;
        newCtx.oeeTrend = newCtx.oeeTrend ?? -4.2;
        newCtx.availability = newCtx.availability ?? 78.2;
        newCtx.performance = newCtx.performance ?? 91.0;
        newCtx.quality = newCtx.quality ?? 96.1;
        newCtx.andonActive = newCtx.andonActive ?? 2;
        newCtx.kaizenOpen = newCtx.kaizenOpen ?? 4;
        newCtx.ciltCompliance = newCtx.ciltCompliance ?? 84;
        newCtx.factoryName = newCtx.factoryName ?? "Demo Factory";
        newCtx.factoryLines = newCtx.factoryLines ?? 3;
      }

      if (!cancelled) {
        setCtx(newCtx);
        setCtxLoading(false);
      }
    }

    fetchContext();
    const interval = setInterval(fetchContext, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  /* ---------- Messages with localStorage persistence ---------- */

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = loadMessages();
    if (saved && saved.length > 0) return saved;
    return [
      {
        id: uid(),
        role: "assistant" as const,
        content: "",
        timestamp: new Date(),
      },
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persist messages
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Update welcome message when language changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 0 && prev[0].role === "assistant") {
        return [
          { ...prev[0], content: t("copilot.welcomeMessage") },
          ...prev.slice(1),
        ];
      }
      return prev;
    });
  }, [locale, t]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ---------- Clear chat ---------- */

  const clearChat = useCallback(() => {
    const welcome: Message = {
      id: uid(),
      role: "assistant",
      content: t("copilot.welcomeMessage"),
      timestamp: new Date(),
    };
    setMessages([welcome]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [t]);

  /* ---------- Send message (API with local fallback) ---------- */

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = overrideText ?? input;
      if (!text.trim()) return;
      if (!overrideText) setInput("");

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await aiApi.chat({
          message: text,
          system_prompt: buildSystemPrompt(ctx),
          context: {
            oee: ctx.oee,
            andon_active: ctx.andonActive,
            kaizen_open: ctx.kaizenOpen,
            cilt_compliance: ctx.ciltCompliance,
            factory_name: ctx.factoryName,
            data_source: ctx.dataSource,
          },
        });
        const content = res.data.response ?? res.data.message ?? res.data;
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: typeof content === "string" ? content : JSON.stringify(content),
            timestamp: new Date(),
          },
        ]);
      } catch {
        // Local fallback
        const delay = 400 + Math.random() * 400;
        await new Promise((r) => setTimeout(r, delay));
        const content = buildLocalResponse(text, ctx);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content,
            timestamp: new Date(),
            isLocal: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, ctx],
  );

  /* ---------- Quick prompt definitions ---------- */

  const quickPrompts = useMemo(
    () => [
      { key: "analyzeOee", label: t("copilot.promptAnalyzeOee"), icon: "M" },
      { key: "suggest", label: t("copilot.promptSuggestImprovements"), icon: "S" },
      { key: "rootCause", label: t("copilot.promptRootCause"), icon: "R" },
      { key: "standup", label: t("copilot.promptStandup"), icon: "D" },
    ],
    [t],
  );

  /* ---------- Proactive insights ---------- */

  const insights: Insight[] = useMemo(() => {
    const items: Insight[] = [];
    const oee = ctx.oee ?? 0;
    const andon = ctx.andonActive ?? 0;
    const cilt = ctx.ciltCompliance ?? 100;
    const kaizen = ctx.kaizenOpen ?? 0;
    const trend = ctx.oeeTrend ?? 0;

    if (oee > 0 && oee < 70) {
      items.push({
        severity: "critical",
        textKey: "copilot.insightOeeDrop",
        replacements: { threshold: 70, line: ctx.factoryName ?? "Line 1" },
        prompt: "Analyze why OEE is below 70% and suggest immediate corrective actions",
      });
    }

    if (andon > 0) {
      items.push({
        severity: "warning",
        textKey: "copilot.insightAndonActive",
        replacements: { count: andon },
        prompt: `There are ${andon} active Andon events. Analyze them and suggest resolution priorities.`,
      });
    }

    if (cilt < 90) {
      items.push({
        severity: "warning",
        textKey: "copilot.insightCiltLow",
        replacements: { rate: Math.round(cilt) },
        prompt: "CILT compliance is below 90%. What are the most common missed checks and how to improve?",
      });
    }

    if (kaizen > 5) {
      items.push({
        severity: "warning",
        textKey: "copilot.insightKaizenBacklog",
        replacements: { count: kaizen },
        prompt: `There are ${kaizen} open Kaizen items. Help me prioritize them by impact.`,
      });
    }

    if (trend > 2) {
      items.push({
        severity: "success",
        textKey: "copilot.insightOeeRecovery",
        replacements: { trend: trend.toFixed(1) },
        prompt: "OEE is trending up. What contributed to this improvement and how to sustain it?",
      });
    }

    return items;
  }, [ctx]);

  /* ---------- Helpers ---------- */

  const oeeValue = ctx.oee ?? 0;
  const oeeColor =
    oeeValue >= 85
      ? "text-green-600 dark:text-green-400"
      : oeeValue >= 70
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  const severityStyles: Record<string, { border: string; bg: string; dot: string }> = {
    critical: {
      border: "border-red-300 dark:border-red-700",
      bg: "bg-red-50 dark:bg-red-950/30",
      dot: "bg-red-500",
    },
    warning: {
      border: "border-yellow-300 dark:border-yellow-700",
      bg: "bg-yellow-50 dark:bg-yellow-950/30",
      dot: "bg-yellow-500",
    },
    success: {
      border: "border-green-300 dark:border-green-700",
      bg: "bg-green-50 dark:bg-green-950/30",
      dot: "bg-green-500",
    },
  };

  /* ---------- Render ---------- */

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]" data-print-area="true">
      {/* ---- Header ---- */}
      <div className="bg-gradient-cool rounded-xl p-4 mb-3 text-white shadow-glow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold">{t("copilot.title")}</h3>
            <p className="text-sm text-white/80">{t("copilot.subtitle")}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                ctx.dataSource === "live"
                  ? "bg-green-500/30 text-green-100"
                  : "bg-yellow-500/30 text-yellow-100"
              }`}
            >
              {ctxLoading
                ? t("copilot.ctxLoading")
                : ctx.dataSource === "live"
                  ? t("copilot.ctxLive")
                  : t("copilot.ctxDemo")}
            </span>
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-white/70">{t("copilot.active")}</span>
            <ExportToolbar
              onPrint={() => printView({ title: t("copilot.title") || "Factory Copilot", orientation: "portrait" })}
            />
          </div>
        </div>
      </div>

      {/* ---- Factory Context Panel (collapsible) ---- */}
      <div className="mb-3">
        <button
          onClick={() => setContextOpen(!contextOpen)}
          className="flex items-center gap-2 text-xs font-medium text-th-text-2 hover:text-th-text transition mb-1.5 px-1"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${contextOpen ? "rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          {t("copilot.factoryContext")}
        </button>

        {contextOpen && (
          <div className="bg-th-bg-2 border border-th-border rounded-xl p-3 shadow-card">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {/* OEE */}
              <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-th-bg-1">
                <span className="text-th-text-3 font-medium">{t("copilot.ctxOee")}</span>
                <span className={`text-lg font-bold ${oeeColor}`}>
                  {ctx.oee != null ? `${ctx.oee.toFixed(1)}%` : t("copilot.ctxDataUnavailable")}
                </span>
                {ctx.oeeTrend != null && (
                  <span className={`text-[10px] ${ctx.oeeTrend < 0 ? "text-red-500" : "text-green-500"}`}>
                    {ctx.oeeTrend > 0 ? "+" : ""}
                    {ctx.oeeTrend.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Andon */}
              <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-th-bg-1">
                <span className="text-th-text-3 font-medium">{t("copilot.ctxAndon")}</span>
                <span
                  className={`text-lg font-bold ${
                    (ctx.andonActive ?? 0) > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {ctx.andonActive ?? t("copilot.ctxDataUnavailable")}
                </span>
                <span className="text-[10px] text-th-text-3">
                  {(ctx.andonActive ?? 0) > 0 ? t("copilot.ctxActiveEvents") : t("copilot.ctxAllClear")}
                </span>
              </div>

              {/* Kaizen */}
              <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-th-bg-1">
                <span className="text-th-text-3 font-medium">{t("copilot.ctxKaizen")}</span>
                <span className="text-lg font-bold text-th-text">
                  {ctx.kaizenOpen ?? t("copilot.ctxDataUnavailable")}
                </span>
                <span className="text-[10px] text-th-text-3">{t("copilot.ctxOpenItems")}</span>
              </div>

              {/* CILT */}
              <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-th-bg-1">
                <span className="text-th-text-3 font-medium">{t("copilot.ctxCilt")}</span>
                <span
                  className={`text-lg font-bold ${
                    (ctx.ciltCompliance ?? 0) >= 90
                      ? "text-green-600 dark:text-green-400"
                      : (ctx.ciltCompliance ?? 0) >= 70
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {ctx.ciltCompliance != null ? `${ctx.ciltCompliance.toFixed(0)}%` : t("copilot.ctxDataUnavailable")}
                </span>
                <span className="text-[10px] text-th-text-3">{t("copilot.ctxCompliance")}</span>
              </div>

              {/* Factory */}
              <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-th-bg-1 col-span-2 sm:col-span-1 lg:col-span-2">
                <span className="text-th-text-3 font-medium">{t("copilot.ctxFactory")}</span>
                <span className="text-sm font-bold text-th-text truncate max-w-full">
                  {ctx.factoryName ?? t("copilot.ctxDataUnavailable")}
                </span>
                <span className="text-[10px] text-th-text-3">
                  {ctx.factoryLines != null ? `${ctx.factoryLines} ${t("copilot.ctxLines")}` : ""}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Proactive Insights ---- */}
      {insights.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {insights.map((insight, idx) => {
            const style = severityStyles[insight.severity];
            return (
              <button
                key={idx}
                onClick={() => sendMessage(insight.prompt)}
                className={`flex-shrink-0 text-left text-[11px] leading-snug p-2.5 rounded-lg border ${style.border} ${style.bg} hover:opacity-90 transition max-w-[280px]`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
                  <span className="text-th-text">
                    {t(insight.textKey, insight.replacements)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ---- Chat Messages ---- */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-1 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand-600 text-white rounded-br-md"
                  : "bg-th-bg-2 border border-th-border shadow-card rounded-bl-md text-th-text"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="space-y-0.5">
                  {renderMarkdown(msg.content)}
                  {msg.isLocal && (
                    <p className="text-[10px] text-th-text-3 italic mt-2">
                      {t("copilot.localFallback")}
                    </p>
                  )}
                </div>
              ) : (
                msg.content
              )}
              <div
                className={`text-[10px] mt-1.5 ${
                  msg.role === "user" ? "text-white/50" : "text-th-text-3"
                }`}
              >
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-th-bg-2 border border-th-border shadow-card p-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span
                    className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <span className="text-xs text-th-text-3">
                  {t("copilot.thinking")}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ---- Quick Prompts ---- */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {quickPrompts.map((qp) => (
          <button
            key={qp.key}
            onClick={() => sendMessage(qp.label)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-brand-50 dark:bg-brand-950/30 hover:bg-brand-100 dark:hover:bg-brand-900/40 px-3 py-1.5 rounded-full text-brand-700 dark:text-brand-300 transition border border-brand-200/50 dark:border-brand-700/50 hover:border-brand-300 dark:hover:border-brand-600 disabled:opacity-40"
          >
            <span className="w-4 h-4 rounded-full bg-brand-200 dark:bg-brand-800 flex items-center justify-center text-[9px] font-bold text-brand-700 dark:text-brand-200">
              {qp.icon}
            </span>
            <span>{qp.label}</span>
          </button>
        ))}
      </div>

      {/* ---- Input + Controls ---- */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={loading}
          className="flex-1 px-4 py-3 border border-th-border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-th-input shadow-card text-sm text-th-text disabled:opacity-60"
          placeholder={t("copilot.inputPlaceholder")}
        />
        {/* Send */}
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-brand-600 text-white px-5 py-3 rounded-xl hover:bg-brand-700 disabled:opacity-40 transition shadow-glow font-medium text-sm"
        >
          {t("copilot.send")}
        </button>
        {/* Export */}
        <button
          onClick={() => exportChat(messages)}
          disabled={messages.length <= 1}
          title={t("copilot.exportChat")}
          className="px-3 py-3 border border-th-border rounded-xl hover:bg-th-bg-2 disabled:opacity-40 transition text-th-text-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
        {/* Clear */}
        <button
          onClick={clearChat}
          disabled={messages.length <= 1}
          title={t("copilot.clearChat")}
          className="px-3 py-3 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition text-red-500 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}
