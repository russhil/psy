export interface Customer {
    id: string;
    name: string;
    phone: string | null;
    instagram: string | null;
    email: string | null;
    source: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    // Computed metrics
    lifetime_spend?: number;
    visit_count?: number;
    last_visit_date?: string | null;
    last_artist_name?: string | null;
    last_artist_id?: string | null;
    orders?: Order[];
}

export interface Artist {
    id: string;
    name: string;
    is_active: boolean;
    created_at: string;
}

export interface Order {
    id: string;
    customer_id: string;
    artist_id: string | null;
    order_date: string;
    service_description: string | null;
    payment_mode: string | null;
    deposit: number;
    total: number;
    comments: string | null;
    source: string | null;
    created_at: string;
    customers?: { name: string; phone: string };
    artists?: { name: string };
}

export interface Expense {
    id: string;
    expense_date: string;
    amount: number;
    category: string;
    description: string | null;
    vendor: string | null;
    payment_mode: string | null;
    raw_input: string | null;
    created_at: string;
}

export interface Campaign {
    id: string;
    template_name: string;
    nl_filter_text: string | null;
    resolved_query: string | null;
    matched_count: number;
    status: string;
    created_at: string;
}

export interface MessageLog {
    id: string;
    campaign_id: string;
    customer_id: string;
    phone: string;
    template_name: string;
    rendered_payload: Record<string, unknown>;
    status: string;
    error_message: string | null;
    whatsapp_message_id: string | null;
    sent_at: string;
}

export interface WhatsAppTemplate {
    name: string;
    language: string;
    category: string;
    components: Array<{
        type: string;
        text?: string;
        format?: string;
    }>;
}

export interface OCRResult {
    success: boolean;
    session_id?: string;
    fields: Record<string, unknown>;
    confidence: number;
    raw_text?: string;
    error?: string;
    duplicate_check?: {
        matches: Customer[];
        match_type: string;
    };
}

export interface FilterResult {
    success: boolean;
    customers: Customer[];
    count: number;
    filter_conditions?: Array<{
        field: string;
        operator: string;
        value: string;
    }>;
    error?: string;
    suggestion?: string;
    inference_caution?: string | null;
    inferred_fields?: Array<{
        field: string;
        source: string;
        operator?: string;
        value?: string;
    }>;
}

export interface FinancialSummary {
    revenue: number;
    expenses: number;
    profit: number;
    category_breakdown: Record<string, number>;
    order_count: number;
    expense_count: number;
}

export interface ExpenseParseResult {
    success: boolean;
    fields: {
        amount: number;
        category: string;
        description: string;
        vendor: string;
        payment_mode: string;
        date: string;
        raw_input: string;
    };
    error?: string;
}
