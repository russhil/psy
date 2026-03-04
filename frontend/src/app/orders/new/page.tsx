"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { getConfidenceColor } from "@/lib/utils";
import type { Artist, OCRResult } from "@/types";
import {
    Upload,
    FileText,
    Camera,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ArrowRight,
    UserPlus,
    ImageIcon,
    ScanLine,
    Sparkles,
    X,
    Trash2,
    Plus,
    Save,
} from "lucide-react";

// ━━━ Types for the spreadsheet rows ━━━
interface OrderRow {
    id: string; // client-side row ID
    customer_name: string;
    phone: string;
    instagram: string;
    date: string;
    service_description: string;
    payment_mode: string;
    source: string;
    deposit: string;
    total: string;
    confidence: number;
}

const EMPTY_ROW = (id?: string): OrderRow => ({
    id: id || crypto.randomUUID(),
    customer_name: "",
    phone: "",
    instagram: "",
    date: new Date().toISOString().split("T")[0],
    service_description: "",
    payment_mode: "",
    source: "",
    deposit: "0",
    total: "0",
    confidence: 0,
});

const COLUMNS: { key: keyof OrderRow; label: string; width: string; type?: string; options?: string[] }[] = [
    { key: "customer_name", label: "Customer Name", width: "180px" },
    { key: "phone", label: "Phone", width: "150px" },
    { key: "instagram", label: "Instagram", width: "130px" },
    { key: "date", label: "Date", width: "140px", type: "date" },
    { key: "service_description", label: "Service Type", width: "180px" },
    { key: "payment_mode", label: "Payment", width: "110px", type: "select", options: ["", "cash", "upi", "card", "other"] },
    { key: "source", label: "Source", width: "120px", type: "select", options: ["", "instagram", "walk-in", "referral", "google", "other"] },
    { key: "deposit", label: "Deposit ₹", width: "100px", type: "number" },
    { key: "total", label: "Total ₹", width: "100px", type: "number" },
];

function NewOrderContent() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tab, setTab] = useState<"manual" | "ocr">("manual");
    const [artists, setArtists] = useState<Artist[]>([]);
    const [loading, setLoading] = useState(false);

    // Manual form state
    const [manualForm, setManualForm] = useState({
        customer_name: "", phone: "", instagram: "", artist_id: "",
        order_date: new Date().toISOString().split("T")[0],
        service_description: "", payment_mode: "cash", deposit: "",
        total: "", comments: "", source: "",
    });
    const [step, setStep] = useState<"form" | "success">("form");

    // OCR state
    const [ocrFile, setOcrFile] = useState<File | null>(null);
    const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
    const [ocrRows, setOcrRows] = useState<OrderRow[]>([]);
    const [ocrStep, setOcrStep] = useState<"upload" | "review" | "success">("upload");
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [saveResult, setSaveResult] = useState<{ saved: number; failed: number } | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [isRestored, setIsRestored] = useState(false);

    useEffect(() => {
        const saved = sessionStorage.getItem("psy_new_order_state");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.tab) setTab(parsed.tab);
                if (parsed.manualForm) setManualForm(parsed.manualForm);
                if (parsed.step) setStep(parsed.step);
                if (parsed.ocrRows) setOcrRows(parsed.ocrRows);
                if (parsed.ocrResult) setOcrResult(parsed.ocrResult);
                if (parsed.ocrStep) setOcrStep(parsed.ocrStep);
                if (parsed.selectedRows) setSelectedRows(new Set(parsed.selectedRows));
            } catch (err) {
                console.error("Failed to restore state", err);
            }
        }
        setIsRestored(true);
    }, []);

    useEffect(() => {
        if (!isRestored) return;
        const stateToSave = {
            tab,
            manualForm,
            step,
            ocrRows,
            ocrResult,
            ocrStep,
            selectedRows: Array.from(selectedRows)
        };
        sessionStorage.setItem("psy_new_order_state", JSON.stringify(stateToSave));
    }, [isRestored, tab, manualForm, step, ocrRows, ocrResult, ocrStep, selectedRows]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push("/login");
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            api.getArtists().then((r) => setArtists(r.artists)).catch(console.error);
        }
    }, [isAuthenticated]);

    // Generate preview URL when file changes
    useEffect(() => {
        if (ocrFile) {
            const url = URL.createObjectURL(ocrFile);
            setOcrPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setOcrPreviewUrl(null);
        }
    }, [ocrFile]);

    // ━━━ Manual Order ━━━
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const custRes = await api.createCustomer({
                name: manualForm.customer_name,
                phone: manualForm.phone || null,
                instagram: manualForm.instagram || null,
                source: manualForm.source || null,
            });
            const custId = custRes.customer?.id;
            if (!custId) throw new Error("Failed to create customer");
            await api.createOrder({
                customer_id: custId,
                artist_id: manualForm.artist_id || null,
                order_date: manualForm.order_date,
                service_description: manualForm.service_description,
                payment_mode: manualForm.payment_mode,
                deposit: parseFloat(manualForm.deposit) || 0,
                total: parseFloat(manualForm.total) || 0,
                comments: manualForm.comments,
                source: manualForm.source,
            });
            setStep("success");
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // ━━━ OCR ━━━
    const handleFileSelect = (file: File) => {
        setOcrFile(file);
        setOcrError(null);
    };

    const handleOCRUpload = async () => {
        if (!ocrFile) return;
        setOcrLoading(true);
        setOcrError(null);
        try {
            const result = await api.ocrExtract(ocrFile);
            setOcrResult(result);
            if (result.success && result.orders && result.orders.length > 0) {
                const rows: OrderRow[] = result.orders.map((order) => {
                    const f = order.fields as Record<string, unknown>;
                    return {
                        id: crypto.randomUUID(),
                        customer_name: f.customer_name ? String(f.customer_name) : "",
                        phone: f.phone ? String(f.phone) : "",
                        instagram: f.instagram ? String(f.instagram) : "",
                        date: f.date ? String(f.date) : new Date().toISOString().split("T")[0],
                        service_description: f.service_description ? String(f.service_description) : "",
                        payment_mode: f.payment_mode ? String(f.payment_mode).toLowerCase() : "",
                        source: f.source ? String(f.source).toLowerCase() : "",
                        deposit: f.deposit !== null && f.deposit !== undefined ? String(f.deposit) : "0",
                        total: f.total !== null && f.total !== undefined ? String(f.total) : "0",
                        confidence: order.confidence || 0,
                    };
                });
                setOcrRows(rows);
                setSelectedRows(new Set(rows.map((r) => r.id)));
                setOcrStep("review");
            } else {
                setOcrError(result.error || "No orders found in the image. Try a clearer image.");
            }
        } catch (err) {
            console.error(err);
            setOcrError("OCR extraction failed. Please try again.");
        } finally {
            setOcrLoading(false);
        }
    };

    const updateRow = (rowId: string, key: keyof OrderRow, value: string) => {
        setOcrRows((prev) =>
            prev.map((r) => {
                if (r.id !== rowId) return r;
                const updated = { ...r, [key]: value };
                // Auto-sync: if deposit changes and exceeds total, bump total
                if (key === "deposit") {
                    const dep = parseFloat(value) || 0;
                    const tot = parseFloat(r.total) || 0;
                    if (dep > tot) updated.total = value;
                }
                return updated;
            })
        );
    };

    const deleteRow = (rowId: string) => {
        setOcrRows((prev) => prev.filter((r) => r.id !== rowId));
        setSelectedRows((prev) => {
            const next = new Set(prev);
            next.delete(rowId);
            return next;
        });
    };

    const addRow = () => {
        const newRow = EMPTY_ROW();
        setOcrRows((prev) => [...prev, newRow]);
        setSelectedRows((prev) => new Set(prev).add(newRow.id));
    };

    const toggleRow = (rowId: string) => {
        setSelectedRows((prev) => {
            const next = new Set(prev);
            if (next.has(rowId)) next.delete(rowId);
            else next.add(rowId);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedRows.size === ocrRows.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(ocrRows.map((r) => r.id)));
        }
    };

    const handleBulkSave = async () => {
        if (!ocrResult?.session_id || selectedRows.size === 0) return;
        setOcrLoading(true);
        setOcrError(null);
        try {
            const rowsToSave = ocrRows.filter((r) => selectedRows.has(r.id));
            const result = await api.ocrBulkConfirm({
                session_id: ocrResult.session_id,
                orders: rowsToSave.map((row) => ({
                    fields: {
                        customer_name: row.customer_name,
                        phone: row.phone || null,
                        instagram: row.instagram || null,
                        date: row.date,
                        service_description: row.service_description || null,
                        payment_mode: row.payment_mode || null,
                        deposit: parseFloat(row.deposit) || 0,
                        total: parseFloat(row.total) || 0,
                        source: row.source || null,
                    },
                    create_new_customer: true,
                    customer_data: {
                        name: row.customer_name || "Unknown",
                        phone: row.phone || null,
                        instagram: row.instagram || null,
                        source: row.source || null,
                    },
                })),
            });
            setSaveResult({ saved: result.saved, failed: result.failed });
            setOcrStep("success");
        } catch (err) {
            console.error(err);
            setOcrError("Failed to save orders. Please try again.");
        } finally {
            setOcrLoading(false);
        }
    };

    const resetOCR = () => {
        setOcrStep("upload");
        setOcrFile(null);
        setOcrPreviewUrl(null);
        setOcrResult(null);
        setOcrRows([]);
        setOcrError(null);
        setSelectedRows(new Set());
        setSaveResult(null);
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
            <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
                <div className={tab === "ocr" && ocrStep === "review" ? "max-w-[100%]" : "max-w-3xl mx-auto"}>
                    <h1 className="text-3xl font-bold mb-2">New Order</h1>
                    <p className="text-[var(--muted)] mb-8">Create orders manually or scan a handwritten note with AI</p>

                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-8">
                        {[
                            { key: "manual", label: "Manual Entry", icon: FileText },
                            { key: "ocr", label: "OCR Scan", icon: ScanLine },
                        ].map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => { setTab(key as "manual" | "ocr"); setStep("form"); resetOCR(); }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${tab === key
                                    ? "bg-[var(--primary-muted)] text-[var(--primary)] border border-[var(--primary)]/20"
                                    : "bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* ━━━ MANUAL TAB ━━━ */}
                    {tab === "manual" && (
                        <>
                            {step === "form" && (
                                <form onSubmit={handleManualSubmit} className="neo-card p-6 space-y-6 animate-fadeIn">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm text-[var(--muted)] mb-1">Customer Name *</label>
                                            <input required value={manualForm.customer_name} onChange={(e) => setManualForm({ ...manualForm, customer_name: e.target.value })} className="w-full px-4 py-3 neo-input text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Phone</label>
                                            <input value={manualForm.phone} onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })} className="w-full px-4 py-3 neo-input text-sm" placeholder="+91..." />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Instagram</label>
                                            <input value={manualForm.instagram} onChange={(e) => setManualForm({ ...manualForm, instagram: e.target.value })} className="w-full px-4 py-3 neo-input text-sm" placeholder="@handle" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Artist</label>
                                            <select value={manualForm.artist_id} onChange={(e) => setManualForm({ ...manualForm, artist_id: e.target.value })} className="w-full px-4 py-3 neo-input text-sm">
                                                <option value="">Select artist</option>
                                                {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Date</label>
                                            <input type="date" value={manualForm.order_date} onChange={(e) => setManualForm({ ...manualForm, order_date: e.target.value })} className="w-full px-4 py-3 neo-input text-sm" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm text-[var(--muted)] mb-1">Service / Product</label>
                                            <input value={manualForm.service_description} onChange={(e) => setManualForm({ ...manualForm, service_description: e.target.value })} className="w-full px-4 py-3 neo-input text-sm" placeholder="e.g. Full sleeve tattoo" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Payment Mode</label>
                                            <select value={manualForm.payment_mode} onChange={(e) => setManualForm({ ...manualForm, payment_mode: e.target.value })} className="w-full px-4 py-3 neo-input text-sm">
                                                <option value="cash">Cash</option>
                                                <option value="UPI">UPI</option>
                                                <option value="card">Card</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Source</label>
                                            <select value={manualForm.source} onChange={(e) => setManualForm({ ...manualForm, source: e.target.value })} className="w-full px-4 py-3 neo-input text-sm">
                                                <option value="">Select source</option>
                                                <option value="instagram">Instagram</option>
                                                <option value="walk-in">Walk-in</option>
                                                <option value="referral">Referral</option>
                                                <option value="google">Google</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Deposit (₹)</label>
                                            <input type="number" value={manualForm.deposit} onChange={(e) => setManualForm({ ...manualForm, deposit: e.target.value })} className="w-full px-4 py-3 neo-input text-sm" placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Total (₹)</label>
                                            <input type="number" value={manualForm.total} onChange={(e) => setManualForm({ ...manualForm, total: e.target.value })} className="w-full px-4 py-3 neo-input text-sm" placeholder="0" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm text-[var(--muted)] mb-1">Comments</label>
                                            <textarea value={manualForm.comments} onChange={(e) => setManualForm({ ...manualForm, comments: e.target.value })} className="w-full px-4 py-3 neo-input text-sm resize-none" rows={2} />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-3 neo-btn neo-btn-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all border-none!">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Create Order</>}
                                    </button>
                                </form>
                            )}
                            {step === "success" && (
                                <div className="neo-card p-8 text-center animate-fadeIn">
                                    <CheckCircle2 className="w-16 h-16 text-[var(--success)] mx-auto mb-4" />
                                    <h2 className="text-xl font-bold mb-2">Order Created!</h2>
                                    <p className="text-[var(--muted)] mb-6">The order has been saved successfully.</p>
                                    <div className="flex gap-3 justify-center">
                                        <button onClick={() => router.push("/")} className="px-6 py-3 neo-btn text-sm">Go to Dashboard</button>
                                        <button onClick={() => { setStep("form"); setManualForm({ customer_name: "", phone: "", instagram: "", artist_id: "", order_date: new Date().toISOString().split("T")[0], service_description: "", payment_mode: "cash", deposit: "", total: "", comments: "", source: "" }); }} className="px-6 py-3 neo-btn neo-btn-primary text-sm border-none!">New Order</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ━━━ OCR TAB ━━━ */}
                    {tab === "ocr" && (
                        <>
                            {/* Step 1: Upload */}
                            {ocrStep === "upload" && (
                                <div className="glass-panel p-6 animate-fadeIn">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                                            <ScanLine className="w-5 h-5 text-[var(--primary)]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold">AI-Powered Order Scan</h3>
                                            <p className="text-sm text-[var(--muted)]">Upload a register page, receipt, or note — AI extracts all orders into a spreadsheet.</p>
                                        </div>
                                    </div>

                                    {/* Camera + File picker buttons */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <button
                                            type="button"
                                            onClick={() => cameraInputRef.current?.click()}
                                            className="py-3 px-4 neo-btn text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--primary)]/30 transition-all"
                                        >
                                            <Camera className="w-5 h-5 text-[var(--primary)]" />
                                            <span>Take Photo</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="py-3 px-4 neo-btn text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--primary)]/30 transition-all"
                                        >
                                            <ImageIcon className="w-5 h-5 text-[var(--accent)]" />
                                            <span>Choose File</span>
                                        </button>
                                    </div>

                                    {/* Hidden file inputs */}
                                    <input
                                        ref={cameraInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleFileSelect(f);
                                        }}
                                    />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleFileSelect(f);
                                        }}
                                    />

                                    {/* Drag & drop zone */}
                                    <div
                                        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${isDragging
                                            ? "border-[var(--primary)] bg-[var(--primary-muted)]"
                                            : ocrFile
                                                ? "border-[var(--success)]/50 bg-[var(--success)]/5"
                                                : "border-[var(--border-color)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
                                            }`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setIsDragging(false);
                                            const f = e.dataTransfer.files[0];
                                            if (f && f.type.startsWith("image/")) handleFileSelect(f);
                                        }}
                                    >
                                        {ocrFile && ocrPreviewUrl ? (
                                            <div className="space-y-4">
                                                <div className="relative inline-block">
                                                    <img
                                                        src={ocrPreviewUrl}
                                                        alt="Preview"
                                                        className="max-h-64 mx-auto rounded-lg border border-[var(--border-color)] shadow-lg"
                                                    />
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOcrFile(null);
                                                            setOcrPreviewUrl(null);
                                                        }}
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--danger)] rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                                    >
                                                        <X className="w-3 h-3 text-white" />
                                                    </button>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-[var(--success)]">{ocrFile.name}</p>
                                                    <p className="text-xs text-[var(--muted)]">{(ocrFile.size / 1024).toFixed(1)} KB · Click to change</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 flex items-center justify-center">
                                                    <Upload className="w-8 h-8 text-[var(--muted)]" />
                                                </div>
                                                <p className="text-lg font-medium mb-1">Or drag & drop your image here</p>
                                                <p className="text-sm text-[var(--muted)]">Supports register pages with multiple entries · JPG, PNG, HEIC</p>
                                            </>
                                        )}
                                    </div>

                                    {ocrError && (
                                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                            <span className="text-sm text-red-400">{ocrError}</span>
                                        </div>
                                    )}

                                    {ocrFile && (
                                        <button
                                            onClick={handleOCRUpload}
                                            disabled={ocrLoading}
                                            className="w-full mt-5 py-3.5 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                                        >
                                            {ocrLoading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Extracting orders with Gemini AI...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-5 h-5" />
                                                    <span>Extract All Orders</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Step 2: Spreadsheet Review */}
                            {ocrStep === "review" && ocrResult && (
                                <div className="animate-fadeIn space-y-4">
                                    {/* Header bar */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold">
                                                    {ocrRows.length} Order{ocrRows.length !== 1 ? "s" : ""} Extracted
                                                </h3>
                                                <p className="text-sm text-[var(--muted)]">
                                                    Edit cells directly · Select rows to save · Add or remove rows
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Image preview toggle */}
                                            {ocrPreviewUrl && (
                                                <div className="group relative">
                                                    <button className="p-2.5 bg-[var(--surface)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
                                                        <ImageIcon className="w-4 h-4 text-[var(--muted)]" />
                                                    </button>
                                                    <div className="hidden group-hover:block absolute right-0 top-full mt-2 z-50 p-2 glass-panel shadow-2xl">
                                                        <img
                                                            src={ocrPreviewUrl}
                                                            alt="Source"
                                                            className="max-h-80 max-w-sm rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                onClick={resetOCR}
                                                className="px-4 py-2.5 bg-[var(--surface)] text-[var(--muted)] rounded-lg text-sm hover:bg-[var(--surface-hover)] transition-colors border border-[var(--border-color)]"
                                            >
                                                Re-upload
                                            </button>
                                            <button
                                                onClick={handleBulkSave}
                                                disabled={ocrLoading || selectedRows.size === 0}
                                                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                                            >
                                                {ocrLoading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Save {selectedRows.size} Order{selectedRows.size !== 1 ? "s" : ""}
                                            </button>
                                        </div>
                                    </div>

                                    {ocrError && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                            <span className="text-sm text-red-400">{ocrError}</span>
                                        </div>
                                    )}

                                    {/* ━━━ SPREADSHEET TABLE ━━━ */}
                                    <div className="glass-panel overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full" style={{ minWidth: "1400px" }}>
                                                <thead>
                                                    <tr className="bg-[var(--surface)]">
                                                        {/* Checkbox column */}
                                                        <th className="px-3 py-3 border-b border-r border-[var(--border-color)] w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRows.size === ocrRows.length && ocrRows.length > 0}
                                                                onChange={toggleAll}
                                                                className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                                                            />
                                                        </th>
                                                        {/* Row number */}
                                                        <th className="px-3 py-3 border-b border-r border-[var(--border-color)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wider text-center w-10">
                                                            #
                                                        </th>
                                                        {/* Data columns */}
                                                        {COLUMNS.map((col) => (
                                                            <th
                                                                key={col.key}
                                                                className="px-1 py-3 border-b border-r border-[var(--border-color)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wider text-left"
                                                                style={{ minWidth: col.width }}
                                                            >
                                                                {col.label}
                                                            </th>
                                                        ))}
                                                        {/* Confidence column */}
                                                        <th className="px-3 py-3 border-b border-r border-[var(--border-color)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wider text-center w-16">
                                                            Conf.
                                                        </th>
                                                        {/* Actions */}
                                                        <th className="px-3 py-3 border-b border-[var(--border-color)] w-10" />
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ocrRows.map((row, idx) => (
                                                        <tr
                                                            key={row.id}
                                                            className={`transition-colors ${selectedRows.has(row.id)
                                                                ? "bg-[var(--primary-muted)]/30"
                                                                : "bg-transparent hover:bg-[var(--surface-hover)]"
                                                                }`}
                                                        >
                                                            {/* Checkbox */}
                                                            <td className="px-3 py-1 border-b border-r border-[var(--border-color)]">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedRows.has(row.id)}
                                                                    onChange={() => toggleRow(row.id)}
                                                                    className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                                                                />
                                                            </td>
                                                            {/* Row number */}
                                                            <td className="px-3 py-1 border-b border-r border-[var(--border-color)] text-center text-xs text-[var(--muted)] font-mono">
                                                                {idx + 1}
                                                            </td>
                                                            {/* Data cells */}
                                                            {COLUMNS.map((col) => (
                                                                <td
                                                                    key={col.key}
                                                                    className="px-0.5 py-0.5 border-b border-r border-[var(--border-color)]"
                                                                >
                                                                    {col.type === "select" ? (
                                                                        <select
                                                                            value={row[col.key] as string}
                                                                            onChange={(e) => updateRow(row.id, col.key, e.target.value)}
                                                                            className="w-full px-2 py-1.5 bg-transparent border-0 text-sm focus:bg-[var(--background)] focus:outline-[var(--primary)] rounded cursor-pointer"
                                                                        >
                                                                            {col.options?.map((opt) => (
                                                                                <option key={opt} value={opt}>
                                                                                    {opt || "—"}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        <input
                                                                            type={col.type || "text"}
                                                                            value={row[col.key] as string}
                                                                            onChange={(e) => updateRow(row.id, col.key, e.target.value)}
                                                                            className={`w-full px-2 py-1.5 bg-transparent border-0 text-sm focus:bg-[var(--background)] focus:outline-[var(--primary)] rounded ${!row[col.key] && col.key === "customer_name"
                                                                                ? "text-amber-400 placeholder-amber-400/60"
                                                                                : ""
                                                                                }`}
                                                                            placeholder={col.key === "customer_name" ? "Required" : ""}
                                                                        />
                                                                    )}
                                                                </td>
                                                            ))}
                                                            {/* Confidence */}
                                                            <td className="px-2 py-1 border-b border-r border-[var(--border-color)] text-center">
                                                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getConfidenceColor(row.confidence)}`}>
                                                                    {row.confidence}%
                                                                </span>
                                                            </td>
                                                            {/* Delete */}
                                                            <td className="px-2 py-1 border-b border-[var(--border-color)] text-center">
                                                                <button
                                                                    onClick={() => deleteRow(row.id)}
                                                                    className="p-1 rounded hover:bg-red-500/10 text-[var(--muted)] hover:text-red-400 transition-colors"
                                                                    title="Remove row"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Add row button */}
                                        <div className="border-t border-[var(--border-color)] px-4 py-2">
                                            <button
                                                onClick={addRow}
                                                className="flex items-center gap-2 text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors py-1"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Row
                                            </button>
                                        </div>
                                    </div>

                                    {/* Summary bar */}
                                    <div className="glass-panel p-4 flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-6 text-[var(--muted)]">
                                            <span>{ocrRows.length} row{ocrRows.length !== 1 ? "s" : ""}</span>
                                            <span>{selectedRows.size} selected</span>
                                            <span>
                                                Total: ₹{ocrRows.filter((r) => selectedRows.has(r.id)).reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0).toLocaleString("en-IN")}
                                            </span>
                                            <span>
                                                Deposits: ₹{ocrRows.filter((r) => selectedRows.has(r.id)).reduce((sum, r) => sum + (parseFloat(r.deposit) || 0), 0).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Success */}
                            {ocrStep === "success" && (
                                <div className="glass-panel p-8 text-center animate-fadeIn max-w-xl mx-auto">
                                    <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[var(--success)]/10 flex items-center justify-center">
                                        <CheckCircle2 className="w-10 h-10 text-[var(--success)]" />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2">Orders Saved!</h2>
                                    <p className="text-[var(--muted)] mb-2">
                                        {saveResult
                                            ? `${saveResult.saved} order${saveResult.saved !== 1 ? "s" : ""} saved successfully${saveResult.failed > 0 ? `, ${saveResult.failed} failed` : ""}.`
                                            : "All orders have been saved."}
                                    </p>
                                    <p className="text-sm text-[var(--muted)] mb-8">The customers and orders are now visible in the dashboard.</p>
                                    <div className="flex gap-3 justify-center">
                                        <button
                                            onClick={() => router.push("/")}
                                            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/20"
                                        >
                                            Go to Dashboard
                                        </button>
                                        <button
                                            onClick={resetOCR}
                                            className="px-6 py-2.5 bg-[var(--surface-hover)] rounded-lg text-sm font-medium hover:bg-[var(--border-color)] transition-colors"
                                        >
                                            Scan Another
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function NewOrderPage() {
    return <NewOrderContent />;
}
