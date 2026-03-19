"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { adminApi, manufacturingApi, productionApi, oeeApi } from "@/lib/api";
import {
  Factory,
  Package,
  ClipboardList,
  Gauge,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Loader2,
  PartyPopper,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SetupWizardProps {
  onComplete: () => void;
  onNavigate: (view: string) => void;
}

interface ProductionLineInput {
  name: string;
  line_type: string;
}

interface ProductInput {
  name: string;
  code: string;
  unit: string;
}

interface ProductionEntryInput {
  line_id: number;
  product_id: number;
  planned_quantity: number;
  actual_quantity: number;
  good_quantity: number;
  downtime_minutes: number;
}

interface CreatedLine {
  id: number;
  name: string;
}

interface CreatedProduct {
  id: number;
  name: string;
}

type WizardStep = "welcome" | "lines" | "products" | "production" | "result";

const STEPS: WizardStep[] = ["welcome", "lines", "products", "production", "result"];

const STEP_ICONS = {
  welcome: Rocket,
  lines: Factory,
  products: Package,
  production: ClipboardList,
  result: Gauge,
};

const LINE_TYPES = [
  "assembly",
  "machining",
  "packaging",
  "welding",
  "painting",
  "injection_molding",
  "other",
];

const UNITS = ["pcs", "kg", "m", "l", "sets"];

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

const WIZARD_STORAGE_KEY = "leanpilot_setup_wizard";

function getWizardProgress(userId?: number): { step: number; completed: boolean } {
  try {
    const raw = localStorage.getItem(`${WIZARD_STORAGE_KEY}_${userId || "anon"}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { step: 0, completed: false };
}

function saveWizardProgress(step: number, userId?: number): void {
  try {
    localStorage.setItem(
      `${WIZARD_STORAGE_KEY}_${userId || "anon"}`,
      JSON.stringify({ step, completed: false })
    );
  } catch { /* ignore */ }
}

function markWizardComplete(userId?: number): void {
  try {
    localStorage.setItem(
      `${WIZARD_STORAGE_KEY}_${userId || "anon"}`,
      JSON.stringify({ step: 4, completed: true })
    );
  } catch { /* ignore */ }
}

export function isSetupWizardComplete(userId?: number): boolean {
  return getWizardProgress(userId).completed;
}

export function resetSetupWizard(userId?: number): void {
  try {
    localStorage.removeItem(`${WIZARD_STORAGE_KEY}_${userId || "anon"}`);
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Hook: useSetupWizard                                               */
/* ------------------------------------------------------------------ */

export function useSetupWizard() {
  const { user } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const progress = getWizardProgress(user.id);
    if (progress.completed) {
      setLoading(false);
      setShouldShow(false);
      return;
    }
    // Check if factory already has production lines
    adminApi
      .listProductionLines()
      .then((res) => {
        const lines = res.data;
        if (Array.isArray(lines) && lines.length > 0) {
          // Factory already has lines, mark wizard complete
          markWizardComplete(user.id);
          setShouldShow(false);
        } else {
          setShouldShow(true);
        }
      })
      .catch(() => {
        // If API fails, don't block the user
        setShouldShow(false);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return {
    shouldShow,
    loading,
    dismiss: () => {
      markWizardComplete(user?.id);
      setShouldShow(false);
    },
    reset: () => {
      resetSetupWizard(user?.id);
      setShouldShow(true);
    },
    show: () => setShouldShow(true),
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SetupWizard({ onComplete, onNavigate }: SetupWizardProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const focusRef = useRef<HTMLDivElement>(null);

  // Wizard state
  const savedProgress = getWizardProgress(user?.id);
  const [currentStep, setCurrentStep] = useState<number>(savedProgress.step);
  const [isAnimating, setIsAnimating] = useState(false);

  // Step 2: Production Lines
  const [lines, setLines] = useState<ProductionLineInput[]>([
    { name: "", line_type: "assembly" },
  ]);
  const [createdLines, setCreatedLines] = useState<CreatedLine[]>([]);
  const [linesCreated, setLinesCreated] = useState(false);
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesError, setLinesError] = useState("");

  // Step 3: Products
  const [products, setProducts] = useState<ProductInput[]>([
    { name: "", code: "", unit: "pcs" },
  ]);
  const [createdProducts, setCreatedProducts] = useState<CreatedProduct[]>([]);
  const [productsCreated, setProductsCreated] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");

  // Step 4: Production Entry
  const [entry, setEntry] = useState<ProductionEntryInput>({
    line_id: 0,
    product_id: 0,
    planned_quantity: 100,
    actual_quantity: 90,
    good_quantity: 85,
    downtime_minutes: 15,
  });
  const [entryCreated, setEntryCreated] = useState(false);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState("");

  // Step 5: OEE Result
  const [oeeResult, setOeeResult] = useState<{
    oee: number;
    availability: number;
    performance: number;
    quality: number;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Auto-detect existing data
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const linesRes = await adminApi.listProductionLines();
        if (Array.isArray(linesRes.data) && linesRes.data.length > 0) {
          setCreatedLines(linesRes.data.map((l: any) => ({ id: l.id, name: l.name })));
          setLinesCreated(true);

          const productsRes = await manufacturingApi.listProducts();
          if (Array.isArray(productsRes.data) && productsRes.data.length > 0) {
            setCreatedProducts(productsRes.data.map((p: any) => ({ id: p.id, name: p.name })));
            setProductsCreated(true);
            // Set defaults for entry
            setEntry((prev) => ({
              ...prev,
              line_id: linesRes.data[0].id,
              product_id: productsRes.data[0].id,
            }));
          }
        }
      } catch { /* ignore */ }
    };
    checkExisting();
  }, []);

  // Persist progress
  useEffect(() => {
    saveWizardProgress(currentStep, user?.id);
  }, [currentStep, user?.id]);

  // Focus management
  useEffect(() => {
    focusRef.current?.focus();
  }, [currentStep]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const stepKey = STEPS[currentStep];
  const StepIcon = STEP_ICONS[stepKey];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  /* ---------------------------------------------------------------- */
  /*  Navigation                                                       */
  /* ---------------------------------------------------------------- */

  const goNext = useCallback(() => {
    if (isLast) {
      markWizardComplete(user?.id);
      onComplete();
      return;
    }
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
      setIsAnimating(false);
    }, 200);
  }, [isLast, user?.id, onComplete]);

  const goBack = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((s) => Math.max(s - 1, 0));
      setIsAnimating(false);
    }, 200);
  }, []);

  const handleSkip = useCallback(() => {
    markWizardComplete(user?.id);
    onComplete();
  }, [user?.id, onComplete]);

  /* ---------------------------------------------------------------- */
  /*  Step validation                                                  */
  /* ---------------------------------------------------------------- */

  const canProceed = (): boolean => {
    switch (stepKey) {
      case "welcome":
        return true;
      case "lines":
        return linesCreated && createdLines.length > 0;
      case "products":
        return productsCreated && createdProducts.length > 0;
      case "production":
        return entryCreated;
      case "result":
        return true;
      default:
        return true;
    }
  };

  /* ---------------------------------------------------------------- */
  /*  API Actions                                                      */
  /* ---------------------------------------------------------------- */

  const createLines = async () => {
    const validLines = lines.filter((l) => l.name.trim() !== "");
    if (validLines.length === 0) {
      setLinesError(t("wizard.errorNoLineName"));
      return;
    }
    setLinesLoading(true);
    setLinesError("");
    try {
      const created: CreatedLine[] = [];
      for (const line of validLines) {
        const res = await adminApi.createProductionLine({
          name: line.name.trim(),
          description: line.line_type,
        });
        created.push({ id: res.data.id, name: res.data.name });
      }
      setCreatedLines(created);
      setLinesCreated(true);
      // Set default line for production entry
      setEntry((prev) => ({ ...prev, line_id: created[0].id }));
    } catch (err: any) {
      setLinesError(err?.response?.data?.detail || t("wizard.errorCreateLines"));
    } finally {
      setLinesLoading(false);
    }
  };

  const createProducts = async () => {
    const validProducts = products.filter((p) => p.name.trim() !== "" && p.code.trim() !== "");
    if (validProducts.length === 0) {
      setProductsError(t("wizard.errorNoProductName"));
      return;
    }
    setProductsLoading(true);
    setProductsError("");
    try {
      const created: CreatedProduct[] = [];
      for (const product of validProducts) {
        const res = await manufacturingApi.createProduct({
          name: product.name.trim(),
          code: product.code.trim(),
          unit_of_measure: product.unit,
        });
        created.push({ id: res.data.id, name: res.data.name });
      }
      setCreatedProducts(created);
      setProductsCreated(true);
      // Set default product for production entry
      setEntry((prev) => ({ ...prev, product_id: created[0].id }));
    } catch (err: any) {
      setProductsError(err?.response?.data?.detail || t("wizard.errorCreateProducts"));
    } finally {
      setProductsLoading(false);
    }
  };

  const createProductionEntry = async () => {
    if (!entry.line_id || !entry.product_id) {
      setEntryError(t("wizard.errorSelectLineProduct"));
      return;
    }
    if (entry.planned_quantity <= 0) {
      setEntryError(t("wizard.errorPlannedQty"));
      return;
    }
    setEntryLoading(true);
    setEntryError("");
    try {
      await productionApi.createRecord({
        production_line_id: entry.line_id,
        date: new Date().toISOString().split("T")[0],
        planned_production_time_min: 480,
        actual_run_time_min: 480 - entry.downtime_minutes,
        total_pieces: entry.actual_quantity,
        good_pieces: entry.good_quantity,
        ideal_cycle_time_sec: entry.planned_quantity > 0 ? Math.round((480 * 60) / entry.planned_quantity) : 60,
      });
      // Calculate OEE
      const totalMinutes = 480; // 8-hour shift
      const runTime = totalMinutes - entry.downtime_minutes;
      const availability = runTime / totalMinutes;
      const performance =
        entry.planned_quantity > 0 ? entry.actual_quantity / entry.planned_quantity : 0;
      const quality =
        entry.actual_quantity > 0 ? entry.good_quantity / entry.actual_quantity : 0;
      const oee = availability * performance * quality;
      setOeeResult({
        oee: Math.round(oee * 1000) / 10,
        availability: Math.round(availability * 1000) / 10,
        performance: Math.round(performance * 1000) / 10,
        quality: Math.round(quality * 1000) / 10,
      });
      setEntryCreated(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    } catch (err: any) {
      setEntryError(err?.response?.data?.detail || t("wizard.errorCreateEntry"));
    } finally {
      setEntryLoading(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Line Helpers                                                     */
  /* ---------------------------------------------------------------- */

  const addLine = () => {
    if (lines.length < 3) {
      setLines([...lines, { name: "", line_type: "assembly" }]);
    }
  };

  const removeLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const updateLine = (idx: number, field: keyof ProductionLineInput, value: string) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  /* ---------------------------------------------------------------- */
  /*  Product Helpers                                                  */
  /* ---------------------------------------------------------------- */

  const addProduct = () => {
    if (products.length < 2) {
      setProducts([...products, { name: "", code: "", unit: "pcs" }]);
    }
  };

  const removeProduct = (idx: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== idx));
    }
  };

  const updateProduct = (idx: number, field: keyof ProductInput, value: string) => {
    setProducts(products.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  /* ---------------------------------------------------------------- */
  /*  OEE Gauge                                                        */
  /* ---------------------------------------------------------------- */

  const OEEGauge = ({ value, label }: { value: number; label: string }) => {
    const color =
      value >= 85 ? "text-emerald-500" : value >= 60 ? "text-amber-500" : "text-rose-500";
    const bgColor =
      value >= 85
        ? "from-emerald-500/20 to-emerald-500/5"
        : value >= 60
        ? "from-amber-500/20 to-amber-500/5"
        : "from-rose-500/20 to-rose-500/5";
    const strokeColor =
      value >= 85 ? "#10b981" : value >= 60 ? "#f59e0b" : "#f43f5e";
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (value / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <div className={`relative w-28 h-28 rounded-full bg-gradient-to-b ${bgColor}`}>
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-th-bg-3" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke={strokeColor} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${color}`}>{value}%</span>
          </div>
        </div>
        <span className="text-xs text-th-text-2 mt-2 font-medium">{label}</span>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Step Renderers                                                   */
  /* ---------------------------------------------------------------- */

  const renderWelcome = () => (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
        <Rocket size={32} className="text-white" />
      </div>
      <h2 className="text-2xl font-bold text-th-text mb-3">
        {t("wizard.welcomeTitle")}
      </h2>
      <p className="text-th-text-2 max-w-lg mx-auto leading-relaxed mb-6">
        {t("wizard.welcomeDesc")}
      </p>
      <div className="flex justify-center gap-3">
        {STEPS.slice(1).map((s, i) => {
          const Icon = STEP_ICONS[s];
          return (
            <div key={s} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-lg bg-th-bg-3 flex items-center justify-center">
                <Icon size={18} className="text-th-text-2" />
              </div>
              <span className="text-[10px] text-th-text-3 font-medium">
                {t(`wizard.stepLabel${i + 1}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderLines = () => (
    <div>
      <h2 className="text-xl font-bold text-th-text mb-1">{t("wizard.linesTitle")}</h2>
      <p className="text-sm text-th-text-2 mb-5">{t("wizard.linesDesc")}</p>

      {linesCreated ? (
        <div className="space-y-2">
          {createdLines.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
            >
              <Check size={18} className="text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium text-th-text">{l.name}</span>
            </div>
          ))}
          <p className="text-xs text-emerald-600 font-medium mt-2">
            {t("wizard.linesSuccess", { count: String(createdLines.length) })}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={line.name}
                  onChange={(e) => updateLine(idx, "name", e.target.value)}
                  placeholder={t("wizard.lineName")}
                  className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text placeholder:text-th-text-3 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  aria-label={t("wizard.lineName")}
                />
                <select
                  value={line.line_type}
                  onChange={(e) => updateLine(idx, "line_type", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  aria-label={t("wizard.lineType")}
                >
                  {LINE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {t(`wizard.lineType_${lt}`)}
                    </option>
                  ))}
                </select>
              </div>
              {lines.length > 1 && (
                <button
                  onClick={() => removeLine(idx)}
                  className="p-2 text-th-text-3 hover:text-rose-500 transition"
                  aria-label={t("common.remove")}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {lines.length < 3 && (
            <button
              onClick={addLine}
              className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 font-medium transition"
            >
              <Plus size={14} /> {t("wizard.addLine")}
            </button>
          )}
          {linesError && (
            <p className="text-xs text-rose-500 mt-1">{linesError}</p>
          )}
          <button
            onClick={createLines}
            disabled={linesLoading}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-sm font-semibold hover:shadow-md transition disabled:opacity-50"
          >
            {linesLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Factory size={16} />
            )}
            {t("wizard.createLines")}
          </button>
        </div>
      )}
    </div>
  );

  const renderProducts = () => (
    <div>
      <h2 className="text-xl font-bold text-th-text mb-1">{t("wizard.productsTitle")}</h2>
      <p className="text-sm text-th-text-2 mb-5">{t("wizard.productsDesc")}</p>

      {productsCreated ? (
        <div className="space-y-2">
          {createdProducts.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
            >
              <Check size={18} className="text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium text-th-text">{p.name}</span>
            </div>
          ))}
          <p className="text-xs text-emerald-600 font-medium mt-2">
            {t("wizard.productsSuccess", { count: String(createdProducts.length) })}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => updateProduct(idx, "name", e.target.value)}
                  placeholder={t("wizard.productName")}
                  className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text placeholder:text-th-text-3 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  aria-label={t("wizard.productName")}
                />
                <input
                  type="text"
                  value={product.code}
                  onChange={(e) => updateProduct(idx, "code", e.target.value)}
                  placeholder={t("wizard.productCode")}
                  className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text placeholder:text-th-text-3 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  aria-label={t("wizard.productCode")}
                />
                <select
                  value={product.unit}
                  onChange={(e) => updateProduct(idx, "unit", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  aria-label={t("wizard.productUnit")}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              {products.length > 1 && (
                <button
                  onClick={() => removeProduct(idx)}
                  className="p-2 text-th-text-3 hover:text-rose-500 transition"
                  aria-label={t("common.remove")}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {products.length < 2 && (
            <button
              onClick={addProduct}
              className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 font-medium transition"
            >
              <Plus size={14} /> {t("wizard.addProduct")}
            </button>
          )}
          {productsError && (
            <p className="text-xs text-rose-500 mt-1">{productsError}</p>
          )}
          <button
            onClick={createProducts}
            disabled={productsLoading}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-sm font-semibold hover:shadow-md transition disabled:opacity-50"
          >
            {productsLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Package size={16} />
            )}
            {t("wizard.createProducts")}
          </button>
        </div>
      )}
    </div>
  );

  const renderProduction = () => (
    <div>
      <h2 className="text-xl font-bold text-th-text mb-1">{t("wizard.productionTitle")}</h2>
      <p className="text-sm text-th-text-2 mb-5">{t("wizard.productionDesc")}</p>

      {entryCreated ? (
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Check size={28} className="text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-emerald-600">{t("wizard.entrySuccess")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-th-text-2 mb-1 font-medium">
                {t("wizard.selectLine")}
              </label>
              <select
                value={entry.line_id}
                onChange={(e) => setEntry({ ...entry, line_id: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label={t("wizard.selectLine")}
              >
                <option value={0}>{t("wizard.chooseOption")}</option>
                {createdLines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-th-text-2 mb-1 font-medium">
                {t("wizard.selectProduct")}
              </label>
              <select
                value={entry.product_id}
                onChange={(e) => setEntry({ ...entry, product_id: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label={t("wizard.selectProduct")}
              >
                <option value={0}>{t("wizard.chooseOption")}</option>
                {createdProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-th-text-2 mb-1 font-medium">
                {t("wizard.plannedQty")}
              </label>
              <input
                type="number"
                min={1}
                value={entry.planned_quantity}
                onChange={(e) =>
                  setEntry({ ...entry, planned_quantity: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label={t("wizard.plannedQty")}
              />
            </div>
            <div>
              <label className="block text-xs text-th-text-2 mb-1 font-medium">
                {t("wizard.actualQty")}
              </label>
              <input
                type="number"
                min={0}
                value={entry.actual_quantity}
                onChange={(e) =>
                  setEntry({ ...entry, actual_quantity: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label={t("wizard.actualQty")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-th-text-2 mb-1 font-medium">
                {t("wizard.goodQty")}
              </label>
              <input
                type="number"
                min={0}
                value={entry.good_quantity}
                onChange={(e) =>
                  setEntry({ ...entry, good_quantity: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label={t("wizard.goodQty")}
              />
            </div>
            <div>
              <label className="block text-xs text-th-text-2 mb-1 font-medium">
                {t("wizard.downtimeMin")}
              </label>
              <input
                type="number"
                min={0}
                value={entry.downtime_minutes}
                onChange={(e) =>
                  setEntry({ ...entry, downtime_minutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-th-bg-3 border border-th-border text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label={t("wizard.downtimeMin")}
              />
            </div>
          </div>

          {entryError && (
            <p className="text-xs text-rose-500">{entryError}</p>
          )}

          <button
            onClick={createProductionEntry}
            disabled={entryLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-sm font-semibold hover:shadow-md transition disabled:opacity-50"
          >
            {entryLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ClipboardList size={16} />
            )}
            {t("wizard.submitEntry")}
          </button>
        </div>
      )}
    </div>
  );

  const renderResult = () => (
    <div className="text-center">
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
                fontSize: `${10 + Math.random() * 16}px`,
                opacity: 0.8,
              }}
            >
              {["*", "+", "~"][Math.floor(Math.random() * 3)]}
            </div>
          ))}
        </div>
      )}

      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
        <PartyPopper size={28} className="text-white" />
      </div>

      <h2 className="text-2xl font-bold text-th-text mb-2">{t("wizard.resultTitle")}</h2>
      <p className="text-sm text-th-text-2 mb-6">{t("wizard.resultDesc")}</p>

      {oeeResult && (
        <div className="flex justify-center gap-6 mb-8">
          <OEEGauge value={oeeResult.oee} label="OEE" />
          <OEEGauge value={oeeResult.availability} label={t("wizard.availability")} />
          <OEEGauge value={oeeResult.performance} label={t("wizard.performance")} />
          <OEEGauge value={oeeResult.quality} label={t("wizard.quality")} />
        </div>
      )}

      <div className="flex justify-center gap-3">
        <button
          onClick={() => {
            markWizardComplete(user?.id);
            onNavigate("dashboard");
            onComplete();
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-sm font-semibold hover:shadow-md transition"
        >
          <Gauge size={16} />
          {t("wizard.exploreDashboard")}
        </button>
        <button
          onClick={() => {
            markWizardComplete(user?.id);
            onNavigate("assessment");
            onComplete();
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-th-bg-3 border border-th-border text-th-text text-sm font-medium hover:bg-th-bg-2 transition"
        >
          {t("wizard.continueAssessment")}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );

  const stepRenderers: Record<WizardStep, () => JSX.Element> = {
    welcome: renderWelcome,
    lines: renderLines,
    products: renderProducts,
    production: renderProduction,
    result: renderResult,
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("wizard.ariaLabel")}
    >
      <div
        ref={focusRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl mx-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute -top-10 right-0 text-white/60 hover:text-white text-xs font-medium flex items-center gap-1 transition"
          aria-label={t("wizard.skip")}
        >
          {t("wizard.skip")} <X size={14} />
        </button>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, idx) => {
              const Icon = STEP_ICONS[s];
              const isComplete = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isComplete
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-brand-500 text-white ring-2 ring-brand-500/30"
                        : "bg-white/10 text-white/40"
                    }`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isComplete ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`w-12 sm:w-20 h-0.5 mx-1 transition-all ${
                        idx < currentStep ? "bg-emerald-500" : "bg-white/10"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-white/60 text-xs text-center">
            {t("wizard.stepOf", { current: String(currentStep + 1), total: String(STEPS.length) })}
          </p>
        </div>

        {/* Card */}
        <div
          className={`relative overflow-hidden rounded-xl border border-th-border bg-th-bg-2 shadow-xl transition-all duration-200 ${
            isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
          }`}
        >
          <div className="p-8">{stepRenderers[stepKey]()}</div>
        </div>

        {/* Navigation */}
        {stepKey !== "result" && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={goBack}
              disabled={isFirst}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                isFirst
                  ? "opacity-0 cursor-default"
                  : "text-white/70 hover:text-white bg-white/5 hover:bg-white/10"
              }`}
              aria-label={t("common.back")}
            >
              <ArrowLeft size={16} />
              {t("common.back").replace("← ", "")}
            </button>
            <button
              onClick={goNext}
              disabled={!canProceed() && stepKey !== "welcome"}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition ${
                canProceed() || stepKey === "welcome"
                  ? "bg-gradient-to-r from-brand-500 to-purple-500 hover:shadow-md"
                  : "bg-white/10 opacity-50 cursor-not-allowed"
              }`}
              aria-label={t("common.next")}
            >
              {t("common.next")}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
