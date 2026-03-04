"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { WhatsAppTemplate, Customer } from "@/types";
import {
    Send,
    MessageSquare,
    Filter,
    Users,
    Eye,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    ArrowRight,
    Sparkles,
} from "lucide-react";

function CampaignsContent() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
    const [filterText, setFilterText] = useState("");
    const [matchedCustomers, setMatchedCustomers] = useState<Customer[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterError, setFilterError] = useState("");
    const [filterSuggestion, setFilterSuggestion] = useState("");
    const [inferenceCaution, setInferenceCaution] = useState("");
    const [inferredFields, setInferredFields] = useState<Array<{ field: string; source: string }>>([]);
    const [sendResults, setSendResults] = useState<Array<{ customer_name: string; success: boolean; error?: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [templatesLoading, setTemplatesLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push("/login");
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) loadTemplates();
    }, [isAuthenticated]);

    const loadTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const res = await api.getTemplates();
            setTemplates(res.templates || []);
        } catch {
            console.error("Failed to load templates");
        } finally {
            setTemplatesLoading(false);
        }
    };

    const handleFilter = async () => {
        if (!filterText.trim()) return;
        setLoading(true);
        setFilterError("");
        setFilterSuggestion("");
        setInferenceCaution("");
        setInferredFields([]);
        try {
            const res = await api.filterCampaign(filterText);
            if (res.success) {
                setMatchedCustomers(res.customers);
                setSelectedIds(new Set(res.customers.map((c: Customer) => c.id)));
                if (res.inference_caution) {
                    setInferenceCaution(res.inference_caution);
                }
                if (res.inferred_fields) {
                    setInferredFields(res.inferred_fields);
                }
                setStep(3);
            } else {
                setFilterError(res.error || "Filter failed");
                setFilterSuggestion(res.suggestion || "");
            }
        } catch (err) {
            setFilterError("Failed to process filter");
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!selectedTemplate || selectedIds.size === 0) return;
        setLoading(true);
        try {
            const res = await api.sendCampaign({
                template_name: selectedTemplate.name,
                customer_ids: Array.from(selectedIds),
                nl_filter_text: filterText,
            });
            setSendResults(res.results);
            setStep(4);
        } catch {
            console.error("Send failed");
        } finally {
            setLoading(false);
        }
    };

    const toggleCustomer = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    if (authLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-[272px] p-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-2">WhatsApp Campaigns</h1>
                    <p className="text-[var(--muted)] mb-8">Send template messages to filtered customer segments</p>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-2 mb-8">
                        {[
                            { num: 1, label: "Template" },
                            { num: 2, label: "Filter" },
                            { num: 3, label: "Preview" },
                            { num: 4, label: "Results" },
                        ].map(({ num, label }) => (
                            <div key={num} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${step >= num
                                    ? "bg-[var(--primary)] text-white"
                                    : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border-color)]"
                                    }`}>
                                    {num}
                                </div>
                                <span className={`text-sm ${step >= num ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
                                    {label}
                                </span>
                                {num < 4 && <div className={`w-8 h-px ${step > num ? "bg-[var(--primary)]" : "bg-[var(--border-color)]"}`} />}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Select Template */}
                    {step === 1 && (
                        <div className="glass-card p-6 animate-fadeIn">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-[var(--primary)]" />
                                Select Template
                            </h3>
                            {templatesLoading ? (
                                <div className="text-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--primary)]" />
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-8">
                                    <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[var(--muted)] opacity-30" />
                                    <p className="text-[var(--muted)]">No approved templates found</p>
                                    <p className="text-xs text-[var(--muted)] mt-2">Configure WhatsApp Business API credentials or create templates in Meta Business Manager</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {templates.map((t) => (
                                        <button
                                            key={t.name}
                                            onClick={() => { setSelectedTemplate(t); setStep(2); }}
                                            className={`w-full p-4 rounded-lg text-left border transition-all ${selectedTemplate?.name === t.name
                                                ? "border-[var(--primary)] bg-[var(--primary-muted)]"
                                                : "border-[var(--border-color)] bg-[var(--surface-hover)] hover:border-[var(--primary)]/50"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">{t.name}</p>
                                                    <p className="text-xs text-[var(--muted)]">{t.category} · {t.language}</p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-[var(--muted)]" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Skip to step 2 even if no templates (for demo) */}
                            {templates.length === 0 && (
                                <button
                                    onClick={() => { setSelectedTemplate({ name: "demo_template", language: "en", category: "MARKETING", components: [{ type: "BODY", text: "Hi {{1}}, check out our latest offers!" }] }); setStep(2); }}
                                    className="mt-4 w-full py-3 bg-[var(--surface-hover)] text-[var(--foreground)] rounded-lg text-sm font-medium"
                                >
                                    Use Demo Template →
                                </button>
                            )}
                        </div>
                    )}

                    {/* Step 2: Write NL Filter */}
                    {step === 2 && (
                        <div className="glass-card p-6 animate-fadeIn">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                                Filter Customers
                            </h3>
                            <p className="text-sm text-[var(--muted)] mb-4">
                                Describe your target audience in natural language. AI will find matching customers.
                            </p>

                            <div className="relative">
                                <textarea
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    placeholder='e.g. "All customers who spent more than 10k last month"'
                                    className="w-full px-4 py-3 neo-input text-sm resize-none"
                                    rows={3}
                                />
                            </div>

                            {filterError && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <div className="flex items-center gap-2 text-red-400 mb-1">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-sm font-medium">Filter Error</span>
                                    </div>
                                    <p className="text-sm text-[var(--muted)]">{filterError}</p>
                                    {filterSuggestion && (
                                        <p className="text-sm text-cyan-400 mt-2">💡 Suggestion: {filterSuggestion}</p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setStep(1)} className="px-6 py-2.5 neo-btn text-sm">Back</button>
                                <button onClick={handleFilter} disabled={!filterText.trim() || loading} className="flex-1 py-2.5 neo-btn neo-btn-primary text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors border-none!">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Filter className="w-4 h-4" /> Find Customers</>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preview & Confirm */}
                    {step === 3 && (
                        <div className="glass-card p-6 animate-fadeIn">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-[var(--success)]" />
                                    Preview — {matchedCustomers.length} customers matched
                                </h3>
                                <span className="text-sm text-[var(--muted)]">
                                    {selectedIds.size} selected
                                </span>
                            </div>

                            {/* Inference Caution Banner */}
                            {inferenceCaution && (
                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-sm font-medium text-amber-400">AI Inference Used</span>
                                            <p className="text-sm text-[var(--muted)] mt-1">{inferenceCaution}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="max-h-[400px] overflow-y-auto space-y-2 mb-6">
                                {matchedCustomers.map((c) => (
                                    <label key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border-color)]/30 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(c.id)}
                                            onChange={() => toggleCustomer(c.id)}
                                            className="w-4 h-4 accent-[var(--primary)]"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium">{c.name}</p>
                                                {(c as any)._inferred_gender && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                                                        {(c as any)._inferred_gender} (inferred)
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--muted)]">{c.phone} · Spent {formatCurrency(c.lifetime_spend || 0)}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            {selectedTemplate && (
                                <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--border-color)] mb-6">
                                    <p className="text-xs text-[var(--muted)] mb-2">Template Preview</p>
                                    {selectedTemplate.components.map((comp, idx) => {
                                        const customerName = matchedCustomers[0]?.name || "Customer";
                                        if (comp.type === "HEADER" && comp.text) {
                                            return (
                                                <p key={idx} className="text-sm font-bold mb-1">
                                                    {comp.text.replace("{{1}}", customerName)}
                                                </p>
                                            );
                                        }
                                        if (comp.type === "BODY" && comp.text) {
                                            return (
                                                <p key={idx} className="text-sm whitespace-pre-line">
                                                    {comp.text.replace("{{1}}", customerName)}
                                                </p>
                                            );
                                        }
                                        if (comp.type === "FOOTER" && comp.text) {
                                            return (
                                                <p key={idx} className="text-xs text-[var(--muted)] mt-2 italic">
                                                    {comp.text}
                                                </p>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            )}

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setStep(2)} className="px-6 py-2.5 neo-btn text-sm">Back</button>
                                <button onClick={handleSend} disabled={selectedIds.size === 0 || loading} className="flex-1 py-2.5 neo-btn bg-[var(--success)] text-white shadow-[4px_4px_10px_rgba(16,185,129,0.3),-4px_-4px_10px_rgba(255,255,255,0.4)] hover:shadow-[6px_6px_14px_rgba(16,185,129,0.4),-6px_-6px_14px_rgba(255,255,255,0.5)] active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.2)] text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all border-none!">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send to {selectedIds.size} customers</>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Results */}
                    {step === 4 && (
                        <div className="glass-card p-6 animate-fadeIn">
                            <h3 className="text-lg font-semibold mb-4">Campaign Results</h3>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-[var(--success)]/10 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-[var(--success)]">{sendResults.filter((r) => r.success).length}</p>
                                    <p className="text-sm text-[var(--muted)]">Sent</p>
                                </div>
                                <div className="p-4 bg-[var(--danger)]/10 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-[var(--danger)]">{sendResults.filter((r) => !r.success).length}</p>
                                    <p className="text-sm text-[var(--muted)]">Failed</p>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {sendResults.map((r, i) => (
                                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${r.success ? "bg-[var(--success)]/5" : "bg-[var(--danger)]/5"}`}>
                                        <div className="flex items-center gap-2">
                                            {r.success ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : <XCircle className="w-4 h-4 text-[var(--danger)]" />}
                                            <span className="text-sm">{r.customer_name}</span>
                                        </div>
                                        {r.error && <span className="text-xs text-[var(--danger)]">{r.error}</span>}
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => { setStep(1); setSelectedIds(new Set()); setMatchedCustomers([]); setSendResults([]); setFilterText(""); }} className="w-full mt-6 py-3 neo-btn neo-btn-primary text-sm font-medium border-none!">
                                New Campaign
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function CampaignsPage() {
    return <CampaignsContent />;
}
