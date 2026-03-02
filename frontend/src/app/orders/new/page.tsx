"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { formatCurrency, getConfidenceColor } from "@/lib/utils";
import type { Artist, Customer, OCRResult } from "@/types";
import {
    Upload,
    FileText,
    Camera,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ArrowRight,
    Users,
    UserPlus,
    Link,
} from "lucide-react";

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
    const [dupCheck, setDupCheck] = useState<{ matches: Customer[]; match_type: string } | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [step, setStep] = useState<"form" | "duplicate" | "success">("form");

    // OCR state
    const [ocrFile, setOcrFile] = useState<File | null>(null);
    const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
    const [ocrFields, setOcrFields] = useState<Record<string, string>>({});
    const [ocrStep, setOcrStep] = useState<"upload" | "review" | "match" | "success">("upload");
    const [ocrLoading, setOcrLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push("/login");
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            api.getArtists().then((r) => setArtists(r.artists)).catch(console.error);
        }
    }, [isAuthenticated]);

    // ━━━ Manual Order ━━━
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Check duplicate
            const dup = await api.checkDuplicate(manualForm.phone, manualForm.instagram);
            if (dup.matches.length > 0) {
                setDupCheck(dup);
                setStep("duplicate");
                setLoading(false);
                return;
            }
            await createOrderWithNewCustomer();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createOrderWithNewCustomer = async () => {
        setLoading(true);
        try {
            const custRes = await api.createCustomer({
                name: manualForm.customer_name,
                phone: manualForm.phone,
                instagram: manualForm.instagram,
                source: manualForm.source,
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

    const linkToExisting = async (customerId: string) => {
        setLoading(true);
        try {
            await api.createOrder({
                customer_id: customerId,
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
    const handleOCRUpload = async () => {
        if (!ocrFile) return;
        setOcrLoading(true);
        try {
            const result = await api.ocrExtract(ocrFile);
            setOcrResult(result);
            if (result.success && result.fields) {
                const fields: Record<string, string> = {};
                for (const [k, v] of Object.entries(result.fields)) {
                    fields[k] = v !== null ? String(v) : "";
                }
                setOcrFields(fields);
                setOcrStep("review");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setOcrLoading(false);
        }
    };

    const handleOCRConfirm = async () => {
        if (!ocrResult?.session_id) return;
        setOcrLoading(true);
        try {
            // Check for duplicates
            const phone = ocrFields.phone || "";
            const instagram = ocrFields.instagram || "";
            if (phone || instagram) {
                const dup = await api.checkDuplicate(phone, instagram);
                if (dup.matches.length > 0) {
                    setDupCheck(dup);
                    setOcrStep("match");
                    setOcrLoading(false);
                    return;
                }
            }
            // Create new customer + order
            await api.ocrConfirm({
                session_id: ocrResult.session_id,
                fields: ocrFields,
                create_new_customer: true,
                customer_data: {
                    name: ocrFields.customer_name || "Unknown",
                    phone: ocrFields.phone,
                    instagram: ocrFields.instagram,
                    source: ocrFields.source,
                },
            });
            setOcrStep("success");
        } catch (err) {
            console.error(err);
        } finally {
            setOcrLoading(false);
        }
    };

    const handleOCRLinkExisting = async (customerId: string) => {
        if (!ocrResult?.session_id) return;
        setOcrLoading(true);
        try {
            await api.ocrConfirm({
                session_id: ocrResult.session_id,
                fields: ocrFields,
                customer_id: customerId,
            });
            setOcrStep("success");
        } catch (err) {
            console.error(err);
        } finally {
            setOcrLoading(false);
        }
    };

    const handleOCRCreateNew = async () => {
        if (!ocrResult?.session_id) return;
        setOcrLoading(true);
        try {
            await api.ocrConfirm({
                session_id: ocrResult.session_id,
                fields: ocrFields,
                create_new_customer: true,
                customer_data: {
                    name: ocrFields.customer_name || "Unknown",
                    phone: ocrFields.phone,
                    instagram: ocrFields.instagram,
                    source: ocrFields.source,
                },
            });
            setOcrStep("success");
        } catch (err) {
            console.error(err);
        } finally {
            setOcrLoading(false);
        }
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
            <main className="flex-1 ml-64 p-8">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-3xl font-bold mb-2">New Order</h1>
                    <p className="text-[var(--muted)] mb-8">Create a new order manually or upload a form image</p>

                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-8">
                        {[
                            { key: "manual", label: "Manual Entry", icon: FileText },
                            { key: "ocr", label: "OCR Upload", icon: Camera },
                        ].map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => { setTab(key as "manual" | "ocr"); setStep("form"); setOcrStep("upload"); }}
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
                                <form onSubmit={handleManualSubmit} className="glass-card p-6 space-y-6 animate-fadeIn">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm text-[var(--muted)] mb-1">Customer Name *</label>
                                            <input required value={manualForm.customer_name} onChange={(e) => setManualForm({ ...manualForm, customer_name: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Phone</label>
                                            <input value={manualForm.phone} onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="+91..." />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Instagram</label>
                                            <input value={manualForm.instagram} onChange={(e) => setManualForm({ ...manualForm, instagram: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="@handle" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Artist</label>
                                            <select value={manualForm.artist_id} onChange={(e) => setManualForm({ ...manualForm, artist_id: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm">
                                                <option value="">Select artist</option>
                                                {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Date</label>
                                            <input type="date" value={manualForm.order_date} onChange={(e) => setManualForm({ ...manualForm, order_date: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm text-[var(--muted)] mb-1">Service / Product</label>
                                            <input value={manualForm.service_description} onChange={(e) => setManualForm({ ...manualForm, service_description: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="e.g. Full sleeve tattoo" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Payment Mode</label>
                                            <select value={manualForm.payment_mode} onChange={(e) => setManualForm({ ...manualForm, payment_mode: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm">
                                                <option value="cash">Cash</option>
                                                <option value="UPI">UPI</option>
                                                <option value="card">Card</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Source</label>
                                            <select value={manualForm.source} onChange={(e) => setManualForm({ ...manualForm, source: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm">
                                                <option value="">Select source</option>
                                                <option value="instagram">Instagram</option>
                                                <option value="walk-in">Walk-in</option>
                                                <option value="referral">Referral</option>
                                                <option value="google">Google</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Deposit (₹)</label>
                                            <input type="number" value={manualForm.deposit} onChange={(e) => setManualForm({ ...manualForm, deposit: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--muted)] mb-1">Total (₹)</label>
                                            <input type="number" value={manualForm.total} onChange={(e) => setManualForm({ ...manualForm, total: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="0" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm text-[var(--muted)] mb-1">Comments</label>
                                            <textarea value={manualForm.comments} onChange={(e) => setManualForm({ ...manualForm, comments: e.target.value })} className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm resize-none" rows={2} />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Create Order</>}
                                    </button>
                                </form>
                            )}

                            {step === "duplicate" && dupCheck && (
                                <div className="glass-card p-6 animate-fadeIn">
                                    <div className="flex items-center gap-3 mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                                        <div>
                                            <p className="font-medium text-amber-400">Potential Duplicate Detected</p>
                                            <p className="text-sm text-[var(--muted)]">Match type: {dupCheck.match_type}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mb-6">
                                        {dupCheck.matches.map((m) => (
                                            <button key={m.id} onClick={() => linkToExisting(m.id)} className="w-full flex items-center justify-between p-4 bg-[var(--surface-hover)] rounded-lg hover:border-[var(--primary)] border border-transparent transition-colors text-left">
                                                <div className="flex items-center gap-3">
                                                    <Link className="w-5 h-5 text-[var(--primary)]" />
                                                    <div>
                                                        <p className="font-medium">{m.name}</p>
                                                        <p className="text-sm text-[var(--muted)]">{m.phone} {m.instagram && `· @${m.instagram}`}</p>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-[var(--primary)]">Link to this customer</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={createOrderWithNewCustomer} disabled={loading} className="w-full py-3 bg-[var(--surface-hover)] text-[var(--foreground)] rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[var(--border-color)] transition-colors">
                                        <UserPlus className="w-5 h-5" /> Create as New Customer
                                    </button>
                                </div>
                            )}

                            {step === "success" && (
                                <div className="glass-card p-8 text-center animate-fadeIn">
                                    <CheckCircle2 className="w-16 h-16 text-[var(--success)] mx-auto mb-4" />
                                    <h2 className="text-xl font-bold mb-2">Order Created!</h2>
                                    <p className="text-[var(--muted)] mb-6">The order has been saved successfully.</p>
                                    <div className="flex gap-3 justify-center">
                                        <button onClick={() => router.push("/")} className="px-6 py-2.5 bg-[var(--surface-hover)] rounded-lg text-sm">Go to Dashboard</button>
                                        <button onClick={() => { setStep("form"); setManualForm({ customer_name: "", phone: "", instagram: "", artist_id: "", order_date: new Date().toISOString().split("T")[0], service_description: "", payment_mode: "cash", deposit: "", total: "", comments: "", source: "" }); }} className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm">New Order</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ━━━ OCR TAB ━━━ */}
                    {tab === "ocr" && (
                        <>
                            {ocrStep === "upload" && (
                                <div className="glass-card p-6 animate-fadeIn">
                                    <div
                                        className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-12 text-center hover:border-[var(--primary)] transition-colors cursor-pointer"
                                        onClick={() => document.getElementById("ocr-file-input")?.click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setOcrFile(f); }}
                                    >
                                        <input id="ocr-file-input" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setOcrFile(f); }} />
                                        <Upload className="w-12 h-12 text-[var(--muted)] mx-auto mb-4" />
                                        <p className="text-lg font-medium mb-1">{ocrFile ? ocrFile.name : "Upload order form image"}</p>
                                        <p className="text-sm text-[var(--muted)]">Drag & drop or click to browse. Supports JPG, PNG.</p>
                                    </div>
                                    {ocrFile && (
                                        <button onClick={handleOCRUpload} disabled={ocrLoading} className="w-full mt-4 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                                            {ocrLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5" /> Extract with AI</>}
                                        </button>
                                    )}
                                </div>
                            )}

                            {ocrStep === "review" && ocrResult && (
                                <div className="glass-card p-6 animate-fadeIn">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-semibold">Extracted Data</h3>
                                        <span className={`text-sm px-3 py-1 rounded-full border ${getConfidenceColor(ocrResult.confidence)}`}>
                                            Confidence: {ocrResult.confidence}%
                                        </span>
                                    </div>
                                    {ocrResult.confidence < 60 && (
                                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-red-400" />
                                            <span className="text-sm text-red-400">Low confidence — please verify all fields carefully.</span>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        {Object.entries(ocrFields).map(([key, value]) => (
                                            <div key={key}>
                                                <label className="block text-xs text-[var(--muted)] mb-1 uppercase">{key.replace(/_/g, " ")}</label>
                                                <input
                                                    value={value}
                                                    onChange={(e) => setOcrFields({ ...ocrFields, [key]: e.target.value })}
                                                    className={`w-full px-3 py-2 bg-[var(--background)] border rounded-lg text-sm ${!value ? "border-amber-500/50" : "border-[var(--border-color)]"
                                                        }`}
                                                    placeholder={!value ? "MISSING" : ""}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={handleOCRConfirm} disabled={ocrLoading} className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                                        {ocrLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirm & Save</>}
                                    </button>
                                </div>
                            )}

                            {ocrStep === "match" && dupCheck && (
                                <div className="glass-card p-6 animate-fadeIn">
                                    <div className="flex items-center gap-3 mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                                        <div>
                                            <p className="font-medium text-amber-400">Existing Customer Found</p>
                                            <p className="text-sm text-[var(--muted)]">Match type: {dupCheck.match_type}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mb-6">
                                        {dupCheck.matches.map((m) => (
                                            <button key={m.id} onClick={() => handleOCRLinkExisting(m.id)} className="w-full flex items-center justify-between p-4 bg-[var(--surface-hover)] rounded-lg hover:border-[var(--primary)] border border-transparent transition-colors text-left">
                                                <div className="flex items-center gap-3">
                                                    <Link className="w-5 h-5 text-[var(--primary)]" />
                                                    <div>
                                                        <p className="font-medium">{m.name}</p>
                                                        <p className="text-sm text-[var(--muted)]">{m.phone}</p>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-[var(--primary)]">Link order</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={handleOCRCreateNew} disabled={ocrLoading} className="w-full py-3 bg-[var(--surface-hover)] rounded-lg font-medium flex items-center justify-center gap-2">
                                        <UserPlus className="w-5 h-5" /> Create as New Customer
                                    </button>
                                </div>
                            )}

                            {ocrStep === "success" && (
                                <div className="glass-card p-8 text-center animate-fadeIn">
                                    <CheckCircle2 className="w-16 h-16 text-[var(--success)] mx-auto mb-4" />
                                    <h2 className="text-xl font-bold mb-2">Order Created from OCR!</h2>
                                    <p className="text-[var(--muted)] mb-6">The extracted order has been saved.</p>
                                    <div className="flex gap-3 justify-center">
                                        <button onClick={() => router.push("/")} className="px-6 py-2.5 bg-[var(--surface-hover)] rounded-lg text-sm">Dashboard</button>
                                        <button onClick={() => { setOcrStep("upload"); setOcrFile(null); setOcrResult(null); setOcrFields({}); }} className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm">Upload Another</button>
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
