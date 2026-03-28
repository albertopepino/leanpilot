"use client";
import { useState, useRef } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface Props { t: (key: string) => string; }

const categories = [
  { key: "cat1", color: "indigo", tools: ["oee", "hourly", "andon", "production"], mockup: "oee" },
  { key: "cat2", color: "rose", tools: ["fivewhy", "ishikawa", "pareto", "a3"], mockup: "ishikawa" },
  { key: "cat3", color: "emerald", tools: ["kaizen", "vsm", "smed", "gemba"], mockup: "kaizen" },
  { key: "cat4", color: "amber", tools: ["sixs", "tpm", "cilt"], mockup: "tpm" },
  { key: "cat5", color: "violet", tools: ["copilot", "assessment"], mockup: "copilot" },
] as const;

const colorMap: Record<string, { pill: string; pillActive: string; tag: string; dot: string }> = {
  indigo: { pill: "hover:bg-indigo-50 hover:text-indigo-700", pillActive: "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm", tag: "bg-indigo-50 text-indigo-600 border-indigo-100", dot: "bg-indigo-500" },
  rose: { pill: "hover:bg-rose-50 hover:text-rose-700", pillActive: "bg-rose-50 text-rose-700 border-rose-200 shadow-sm", tag: "bg-rose-50 text-rose-600 border-rose-100", dot: "bg-rose-500" },
  emerald: { pill: "hover:bg-emerald-50 hover:text-emerald-700", pillActive: "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm", tag: "bg-emerald-50 text-emerald-600 border-emerald-100", dot: "bg-emerald-500" },
  amber: { pill: "hover:bg-amber-50 hover:text-amber-700", pillActive: "bg-amber-50 text-amber-700 border-amber-200 shadow-sm", tag: "bg-amber-50 text-amber-600 border-amber-100", dot: "bg-amber-500" },
  violet: { pill: "hover:bg-violet-50 hover:text-violet-700", pillActive: "bg-violet-50 text-violet-700 border-violet-200 shadow-sm", tag: "bg-violet-50 text-violet-600 border-violet-100", dot: "bg-violet-500" },
};

function OEEMockup() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs text-gray-400 font-medium">Live — Shop Floor Line A</span></div>
      <div className="grid grid-cols-3 gap-3">
        {[{ l: "Availability", v: "94.2%", c: "text-emerald-600" }, { l: "Performance", v: "87.1%", c: "text-blue-600" }, { l: "Quality", v: "99.1%", c: "text-violet-600" }].map(m => (
          <div key={m.l} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100 hover:shadow-md transition-shadow"><div className={`text-lg font-bold ${m.c}`}>{m.v}</div><div className="text-[10px] text-gray-400 mt-1">{m.l}</div></div>
        ))}
      </div>
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="flex justify-between mb-3"><span className="text-xs text-gray-400">OEE 24h Trend</span><span className="text-xs text-emerald-600 font-bold">81.3%</span></div>
        <div className="flex items-end gap-[3px] h-16">{[62,68,72,65,78,82,75,80,84,79,85,81,88,83,86,90,82,85,87,84,89,86,83,81].map((v,i) => <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-indigo-500 to-indigo-300 hover:from-violet-500 hover:to-violet-300 transition-colors cursor-pointer" style={{ height: `${v}%` }} />)}</div>
      </div>
    </div>
  );
}
function IshikawaMockup() {
  return (
    <div><div className="text-xs text-gray-400 mb-3 font-medium">Root Cause Analysis: Scrap on CNC-4</div>
      <svg viewBox="0 0 400 200" className="w-full" fill="none">
        <line x1="40" y1="100" x2="360" y2="100" stroke="#6366f1" strokeWidth="2" opacity="0.3" />
        {[{ x: 100, l: "Man", b: ["Training", "Fatigue"] }, { x: 170, l: "Machine", b: ["Wear", "Calibration"] }, { x: 240, l: "Method", b: ["SOP", "Sequence"] }, { x: 310, l: "Material", b: ["Grade", "Supplier"] }].map((c, ci) => (
          <g key={ci}><line x1={c.x} y1={ci % 2 === 0 ? 30 : 170} x2={c.x} y2="100" stroke="#818cf8" strokeWidth="1" opacity="0.3" /><text x={c.x} y={ci % 2 === 0 ? 22 : 188} textAnchor="middle" fill="#6366f1" fontSize="10" fontWeight="600">{c.l}</text>
            {c.b.map((b, bi) => <text key={bi} x={c.x + (bi === 0 ? -20 : 20)} y={ci % 2 === 0 ? 45 + bi * 14 : 150 - bi * 14} textAnchor="middle" fill="#9ca3af" fontSize="8">{b}</text>)}</g>
        ))}<rect x="340" y="85" width="55" height="30" rx="4" fill="#fef2f2" stroke="#fca5a5" strokeWidth="0.5" /><text x="367" y="104" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="600">Effect</text>
      </svg>
    </div>
  );
}
function KaizenMockup() {
  return (
    <div className="space-y-2"><div className="text-xs text-gray-400 mb-2 font-medium">Active Shop Floor Kaizen</div>
      {[{ t: "Reduce CNC-4 setup time", s: "In Progress", c: "bg-blue-100 text-blue-700" }, { t: "5S zone B reorganization", s: "Done", c: "bg-emerald-100 text-emerald-700" }, { t: "Poka-yoke fixture design", s: "Pending", c: "bg-amber-100 text-amber-700" }, { t: "Reduce scrap Line 2", s: "In Progress", c: "bg-blue-100 text-blue-700" }].map((item, i) => (
        <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 hover:bg-gray-100 transition-colors cursor-pointer"><span className="text-xs text-gray-600 flex-1 truncate font-medium">{item.t}</span><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.c}`}>{item.s}</span></div>
      ))}
    </div>
  );
}
function TPMMockup() {
  return (
    <div className="space-y-3"><div className="text-xs text-gray-400 mb-2 font-medium">Equipment Health — Shop Floor</div>
      {[{ n: "CNC-1", h: 96, s: "Good" }, { n: "CNC-2", h: 88, s: "Monitor" }, { n: "Press A", h: 72, s: "Warning" }, { n: "Lathe 3", h: 94, s: "Good" }].map((eq, i) => (
        <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 hover:shadow-sm transition-shadow">
          <div className="flex justify-between mb-1.5"><span className="text-xs text-gray-600 font-semibold">{eq.n}</span><span className={`text-[10px] font-bold ${eq.h > 90 ? "text-emerald-600" : eq.h > 80 ? "text-amber-600" : "text-red-600"}`}>{eq.s}</span></div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${eq.h > 90 ? "bg-emerald-500" : eq.h > 80 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${eq.h}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
function CopilotMockup() {
  return (
    <div className="space-y-3"><div className="text-xs text-gray-400 mb-1 font-medium">AI Factory Copilot</div>
      <div className="flex justify-end"><div className="bg-indigo-50 border border-indigo-100 rounded-xl rounded-br-sm px-3 py-2 max-w-[80%]"><p className="text-xs text-gray-700">Why is OEE dropping on Line A?</p></div></div>
      <div className="flex justify-start"><div className="bg-gray-50 border border-gray-100 rounded-xl rounded-bl-sm px-3 py-2.5 max-w-[90%]"><p className="text-xs text-gray-600 leading-relaxed">OEE dropped from 84.2% to 76.8%. Main driver: <span className="text-amber-600 font-bold">Performance (-9.1%)</span>, caused by micro-stops during shift B on the shop floor.</p>
        <div className="mt-2 flex gap-2"><span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors">View stops</span><span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors">Start 5 Why</span></div></div></div>
    </div>
  );
}
function MockupScreen({ type }: { type: string }) {
  switch (type) { case "oee": return <OEEMockup />; case "ishikawa": return <IshikawaMockup />; case "kaizen": return <KaizenMockup />; case "tpm": return <TPMMockup />; case "copilot": return <CopilotMockup />; default: return <OEEMockup />; }
}

export default function ProductShowcase({ t }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();
  const { ref: contentRef, isVisible: contentVisible } = useScrollReveal({ threshold: 0.1 });
  const active = categories[activeTab];
  const colors = colorMap[active.color];
  const mockupRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMockupMove = (e: React.MouseEvent) => {
    const el = mockupRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <section id="showcase" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headerRef} className={`text-center max-w-3xl mx-auto mb-14 transition-all duration-700 ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-indigo-600 mb-4">{t("showcase.eyebrow")}</span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-[0.95]">{t("showcase.title")}</h2>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed">{t("showcase.subtitle")}</p>
        </div>
        <div ref={contentRef} className={`transition-all duration-700 delay-200 ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((cat, i) => {
              const c = colorMap[cat.color];
              return (
                <button key={cat.key} onClick={() => setActiveTab(i)}
                  className={`px-5 py-2.5 text-sm font-medium rounded-full border transition-all duration-300 hover:scale-105 ${i === activeTab ? c.pillActive : `text-gray-500 border-gray-200 ${c.pill}`}`}>
                  {t(`showcase.${cat.key}`)}
                </button>
              );
            })}
          </div>
          {/* Content */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">{t(`showcase.${active.key}d`)}</h3>
                <p className="text-gray-500 leading-relaxed">{t(`showcase.${active.key}detail`)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {active.tools.map((tool, i) => (
                  <span
                    key={tool}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border ${colors.tag} transition-all duration-300 hover:scale-105`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    {t(`showcase.tool.${tool}`)}
                  </span>
                ))}
              </div>
              <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 group">
                See it in action <svg className="w-4 h-4 transition-transform group-hover:translate-x-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="relative" ref={mockupRef} onMouseMove={handleMockupMove}>
              {/* Spotlight glow on hover */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 hover:opacity-100 transition-opacity z-10"
                style={{
                  background: `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99,102,241,0.05), transparent 60%)`,
                }}
              />
              <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-lg hover:shadow-xl transition-shadow duration-500 min-h-[320px]">
                <div className="flex items-center gap-1.5 mb-4 pb-3 border-b border-gray-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-200" /><div className="w-2.5 h-2.5 rounded-full bg-gray-200" /><div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  <span className="ml-3 text-[10px] text-gray-400 font-mono">leanpilot.app/shop-floor</span>
                </div>
                <MockupScreen type={active.mockup} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
