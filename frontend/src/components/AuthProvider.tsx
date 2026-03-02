"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { api } from "@/lib/api";

interface AuthContextType {
    isAuthenticated: boolean;
    username: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    username: null,
    login: async () => { },
    logout: () => { },
    loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("psyshot_token");
        if (token) {
            api.me()
                .then((data) => {
                    setIsAuthenticated(true);
                    setUsername(data.username);
                })
                .catch(() => {
                    localStorage.removeItem("psyshot_token");
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (user: string, pass: string) => {
        const data = await api.login(user, pass);
        localStorage.setItem("psyshot_token", data.token);
        setIsAuthenticated(true);
        setUsername(data.username);
    };

    const logout = () => {
        localStorage.removeItem("psyshot_token");
        setIsAuthenticated(false);
        setUsername(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, username, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
