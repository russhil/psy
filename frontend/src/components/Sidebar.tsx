"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useState, useEffect } from "react";
import {
    LayoutDashboard,
    Users,
    PlusCircle,
    Send,
    DollarSign,
    LogOut,
    Zap,
    ScanLine,
    Menu,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders/new", label: "New Order", icon: PlusCircle },
    { href: "/campaigns", label: "Campaigns", icon: Send },
    { href: "/finance", label: "Finance", icon: DollarSign },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { logout, username } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [mobileOpen]);

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="fixed top-4 left-4 z-40 w-10 h-10 rounded-xl neo-btn flex items-center justify-center md:hidden"
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5 text-[var(--foreground)]" />
            </button>

            {/* Backdrop for mobile */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar panel */}
            <aside
                className={cn(
                    "fixed top-4 bottom-4 w-[240px] glass-panel flex flex-col z-50 overflow-hidden border-none text-[var(--foreground)] transition-transform duration-300 ease-out",
                    // Desktop: always visible with left-4
                    "md:left-4 md:translate-x-0",
                    // Mobile: slide from left
                    mobileOpen ? "left-4 translate-x-0" : "-translate-x-[calc(100%+2rem)] md:translate-x-0"
                )}
            >
                {/* Logo + Close on mobile */}
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl neo-btn-primary flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-[var(--foreground)]">PsyShot</h1>
                            <p className="text-xs text-[var(--muted)] uppercase tracking-widest font-semibold">Tattoo Studio CRM</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="md:hidden p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive =
                            item.href === "/"
                                ? pathname === "/"
                                : pathname.startsWith(item.href);
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "nav-item flex items-center gap-3 px-4 py-3 text-sm",
                                    isActive
                                        ? "active"
                                        : "font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Action / User section */}
                <div className="p-4 border-t border-[var(--border-color)] flex flex-col gap-4">
                    <Link
                        href="/orders/new"
                        className="w-full neo-btn neo-btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
                    >
                        <PlusCircle className="w-4 h-4" />
                        New Order
                    </Link>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full neo-card flex items-center justify-center text-xs font-bold text-[var(--primary)]">
                                {username?.[0]?.toUpperCase() || "A"}
                            </div>
                            <span className="text-sm font-medium text-[var(--muted)]">{username}</span>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 rounded-xl text-[var(--muted)] neo-btn hover:text-[var(--danger)] transition-all"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
