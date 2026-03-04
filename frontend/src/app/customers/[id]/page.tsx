"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatRelativeDate, getSourceColor, getPaymentColor } from "@/lib/utils";
import type { Customer, Order } from "@/types";
import {
    ArrowLeft,
    Edit3,
    Save,
    X,
    Phone,
    Instagram,
    Mail,
    Calendar,
    DollarSign,
    User,
    Loader2,
    TrendingUp,
    Hash,
    Palette,
    Trash2,
} from "lucide-react";

function ProfileContent() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const customerId = params.id as string;

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push("/login");
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated && customerId) loadCustomer();
    }, [isAuthenticated, customerId]);

    const loadCustomer = async () => {
        setLoading(true);
        try {
            const data = await api.getCustomer(customerId);
            setCustomer(data);
            setOrders(data.orders || []);
            setEditData({
                name: data.name || "",
                phone: data.phone || "",
                instagram: data.instagram || "",
                email: data.email || "",
                source: data.source || "",
                notes: data.notes || "",
            });
        } catch {
            console.error("Failed to load customer");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateCustomer(customerId, editData);
            await loadCustomer();
            setEditing(false);
        } catch {
            console.error("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${customer?.name}"? This will also delete all their orders and cannot be undone.`)) return;
        try {
            await api.deleteCustomer(customerId);
            router.push("/");
        } catch {
            alert("Failed to delete customer. Please try again.");
        }
    };

    if (authLoading || !isAuthenticated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="min-h-screen flex items-center justify-center text-[var(--muted)]">
                Customer not found
            </div>
        );
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-0 md:ml-[272px] p-4 md:p-8 pt-16 md:pt-8">
                {/* Back button */}
                <button
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Customer Info Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="glass-panel p-6 animate-fadeIn">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-xl font-bold text-white shadow-sm">
                                        {customer.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{customer.name}</h2>
                                        {customer.source && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSourceColor(customer.source)}`}>
                                                {customer.source}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {!editing ? (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setEditing(true)}
                                            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-muted)] transition-colors"
                                            title="Edit"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            className="p-2 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Delete customer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="p-2 rounded-lg text-[var(--success)] hover:bg-[var(--success)]/10 transition-colors"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => setEditing(false)}
                                            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Info fields */}
                            <div className="space-y-4">
                                {[
                                    { icon: Phone, label: "Phone", key: "phone" },
                                    { icon: Instagram, label: "Instagram", key: "instagram" },
                                    { icon: Mail, label: "Email", key: "email" },
                                    { icon: User, label: "Source", key: "source" },
                                ].map(({ icon: Icon, label, key }) => (
                                    <div key={key} className="flex items-start gap-3">
                                        <Icon className="w-4 h-4 text-[var(--muted)] mt-1" />
                                        <div className="flex-1">
                                            <p className="text-xs text-[var(--muted)]">{label}</p>
                                            {editing ? (
                                                <input
                                                    value={editData[key] || ""}
                                                    onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                                                    className="w-full mt-1 px-4 py-3 neo-input text-sm"
                                                />
                                            ) : (
                                                <p className="text-sm">{(customer as unknown as Record<string, unknown>)[key] as string || "—"}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Notes */}
                                <div className="flex items-start gap-3">
                                    <Edit3 className="w-4 h-4 text-[var(--muted)] mt-1" />
                                    <div className="flex-1">
                                        <p className="text-xs text-[var(--muted)]">Notes</p>
                                        {editing ? (
                                            <textarea
                                                value={editData.notes || ""}
                                                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                                                className="w-full mt-1 px-4 py-3 neo-input text-sm resize-none"
                                                rows={3}
                                            />
                                        ) : (
                                            <p className="text-sm">{customer.notes || "No notes"}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Metrics Card */}
                        <div className="glass-panel p-6 animate-fadeIn" style={{ animationDelay: "0.1s" }}>
                            <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">
                                Customer Metrics
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-emerald-400" />
                                        <span className="text-sm text-[var(--muted)]">Lifetime Spend</span>
                                    </div>
                                    <span className="font-bold text-emerald-400">{formatCurrency(customer.lifetime_spend || 0)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Hash className="w-4 h-4 text-purple-400" />
                                        <span className="text-sm text-[var(--muted)]">Total Visits</span>
                                    </div>
                                    <span className="font-bold">{customer.visit_count || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-amber-400" />
                                        <span className="text-sm text-[var(--muted)]">Last Visit</span>
                                    </div>
                                    <span className="text-sm">{formatRelativeDate(customer.last_visit_date)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Palette className="w-4 h-4 text-cyan-400" />
                                        <span className="text-sm text-[var(--muted)]">Last Artist</span>
                                    </div>
                                    <span className="text-sm">{customer.last_artist_name || "—"}</span>
                                </div>
                                {(customer.visit_count ?? 0) > 0 && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm text-[var(--muted)]">Avg. per Visit</span>
                                        </div>
                                        <span className="font-bold text-blue-400">
                                            {formatCurrency((customer.lifetime_spend || 0) / (customer.visit_count || 1))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Order History */}
                    <div className="lg:col-span-2">
                        <div className="glass-panel overflow-hidden animate-fadeIn" style={{ animationDelay: "0.2s" }}>
                            <div className="p-6 border-b border-[var(--border-color)]">
                                <h3 className="text-lg font-semibold">Order History</h3>
                                <p className="text-sm text-[var(--muted)]">{orders.length} orders</p>
                            </div>

                            {orders.length === 0 ? (
                                <div className="text-center py-12 text-[var(--muted)]">
                                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p>No orders yet</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table>
                                        <thead>
                                            <tr className="border-b border-[var(--border-color)]">
                                                <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-3">Date</th>
                                                <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-3">Service</th>
                                                <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-3">Artist</th>
                                                <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-3">Payment</th>
                                                <th className="text-right text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-3">Deposit</th>
                                                <th className="text-right text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-3">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map((order) => (
                                                <tr key={order.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-hover)] transition-colors">
                                                    <td className="px-6 py-3 text-sm">{formatDate(order.order_date)}</td>
                                                    <td className="px-6 py-3 text-sm max-w-[200px] truncate">{order.service_description || "—"}</td>
                                                    <td className="px-6 py-3 text-sm">{order.artists?.name || "—"}</td>
                                                    <td className="px-6 py-3">
                                                        <span className={`text-sm ${getPaymentColor(order.payment_mode)}`}>
                                                            {order.payment_mode || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm text-[var(--muted)]">{formatCurrency(order.deposit)}</td>
                                                    <td className="px-6 py-3 text-right text-sm font-semibold text-emerald-400">{formatCurrency(order.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Comments timeline */}
                        {orders.some(o => o.comments) && (
                            <div className="glass-panel p-6 mt-6 animate-fadeIn" style={{ animationDelay: "0.3s" }}>
                                <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">
                                    Comments History
                                </h3>
                                <div className="space-y-3">
                                    {orders.filter(o => o.comments).map((order) => (
                                        <div key={order.id} className="flex gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[var(--primary)] mt-2 shrink-0" />
                                            <div>
                                                <p className="text-sm">{order.comments}</p>
                                                <p className="text-xs text-[var(--muted)] mt-1">{formatDate(order.order_date)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function CustomerProfilePage() {
    return <ProfileContent />;
}
