const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("psyshot_token");
}

// Simple in-memory cache for API GET requests (1 minute TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export const clearApiCache = () => cache.clear();

async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const isGet = !options.method || options.method === "GET";
    const cacheKey = path;

    // 1. Check Cache for GET requests
    if (isGet && cache.has(cacheKey)) {
        const cached = cache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return cached.data as T;
        }
    }

    const token = getToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (res.status === 401) {
        if (typeof window !== "undefined") {
            localStorage.removeItem("psyshot_token");
            window.location.href = "/login";
        }
        throw new Error("Unauthorized");
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(error.detail || "API error");
    }

    const data = await res.json();

    // 2. Manage Cache
    if (isGet) {
        // Save successful GET requests to cache
        cache.set(cacheKey, { data, timestamp: Date.now() });
    } else {
        // Invalidate cache on mutations (POST, PUT, DELETE)
        cache.clear();
    }

    return data;
}

// Auth
export const api = {
    login: (username: string, password: string) =>
        apiFetch<{ token: string; username: string }>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        }),

    me: () => apiFetch<{ username: string }>("/api/auth/me"),

    // Customers
    getCustomers: (params?: Record<string, string | number>) => {
        const query = params
            ? "?" + new URLSearchParams(
                Object.entries(params).map(([k, v]) => [k, String(v)])
            ).toString()
            : "";
        return apiFetch<{ customers: import("@/types").Customer[]; count: number }>(
            `/api/customers${query}`
        );
    },

    getCustomer: (id: string) =>
        apiFetch<import("@/types").Customer>(`/api/customers/${id}`),

    createCustomer: (data: Record<string, unknown>) =>
        apiFetch<{ created: boolean; customer?: import("@/types").Customer; duplicate_detected?: boolean; matches?: import("@/types").Customer[]; match_type?: string }>(
            "/api/customers",
            { method: "POST", body: JSON.stringify(data) }
        ),

    updateCustomer: (id: string, data: Record<string, unknown>) =>
        apiFetch<{ updated: boolean; customer: import("@/types").Customer }>(
            `/api/customers/${id}`,
            { method: "PUT", body: JSON.stringify(data) }
        ),

    checkDuplicate: (phone: string, instagram: string) =>
        apiFetch<{ matches: import("@/types").Customer[]; match_type: string }>(
            "/api/customers/check-duplicate",
            { method: "POST", body: JSON.stringify({ phone, instagram }) }
        ),

    deleteCustomer: (id: string) =>
        apiFetch<{ deleted: boolean }>(`/api/customers/${id}`, {
            method: "DELETE",
        }),

    // Orders
    getOrders: (customerID?: string) => {
        const query = customerID ? `?customer_id=${customerID}` : "";
        return apiFetch<{ orders: import("@/types").Order[] }>(`/api/orders${query}`);
    },

    createOrder: (data: Record<string, unknown>) =>
        apiFetch<{ created: boolean; order: import("@/types").Order }>(
            "/api/orders",
            { method: "POST", body: JSON.stringify(data) }
        ),

    // OCR
    ocrExtract: (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return apiFetch<import("@/types").OCRResult>("/api/ocr/extract", {
            method: "POST",
            body: formData,
        });
    },

    ocrConfirm: (data: Record<string, unknown>) =>
        apiFetch<{ success: boolean; order: import("@/types").Order; customer_id: string }>(
            "/api/ocr/confirm",
            { method: "POST", body: JSON.stringify(data) }
        ),

    ocrBulkConfirm: (data: { session_id: string; orders: Array<{ fields: Record<string, unknown>; create_new_customer: boolean; customer_data: Record<string, unknown> | null }> }) =>
        apiFetch<{ success: boolean; total: number; saved: number; failed: number; results: Array<{ success: boolean; order_id?: string; customer_name?: string; error?: string }> }>(
            "/api/ocr/bulk-confirm",
            { method: "POST", body: JSON.stringify(data) }
        ),

    // WhatsApp
    getTemplates: () =>
        apiFetch<{ success: boolean; templates: import("@/types").WhatsAppTemplate[]; error?: string }>(
            "/api/whatsapp/templates"
        ),

    filterCampaign: (filterText: string) =>
        apiFetch<import("@/types").FilterResult>("/api/campaigns/filter", {
            method: "POST",
            body: JSON.stringify({ filter_text: filterText }),
        }),

    sendCampaign: (data: {
        template_name: string;
        customer_ids: string[];
        nl_filter_text?: string;
    }) =>
        apiFetch<{
            success: boolean;
            campaign_id: string;
            total: number;
            sent: number;
            failed: number;
            results: Array<{ customer_name: string; success: boolean; error?: string }>;
        }>("/api/campaigns/send", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    // Expenses
    parseExpense: (text: string) =>
        apiFetch<import("@/types").ExpenseParseResult>("/api/expenses/parse", {
            method: "POST",
            body: JSON.stringify({ text }),
        }),

    confirmExpense: (data: Record<string, unknown>) =>
        apiFetch<{ success: boolean; expense: import("@/types").Expense }>(
            "/api/expenses/confirm",
            { method: "POST", body: JSON.stringify(data) }
        ),

    getExpenses: (params?: Record<string, string>) => {
        const query = params
            ? "?" + new URLSearchParams(params).toString()
            : "";
        return apiFetch<{ expenses: import("@/types").Expense[] }>(
            `/api/expenses${query}`
        );
    },

    // Finance
    getFinanceSummary: (dateFrom?: string, dateTo?: string) => {
        const params = new URLSearchParams();
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
        const query = params.toString() ? `?${params}` : "";
        return apiFetch<import("@/types").FinancialSummary>(
            `/api/finance/summary${query}`
        );
    },

    // Artists
    getArtists: () =>
        apiFetch<{ artists: import("@/types").Artist[] }>("/api/artists"),
};
