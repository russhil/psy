import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

export function getSourceColor(source: string | null): string {
    switch (source?.toLowerCase()) {
        case "instagram": return "text-pink-400 bg-pink-400/10";
        case "walk-in": return "text-emerald-400 bg-emerald-400/10";
        case "referral": return "text-amber-400 bg-amber-400/10";
        case "google": return "text-blue-400 bg-blue-400/10";
        default: return "text-gray-400 bg-gray-400/10";
    }
}

export function getPaymentColor(mode: string | null): string {
    switch (mode?.toLowerCase()) {
        case "cash": return "text-green-400";
        case "upi": return "text-purple-400";
        case "card": return "text-blue-400";
        case "bank_transfer": return "text-cyan-400";
        default: return "text-gray-400";
    }
}

export function getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return "text-green-400 bg-green-400/10 border-green-400/30";
    if (confidence >= 60) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    return "text-red-400 bg-red-400/10 border-red-400/30";
}
