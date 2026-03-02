"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { formatCurrency, formatRelativeDate, getSourceColor } from "@/lib/utils";
import type { Customer, Artist } from "@/types";
import {
  Search,
  Users,
  TrendingUp,
  Calendar,
  Filter,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";

function DashboardContent() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custRes, artistRes] = await Promise.all([
        api.getCustomers({ search, source: sourceFilter }),
        api.getArtists(),
      ]);
      setCustomers(custRes.customers);
      setArtists(artistRes.artists);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [search, sourceFilter]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  // Calculate overview metrics
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.lifetime_spend || 0), 0);
  const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-[var(--muted)] mt-1">
            Manage your studio customers and track performance
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-[var(--muted)]">Total Customers</span>
            </div>
            <p className="text-3xl font-bold">{totalCustomers}</p>
          </div>

          <div className="glass-card p-6 animate-fadeIn" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-sm text-[var(--muted)]">Total Revenue</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p>
          </div>

          <div className="glass-card p-6 animate-fadeIn" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-[var(--muted)]">Avg. Spend per Customer</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(avgSpend)}</p>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
              <input
                id="customer-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or Instagram..."
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--foreground)] placeholder-[var(--muted)]"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors ${showFilters
                ? "bg-[var(--primary-muted)] text-[var(--primary)]"
                : "bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--border-color)] grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 block">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--foreground)]"
                >
                  <option value="">All Sources</option>
                  <option value="instagram">Instagram</option>
                  <option value="walk-in">Walk-in</option>
                  <option value="referral">Referral</option>
                  <option value="google">Google</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setSourceFilter(""); setSearch(""); setShowFilters(false); }}
                  className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--danger)]"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Customer Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-20 text-[var(--muted)]">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-4">
                      Customer
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-4">
                      Contact
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-4">
                      Lifetime Spend
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-4">
                      Last Visit
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-4">
                      Last Artist
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider px-6 py-4">
                      Source
                    </th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, idx) => (
                    <tr
                      key={customer.id}
                      onClick={() => router.push(`/customers/${customer.id}`)}
                      className="border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors animate-fadeIn"
                      style={{ animationDelay: `${idx * 0.03}s` }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-[var(--border-color)] flex items-center justify-center text-sm font-medium text-[var(--primary)]">
                            {customer.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{customer.name}</p>
                            <p className="text-xs text-[var(--muted)]">
                              {customer.visit_count || 0} visit{(customer.visit_count || 0) !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{customer.phone || "—"}</p>
                        {customer.instagram && (
                          <p className="text-xs text-pink-400">@{customer.instagram}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-emerald-400">
                          {formatCurrency(customer.lifetime_spend || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[var(--muted)]">
                          {formatRelativeDate(customer.last_visit_date)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm">{customer.last_artist_name || "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        {customer.source && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSourceColor(customer.source)}`}>
                            {customer.source}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return <DashboardContent />;
}
