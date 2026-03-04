"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, getPaymentColor } from "@/lib/utils";
import type { FinancialSummary, Expense, ExpenseParseResult } from "@/types";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    Loader2,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    BarChart3,
    PlusCircle,
} from "lucide-react";

function FinanceContent() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const router = useRouter();

    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Expense input
    const [expenseText, setExpenseText] = useState("");
    const [parsedExpense, setParsedExpense] = useState<ExpenseParseResult | null>(null);
    const [parsingExpense, setParsingExpense] = useState(false);
    const [savingExpense, setSavingExpense] = useState(false);
    const [showExpenseInput, setShowExpenseInput] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push("/login");
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) loadData();
    }, [isAuthenticated, dateFrom, dateTo]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sumRes, expRes] = await Promise.all([
                api.getFinanceSummary(dateFrom, dateTo),
                api.getExpenses({ date_from: dateFrom, date_to: dateTo }),
            ]);
            setSummary(sumRes);
            setExpenses(expRes.expenses);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleParseExpense = async () => {
        if (!expenseText.trim()) return;
        setParsingExpense(true);
        try {
            const res = await api.parseExpense(expenseText);
            setParsedExpense(res);
        } catch {
            console.error("Parse failed");
        } finally {
            setParsingExpense(false);
        }
    };

    const handleConfirmExpense = async () => {
        if (!parsedExpense?.fields) return;
        setSavingExpense(true);
        try {
            await api.confirmExpense(parsedExpense.fields);
            setParsedExpense(null);
            setExpenseText("");
            setShowExpenseInput(false);
            loadData();
        } catch {
            console.error("Confirm failed");
        } finally {
            setSavingExpense(false);
        }
    };

    if (authLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    // Category chart (simple bar representation)
    const categories = summary?.category_breakdown || {};
    const maxCatAmount = Math.max(...Object.values(categories), 1);

    const catColors: Record<string, string> = {
        supplies: "bg-blue-400",
        rent: "bg-purple-400",
        utilities: "bg-amber-400",
        equipment: "bg-cyan-400",
        marketing: "bg-pink-400",
        salary: "bg-emerald-400",
        maintenance: "bg-orange-400",
        other: "bg-gray-400",
    };

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-0 md:ml-[272px] p-4 md:p-8 pt-16 md:pt-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Financial Dashboard</h1>
                        <p className="text-[var(--muted)] mt-1">Revenue, expenses, and profit at a glance</p>
                    </div>
                    <button
                        onClick={() => setShowExpenseInput(!showExpenseInput)}
                        className="neo-btn neo-btn-primary flex items-center gap-2 px-6 py-3 text-sm transition-all border-none!"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Log Expense
                    </button>
                </div>

                {/* Date Range Filter */}
                <div className="glass-panel p-4 mb-6 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <Calendar className="w-5 h-5 text-[var(--muted)] hidden sm:block" />
                        <div className="flex flex-wrap gap-2">
                            {[
                                { label: "Today", getRange: () => { const d = new Date().toISOString().split("T")[0]; return [d, d]; } },
                                { label: "This Week", getRange: () => { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - now.getDay()); return [start.toISOString().split("T")[0], now.toISOString().split("T")[0]]; } },
                                { label: "This Month", getRange: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); return [start.toISOString().split("T")[0], now.toISOString().split("T")[0]]; } },
                                { label: "This Year", getRange: () => { const now = new Date(); const start = new Date(now.getFullYear(), 0, 1); return [start.toISOString().split("T")[0], now.toISOString().split("T")[0]]; } },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => { const [from, to] = preset.getRange(); setDateFrom(from); setDateTo(to); }}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg neo-btn hover:text-[var(--primary)] transition-all"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full sm:w-auto px-4 py-3 neo-input text-sm"
                            placeholder="From"
                        />
                        <span className="text-[var(--muted)] hidden sm:block">to</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full sm:w-auto px-4 py-3 neo-input text-sm"
                            placeholder="To"
                        />
                        {(dateFrom || dateTo) && (
                            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-[var(--muted)] hover:text-[var(--danger)]">
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* NL Expense Input */}
                {showExpenseInput && (
                    <div className="glass-panel p-6 mb-6 animate-fadeIn">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                            Log Expense (Natural Language)
                        </h3>
                        <div className="flex gap-3 mb-4">
                            <input
                                value={expenseText}
                                onChange={(e) => setExpenseText(e.target.value)}
                                placeholder='e.g. "Spent 2300 on inks from ABC supplier today paid via UPI"'
                                className="flex-1 px-4 py-3 neo-input text-sm"
                                onKeyDown={(e) => e.key === "Enter" && handleParseExpense()}
                            />
                            <button onClick={handleParseExpense} disabled={parsingExpense || !expenseText.trim()} className="px-6 py-3 neo-btn neo-btn-primary text-sm font-medium disabled:opacity-50 border-none!">
                                {parsingExpense ? <Loader2 className="w-4 h-4 animate-spin" /> : "Parse"}
                            </button>
                        </div>

                        {parsedExpense && (
                            <div className="animate-fadeIn">
                                {parsedExpense.success ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-3">
                                            {Object.entries(parsedExpense.fields).filter(([k]) => k !== "raw_input").map(([key, value]) => (
                                                <div key={key} className="p-3 bg-[var(--surface-hover)] rounded-lg">
                                                    <p className="text-xs text-[var(--muted)] uppercase">{key.replace(/_/g, " ")}</p>
                                                    <p className="text-sm font-medium mt-1">{key === "amount" ? formatCurrency(value as number) : String(value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={handleConfirmExpense} disabled={savingExpense} className="flex-1 py-3 neo-btn bg-[var(--success)] text-white shadow-[4px_4px_10px_rgba(16,185,129,0.3),-4px_-4px_10px_rgba(255,255,255,0.4)] hover:shadow-[6px_6px_14px_rgba(16,185,129,0.4),-6px_-6px_14px_rgba(255,255,255,0.5)] active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.2)] text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 border-none!">
                                                {savingExpense ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Confirm & Save</>}
                                            </button>
                                            <button onClick={() => setParsedExpense(null)} className="px-6 py-3 neo-btn text-sm border-none!">
                                                Discard
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                        <span className="text-sm text-red-400">{parsedExpense.error}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Summary Cards */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                    </div>
                ) : summary ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="glass-panel p-6 animate-fadeIn">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[var(--muted)] text-xs font-bold uppercase tracking-wider">Revenue</span>
                                    <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-xs font-bold flex items-center">
                                        <TrendingUp className="w-3 h-3 mr-1" />
                                        In
                                    </span>
                                </div>
                                <p className="text-3xl font-bold tracking-tight mb-1 text-emerald-400">{formatCurrency(summary.revenue)}</p>
                                <p className="text-xs text-[var(--muted)]">{summary.order_count} orders</p>
                            </div>

                            <div className="glass-panel p-6 animate-fadeIn" style={{ animationDelay: "0.1s" }}>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[var(--muted)] text-xs font-bold uppercase tracking-wider">Expenses</span>
                                    <span className="text-red-500 bg-red-500/10 px-2 py-0.5 rounded text-xs font-bold flex items-center">
                                        <TrendingDown className="w-3 h-3 mr-1" />
                                        Out
                                    </span>
                                </div>
                                <p className="text-3xl font-bold tracking-tight mb-1 text-red-400">{formatCurrency(summary.expenses)}</p>
                                <p className="text-xs text-[var(--muted)]">{summary.expense_count} entries</p>
                            </div>

                            <div className="glass-panel p-6 animate-fadeIn" style={{ animationDelay: "0.2s" }}>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[var(--muted)] text-xs font-bold uppercase tracking-wider">Net Profit</span>
                                    <span className="text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded text-xs font-bold flex items-center">
                                        <DollarSign className="w-3 h-3 mr-1" />
                                        Net
                                    </span>
                                </div>
                                <p className={`text-3xl font-bold tracking-tight mb-1 ${summary.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {formatCurrency(summary.profit)}
                                </p>
                                <p className="text-xs text-[var(--muted)]">
                                    {summary.revenue > 0 ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}% margin` : "—"}
                                </p>
                            </div>
                        </div>

                        {/* Category Breakdown */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="glass-panel p-6 animate-fadeIn" style={{ animationDelay: "0.3s" }}>
                                <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4" />
                                    Expense Breakdown
                                </h3>
                                {Object.keys(categories).length === 0 ? (
                                    <p className="text-sm text-[var(--muted)]">No expense data</p>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(categories)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([category, amount]) => (
                                                <div key={category}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm capitalize">{category}</span>
                                                        <span className="text-sm font-medium">{formatCurrency(amount)}</span>
                                                    </div>
                                                    <div className="h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${catColors[category] || "bg-gray-400"}`}
                                                            style={{ width: `${(amount / maxCatAmount) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Expenses */}
                            <div className="glass-panel p-6 animate-fadeIn" style={{ animationDelay: "0.4s" }}>
                                <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">
                                    Recent Expenses
                                </h3>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {expenses.slice(0, 20).map((exp) => (
                                        <div key={exp.id} className="flex items-center justify-between p-3 bg-[var(--surface-hover)] rounded-lg">
                                            <div>
                                                <p className="text-sm font-medium">{exp.description || exp.category}</p>
                                                <p className="text-xs text-[var(--muted)]">
                                                    {formatDate(exp.expense_date)} · {exp.vendor || "—"} ·{" "}
                                                    <span className={getPaymentColor(exp.payment_mode)}>{exp.payment_mode}</span>
                                                </p>
                                            </div>
                                            <span className="text-sm font-semibold text-red-400">
                                                {formatCurrency(exp.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : null}
            </main>
        </div>
    );
}

export default function FinancePage() {
    return <FinanceContent />;
}
