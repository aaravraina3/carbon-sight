import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { motion, useMotionValue, animate, } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { Menu, ChevronLeft, ChevronRight, X } from "lucide-react";
import NeuralEnergyWeb from "./NeuralEnergyWeb";
import { LogIn, LogOut, MessageSquare, Plus, BarChart3, Leaf, Zap, Send, Trash2, ChartLine, Award, Info } from "lucide-react";
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, BarChart as RBarChart, Bar, } from "recharts";
import CarbonSightLogo from "./CarbonSightLockup";
import { fetchTeamAveragesFromView } from "./api/metrics";
// FX
import WaterBurstFX from "./WaterBurst";
import "./water-burst.css";
/* -------- Error Boundary (so we never get a blank screen) -------- */
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error("[ErrorBoundary]", error, info); }
    render() {
        if (this.state.error) {
            return (_jsx("div", { className: "min-h-screen bg-[#0b1115] text-slate-100 grid place-items-center p-6", children: _jsxs("div", { className: "max-w-xl w-full rounded-2xl border border-white/10 bg-white/5 p-5", children: [_jsx("h1", { className: "text-emerald-400 font-semibold text-lg", children: "Something went wrong" }), _jsx("pre", { className: "mt-3 whitespace-pre-wrap text-sm text-rose-300", children: String(this.state.error?.message || this.state.error) })] }) }));
        }
        return this.props.children;
    }
}
/* ---------------- Supabase (guarded) ---------------- */
const SUPA_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPA_ANON = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const MISSING_ENV = !SUPA_URL || !SUPA_ANON;
console.log("[App] VITE_SUPABASE_URL present:", Boolean(SUPA_URL));
console.log("[App] VITE_SUPABASE_ANON_KEY present:", Boolean(SUPA_ANON));
console.log("[App] SUPA_URL:", SUPA_URL);
console.log("[App] SUPA_ANON:", SUPA_ANON?.substring(0, 20) + "...");
const supabase = !MISSING_ENV
    ? createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
const Auth = createContext(null);
const useAuth = () => {
    const v = useContext(Auth);
    if (!v)
        throw new Error("useAuth must be used inside <AuthProvider>");
    return v;
};
function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    useEffect(() => {
        if (!supabase)
            return;
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
        return () => sub.data.subscription.unsubscribe();
    }, []);
    async function checkEmailExists(email) {
        if (!supabase)
            throw new Error("Supabase env vars are missing. Add .env and restart the dev server.");
        console.log("[Auth] Checking if email exists:", email);
        try {
            // Check in login table for existing user registration
            const { data, error } = await supabase
                .from('login')
                .select('user_email')
                .eq('user_email', email)
                .limit(1);
            if (error) {
                console.log("[Auth] Error checking email existence:", error);
                // If we can't check, assume it's a new user to be safe
                return false;
            }
            const exists = data && data.length > 0;
            console.log("[Auth] Email exists:", exists);
            return exists;
        }
        catch (err) {
            console.log("[Auth] Exception checking email existence:", err);
            return false;
        }
    }
    async function sendOTP(email) {
        if (!supabase)
            throw new Error("Supabase env vars are missing. Add .env and restart the dev server.");
        console.log("[Auth] Sending OTP to:", email);
        const { data, error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: undefined, // Disable magic link redirect
            }
        });
        if (error) {
            console.log("[Auth] OTP send error:", error);
            throw error;
        }
        console.log("[Auth] OTP sent successfully:", data);
    }
    async function verifyOTP(email, token) {
        if (!supabase)
            throw new Error("Supabase env vars are missing. Add .env and restart the dev server.");
        console.log("[Auth] Verifying OTP for:", email);
        const { data, error } = await supabase.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });
        if (error) {
            console.log("[Auth] OTP verification error:", error);
            throw error;
        }
        console.log("[Auth] OTP verified successfully:", data);
        // Check if user exists in our login table (this is the real check we should use)
        const userExists = await checkEmailExists(email);
        console.log("[Auth] User exists in login table:", userExists);
        if (!userExists) {
            // For new users, we need to store them in login table after team selection
            return { isNewUser: true };
        }
        else {
            // For existing users, they're already in our login table
            return { isNewUser: false };
        }
    }
    async function storeUserEmail(email, team) {
        if (!supabase)
            return;
        try {
            // Store user registration in the login table
            const { data, error } = await supabase
                .from('login')
                .insert([{
                    user_email: email,
                    team: team || 'Not specified'
                }]);
            if (error) {
                console.log("[Auth] Error storing user data:", error);
                // Try without team field if that fails
                const { data: data2, error: error2 } = await supabase
                    .from('login')
                    .insert([{
                        user_email: email
                    }]);
                if (error2) {
                    console.log("[Auth] Error storing user data without team:", error2);
                }
                else {
                    console.log("[Auth] User data stored successfully without team:", data2);
                }
            }
            else {
                console.log("[Auth] User data stored successfully:", data);
            }
        }
        catch (err) {
            console.log("[Auth] Exception storing user data:", err);
        }
    }
    async function logout() { if (supabase)
        await supabase.auth.signOut(); }
    const value = useMemo(() => ({ session, user: session?.user ?? null, checkEmailExists, sendOTP, verifyOTP, logout }), [session]);
    return _jsx(Auth.Provider, { value: value, children: children });
}
/* ---------------- UI helpers ---------------- */
function Button(props) {
    const { className, type, ...rest } = props;
    return (_jsx("button", { type: type ?? "button", ...rest, className: `inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 ${className || ""}` }));
}
function PrimaryButton(props) {
    const { className, type, ...rest } = props;
    return (_jsx("button", { type: type ?? "button", ...rest, className: `inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 ${className || ""}` }));
}
function BackdropGlow() {
    return (_jsx("div", { className: "pointer-events-none absolute inset-0 -z-10", children: _jsx("div", { className: "absolute -top-32 left-1/2 h-[520px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-b from-emerald-500/25 via-emerald-500/10 to-transparent blur-3xl" }) }));
}
/* ---------------- Fallback when env missing ---------------- */
function MissingEnv() {
    return (_jsx("div", { className: "min-h-screen grid place-items-center bg-[#0b1115] text-slate-100 p-6", children: _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-6 max-w-lg", children: [_jsx("h1", { className: "text-xl font-semibold text-emerald-400", children: "Supabase not configured" }), _jsxs("p", { className: "mt-3 text-sm", children: ["Create ", _jsx("code", { children: ".env" }), " with ", _jsx("code", { children: "VITE_SUPABASE_URL" }), " and ", _jsx("code", { children: "VITE_SUPABASE_ANON_KEY" }), " and restart the dev server."] })] }) }));
}
/* === Gemini Analysis (from Python script) === */
const GEMINI_MODELS = {
    "gemini-2.5-pro": { "co2_per_token": 0.0025, "latency_ms": 350, "cost_per_1k_tokens": 0.03, "completion_tokens": 250 },
    "gemini-2.5-flash": { "co2_per_token": 0.0018, "latency_ms": 180, "cost_per_1k_tokens": 0.02, "completion_tokens": 180 },
    "gemini-2.5-flash-lite": { "co2_per_token": 0.0010, "latency_ms": 100, "cost_per_1k_tokens": 0.01, "completion_tokens": 120 },
    "gemini-1.5-pro": { "co2_per_token": 0.0030, "latency_ms": 400, "cost_per_1k_tokens": 0.04, "completion_tokens": 300 },
    "gemini-1.5-flash": { "co2_per_token": 0.0020, "latency_ms": 200, "cost_per_1k_tokens": 0.025, "completion_tokens": 200 },
    "gemini-1.5-flash-lite": { "co2_per_token": 0.0012, "latency_ms": 120, "cost_per_1k_tokens": 0.015, "completion_tokens": 150 }
};
function estimateGemini(promptText) {
    const charCount = promptText.length;
    const tokenCount = charCount / 4;
    const results = [];
    for (const [modelName, specs] of Object.entries(GEMINI_MODELS)) {
        const totalTokens = tokenCount + specs.completion_tokens;
        const co2 = totalTokens * specs.co2_per_token;
        const cost = totalTokens / 1000 * specs.cost_per_1k_tokens;
        const latencyMs = specs.latency_ms;
        const tokensPerSec = totalTokens / (latencyMs / 1000);
        results.push({
            model_name: modelName,
            latency: Math.round(tokensPerSec * 100) / 100,
            cost: Math.round(cost * 10000) / 10000,
            gco2_emissions: Math.round(co2 * 10000) / 10000,
            created_at: new Date().toISOString()
        });
    }
    return results;
}
async function insertGeminiToSupabase(promptText, userEmail) {
    if (!supabase)
        return;
    console.log("[Gemini] Starting analysis for user:", userEmail);
    const results = estimateGemini(promptText);
    // First, get user information from the login table
    let userTeam = 'Unknown';
    try {
        console.log("[Gemini] Fetching user info from login table for:", userEmail);
        const { data: loginData, error: loginError } = await supabase
            .from('login')
            .select('user_email, team')
            .eq('user_email', userEmail)
            .single();
        if (loginError) {
            console.log("[Gemini] Error fetching user info from login table:", loginError);
            console.log("[Gemini] LoginError details:", {
                code: loginError.code,
                message: loginError.message,
                details: loginError.details
            });
        }
        else if (loginData) {
            userTeam = loginData.team || 'Unknown';
            console.log("[Gemini] Found user info:", { userEmail, userTeam, loginData });
        }
        else {
            console.log("[Gemini] No data returned from login table for user:", userEmail);
        }
    }
    catch (err) {
        console.log("[Gemini] Exception fetching user info:", err);
    }
    // Now insert metrics into CarbonSight table with user info
    const recordsWithUserInfo = results.map(result => ({
        ...result,
        user_email: userEmail,
        team: userTeam
        // Removed prompt_text since it doesn't exist in your table
    }));
    console.log("[Gemini] Prepared records for insertion:", {
        userEmail,
        userTeam,
        recordCount: recordsWithUserInfo.length,
        firstRecord: recordsWithUserInfo[0]
    });
    try {
        // First, let's check what columns exist in the CarbonSight table
        const { data: tableCheck, error: tableError } = await supabase
            .from('CarbonSight')
            .select('*')
            .limit(1);
        console.log("[Gemini] CarbonSight table structure check:", {
            hasData: !!tableCheck,
            columns: tableCheck?.[0] ? Object.keys(tableCheck[0]) : 'No existing data',
            tableError
        });
        const { data, error } = await supabase
            .from('CarbonSight')
            .insert(recordsWithUserInfo);
        if (error) {
            console.log("[Gemini] Error inserting metrics data:", error);
            console.log("[Gemini] Error details:", {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            console.log("[Gemini] Attempted to insert records:", recordsWithUserInfo);
            // Try with just team field to see if that's the issue
            console.log("[Gemini] Trying with team field only");
            const teamOnlyRecords = results.map(result => ({
                model_name: result.model_name,
                latency: result.latency,
                cost: result.cost,
                gco2_emissions: result.gco2_emissions,
                created_at: result.created_at,
                user_email: userEmail,
                team: userTeam
            }));
            const { data: teamData, error: teamError } = await supabase
                .from('CarbonSight')
                .insert(teamOnlyRecords);
            if (teamError) {
                console.log("[Gemini] Team field also failed:", teamError);
                // Final fallback without team field
                console.log("[Gemini] Final fallback without team field");
                const fallbackRecords = results.map(result => ({
                    model_name: result.model_name,
                    latency: result.latency,
                    cost: result.cost,
                    gco2_emissions: result.gco2_emissions,
                    created_at: result.created_at,
                    user_email: userEmail
                }));
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('CarbonSight')
                    .insert(fallbackRecords);
                if (fallbackError) {
                    console.log("[Gemini] Final fallback also failed:", fallbackError);
                }
                else {
                    console.log("[Gemini] Final fallback succeeded (without team):", fallbackData);
                }
            }
            else {
                console.log("[Gemini] Team insertion succeeded:", teamData);
            }
        }
        else {
            console.log("[Gemini] Metrics data inserted successfully with team:", data);
            console.log("[Gemini] Inserted records included team:", userTeam);
        }
    }
    catch (err) {
        console.log("[Gemini] Exception inserting metrics data:", err);
    }
    return results;
}
const MODELS = [
    { id: "eco-7b", label: "Eco (GreenAI-7B)", energy: "sustainable" },
    { id: "mix-13b", label: "Balanced (Mix-13B)", energy: "balanced" },
    { id: "xl-70b", label: "Performance (XL-70B)", energy: "intensive" },
];
// Add this near HomePage, without re-declaring Energy/Model if you already have them
const WEB_MODELS = [
    // your existing three:
    { id: "gemini-2.5-flash", label: "gemini-2.5-flash (Eco)", energy: "sustainable" },
    { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite (Balanced)", energy: "balanced" },
    { id: "gemini-2.5-pro", label: "gemini-2.5-pro (Intensive)", energy: "intensive" },
    // some extras to make the graph feel “neural”
    { id: "gpt-4o-mini", label: "gpt-4o-mini", energy: "balanced" },
    { id: "llama-3-8b", label: "Llama 3 8B", energy: "sustainable" },
    { id: "mistral-large", label: "Mistral Large", energy: "balanced" },
    { id: "mixtral-8x7b", label: "Mixtral 8x7B", energy: "sustainable" },
    { id: "deepseek-70b", label: "DeepSeek 70B", energy: "intensive" },
    { id: "phi-3-small", label: "Phi-3 Small", energy: "sustainable" },
    { id: "qwen-14b", label: "Qwen 14B", energy: "balanced" },
];
/* ---------------- Screen 1: Homepage + Login ---------------- */
function HomePage() {
    const [open, setOpen] = useState(false);
    // Optional: allow other components to trigger opening the modal
    useEffect(() => {
        const handler = () => setOpen(true);
        window.addEventListener("open-login", handler);
        return () => window.removeEventListener("open-login", handler);
    }, []);
    return (_jsxs("div", { className: "relative min-h-screen bg-[#0b1115] text-slate-100 overflow-hidden", children: [_jsx(BackdropGlow, {}), _jsx(EcoWaveDeco, {}), "  ", _jsxs("header", { className: "relative z-20 mx-auto flex max-w-6xl items-center justify-between px-4 py-4", children: [_jsx("div", { className: "flex items-center", children: _jsx(CarbonSightLogo, { energy: "sustainable", width: 200, height: 36, className: "block" }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Link, { to: "/chat", className: "hidden rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 md:inline", children: "Try Chat (demo)" }), _jsxs(Button, { onClick: () => setOpen(true), children: [_jsx(LogIn, { className: "h-4 w-4" }), " Login"] })] })] }), _jsxs("main", { className: "relative z-20", children: [_jsxs("section", { className: "relative mx-auto max-w-6xl px-4 pt-12 text-center md:pt-20", children: [_jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-0 -z-10", children: _jsx("div", { className: "absolute left-1/2 top-[-80px] h-[520px] w-[980px] -translate-x-1/2 rounded-[50%] bg-emerald-500/15 blur-3xl" }) }), _jsxs(motion.h1, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.05 }, className: "text-5xl font-extrabold tracking-tight md:text-6xl", children: ["Make ", _jsx("span", { className: "bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500 bg-clip-text text-transparent", children: "Every Token" }), " Greener"] }), _jsx(motion.p, { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.1 }, className: "mx-auto mt-4 max-w-2xl text-slate-300/90 md:text-lg", children: "Pick lower-carbon models without sacrificing quality. Track your impact and earn rewards automatically." }), _jsx(motion.div, { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.18 }, className: "mt-8 flex flex-wrap items-center justify-center gap-3", children: _jsxs(PrimaryButton, { onClick: () => setOpen(true), className: "px-5 py-2.5", children: [_jsx(LogIn, { className: "h-4 w-4" }), " Start Optimizing Now"] }) })] }), _jsx("section", { className: "mx-auto mt-14 max-w-6xl px-4", children: _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[220px]", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-sm text-slate-300", children: [_jsx(Leaf, { className: "h-5 w-5 text-emerald-300" }), _jsx("span", { className: "font-medium", children: "Greener by default" })] }), _jsx("p", { className: "text-slate-300/90", children: "Carbon-aware routing picks cleaner regions and efficient models automatically." }), _jsxs("ul", { className: "mt-4 space-y-2 text-sm text-slate-400", children: [_jsx("li", { children: "\u2022 Live grid carbon signal" }), _jsx("li", { children: "\u2022 Auto model/region selection" }), _jsx("li", { children: "\u2022 Per-request opt-out" })] })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[220px]", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-sm text-slate-300", children: [_jsx(Zap, { className: "h-5 w-5 text-emerald-300" }), _jsx("span", { className: "font-medium", children: "Real-time signals" })] }), _jsx("p", { className: "text-slate-300/90", children: "Balance quality, latency, and energy at runtime \u2014 not at deploy time." }), _jsxs("ul", { className: "mt-4 space-y-2 text-sm text-slate-400", children: [_jsx("li", { children: "\u2022 Quality/latency/energy tradeoffs" }), _jsx("li", { children: "\u2022 Smart fallbacks & retries" }), _jsx("li", { children: "\u2022 Burst-aware throttling" })] })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[220px]", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-sm text-slate-300", children: [_jsx(BarChart3, { className: "h-5 w-5 text-emerald-300" }), _jsx("span", { className: "font-medium", children: "Impact you can see" })] }), _jsx("p", { className: "text-slate-300/90", children: "Track energy (Wh), CO\u2082e, and CSI trends across teams and models." }), _jsxs("ul", { className: "mt-4 space-y-2 text-sm text-slate-400", children: [_jsx("li", { children: "\u2022 CSI (Carbon Sensitivity Index)" }), _jsx("li", { children: "\u2022 Team & workspace views" }), _jsx("li", { children: "\u2022 Exportable reports" })] })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[220px]", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-sm text-slate-300", children: [_jsx(Award, { className: "h-5 w-5 text-emerald-300" }), _jsx("span", { className: "font-medium", children: "Rewards that pay back" })] }), _jsx("p", { className: "text-slate-300/90", children: "Earn credits by choosing greener lanes without losing quality." }), _jsxs("ul", { className: "mt-4 space-y-2 text-sm text-slate-400", children: [_jsx("li", { children: "\u2022 Auto credit accrual" }), _jsx("li", { children: "\u2022 Payout history" }), _jsx("li", { children: "\u2022 Per-model incentives" })] })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[220px]", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-sm text-slate-300", children: [_jsx(Zap, { className: "h-5 w-5 text-emerald-300" }), _jsx("span", { className: "font-medium", children: "Drop-in API & SDKs" })] }), _jsx("p", { className: "text-slate-300/90", children: "Keep your stack; CarbonSight plugs into your existing calls." }), _jsxs("ul", { className: "mt-4 space-y-2 text-sm text-slate-400", children: [_jsx("li", { children: "\u2022 HTTP proxy or SDK" }), _jsx("li", { children: "\u2022 Policy & quota controls" }), _jsx("li", { children: "\u2022 Audit-ready logs" })] })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[220px]", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-sm text-slate-300", children: [_jsx(Leaf, { className: "h-5 w-5 text-emerald-300" }), _jsx("span", { className: "font-medium", children: "Guardrails & policies" })] }), _jsx("p", { className: "text-slate-300/90", children: "Define org policies for carbon budgets, models, and data regions." }), _jsxs("ul", { className: "mt-4 space-y-2 text-sm text-slate-400", children: [_jsx("li", { children: "\u2022 Carbon budget thresholds" }), _jsx("li", { children: "\u2022 Allow/deny model lists" }), _jsx("li", { children: "\u2022 Region pinning" })] })] })] }) })] }), open && _jsx(LoginModal, { onClose: () => setOpen(false) }), _jsx("section", { className: "relative mt-14 -mx-4 md:-mx-8 lg:-mx-12", children: _jsxs("div", { className: "mx-auto w-full max-w-[1400px]", children: [_jsx("h3", { className: "mb-2 text-center text-sm font-medium text-slate-300", children: "Model Energy Network" }), _jsxs("p", { className: "mb-6 text-center text-xs text-slate-400", children: ["Hover nodes to see model names. ", _jsx("span", { className: "text-emerald-400", children: "Green" }), " = sustainable,\u00A0", _jsx("span", { className: "text-yellow-300", children: "Amber" }), " = balanced,\u00A0", _jsx("span", { className: "text-rose-400", children: "Red" }), " = intensive."] }), _jsx(NeuralEnergyWeb, { models: WEB_MODELS, height: 640 })] }) }), _jsx("br", {}), _jsx("br", {}), _jsxs("footer", { className: "relative z-20 border-t border-white/10/50 px-4 py-8 text-center text-xs text-slate-500", children: ["\u00A9 ", new Date().getFullYear(), " CarbonSight \u2014 Built for sustainable AI workloads."] })] }));
}
/* ---------------- OTP Login Modal (beautiful) ---------------- */
function LoginModal({ onClose }) {
    const { checkEmailExists, sendOTP, verifyOTP } = useAuth();
    const nav = useNavigate();
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [team, setTeam] = useState("");
    const [step, setStep] = useState('email');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isNewUser, setIsNewUser] = useState(false); // Track if user went through team selection
    const teams = ['HR', 'AI', 'Research', 'Engineering', 'Finance'];
    async function handleSendOTP(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        console.log("[LoginModal] Processing email:", { email, step });
        try {
            // First check if email exists
            const emailExists = await checkEmailExists(email);
            console.log("[LoginModal] Email exists check result:", { email, emailExists });
            if (emailExists) {
                // Email exists, send OTP for login
                console.log("[LoginModal] Existing user, sending OTP directly");
                setIsNewUser(false);
                await sendOTP(email);
                setStep('otp');
            }
            else {
                // Email doesn't exist, ask for team selection first
                console.log("[LoginModal] New user, showing team selection");
                setIsNewUser(true);
                setStep('team');
            }
        }
        catch (err) {
            setError(err?.message || "Failed to process login request");
        }
        finally {
            setLoading(false);
        }
    }
    async function handleVerifyOTP(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        console.log("[LoginModal] Verifying OTP:", { email, team, isNewUser, step });
        try {
            const result = await verifyOTP(email, otp);
            // Use our tracked isNewUser flag instead of the result from verifyOTP
            if (isNewUser && team) {
                // For new users who came through team selection, store their team info
                console.log("[LoginModal] Storing new user with team:", { email, team });
                await storeUserWithTeam(email, team);
            }
            else if (isNewUser && !team) {
                console.log("[LoginModal] Warning: New user but no team selected");
            }
            else {
                console.log("[LoginModal] Existing user, no storage needed");
            }
            // Both new and existing users go to chat
            onClose();
            nav("/chat");
        }
        catch (err) {
            setError(err?.message || "Invalid OTP");
        }
        finally {
            setLoading(false);
        }
    }
    async function storeUserWithTeam(userEmail, userTeam) {
        if (!supabase || !userTeam) {
            console.log("[Auth] storeUserWithTeam called with missing data:", { userEmail, userTeam, hasSupabase: !!supabase });
            return;
        }
        console.log("[Auth] Storing user with team:", { userEmail, userTeam });
        try {
            // Store user registration in the login table
            const { data, error } = await supabase
                .from('login')
                .insert([{
                    user_email: userEmail,
                    team: userTeam
                }]);
            if (error) {
                console.log("[Auth] Error storing user data:", error);
                // Try without team field if that fails
                const { data: data2, error: error2 } = await supabase
                    .from('login')
                    .insert([{
                        user_email: userEmail
                    }]);
                if (error2) {
                    console.log("[Auth] Error storing user data without team:", error2);
                }
                else {
                    console.log("[Auth] User data stored successfully without team:", data2);
                }
            }
            else {
                console.log("[Auth] User data stored successfully with team:", data);
            }
        }
        catch (err) {
            console.log("[Auth] Exception storing user data:", err);
        }
    }
    async function handleTeamSelection(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        console.log("[LoginModal] Team selection:", { email, team, step });
        try {
            // For new users, send OTP after team selection
            await sendOTP(email);
            setStep('otp');
        }
        catch (err) {
            setError(err?.message || "Failed to send OTP");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 grid place-items-center bg-black/70 p-4", children: _jsxs("div", { className: "relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0b1115]/95 shadow-2xl", children: [_jsxs("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-0 -z-10", children: [_jsx("div", { className: "absolute -top-24 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" }), _jsx("div", { className: "absolute bottom-[-120px] right-[-80px] h-[320px] w-[320px] rounded-full bg-emerald-400/10 blur-3xl" })] }), _jsx("button", { onClick: onClose, className: "absolute right-4 top-4 rounded-lg px-2 py-1 text-slate-400 hover:text-white", "aria-label": "Close", children: "\u2715" }), _jsxs("div", { className: "flex items-center gap-4 px-6 pt-6 sm:px-8", children: [_jsx(LoginLogoMark, { className: "h-10 w-auto shrink-0" }), _jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "truncate text-base font-semibold text-white", children: "Welcome to CarbonSight" }), _jsx("p", { className: "text-xs text-slate-400", children: "Cut AI emissions, not quality." })] })] }), _jsxs("div", { className: "space-y-4 px-6 py-6 sm:px-8", children: [step === 'email' && (_jsxs("form", { onSubmit: handleSendOTP, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "mb-1 block text-xs text-slate-400", children: "Email Address" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", placeholder: "you@example.com", className: "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/40", value: email, onChange: (e) => setEmail(e.target.value), required: true, disabled: loading })] }), error && (_jsx("p", { className: "rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200", children: error })), _jsxs("button", { type: "submit", disabled: loading, className: "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-70", children: [_jsx(Send, { className: "h-4 w-4" }), loading ? "Processing..." : "Continue"] })] })), step === 'otp' && (_jsxs("form", { onSubmit: handleVerifyOTP, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "otp", className: "mb-1 block text-xs text-slate-400", children: "Enter OTP" }), _jsx("input", { id: "otp", type: "text", placeholder: "123456", className: "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/40 text-center text-lg tracking-widest", value: otp, onChange: (e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)), required: true, disabled: loading, maxLength: 6 }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["We sent a 6-digit code to ", _jsx("span", { className: "text-slate-300", children: email })] })] }), error && (_jsx("p", { className: "rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200", children: error })), _jsxs("button", { type: "submit", disabled: loading || otp.length !== 6, className: "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-70", children: [_jsx(LogIn, { className: "h-4 w-4" }), loading ? "Verifying..." : "Verify OTP"] }), _jsx("button", { type: "button", onClick: () => {
                                        setStep('email');
                                        setOtp('');
                                        setTeam('');
                                        setIsNewUser(false);
                                    }, className: "w-full text-xs text-slate-400 hover:text-slate-200", children: "\u2190 Back to email" })] })), step === 'team' && (_jsxs("form", { onSubmit: handleTeamSelection, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "team", className: "mb-1 block text-xs text-slate-400", children: "Select Your Team" }), _jsxs("select", { id: "team", className: "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40", value: team, onChange: (e) => setTeam(e.target.value), required: true, disabled: loading, children: [_jsx("option", { value: "", children: "Choose your team..." }), teams.map((teamOption) => (_jsx("option", { value: teamOption, className: "bg-slate-800", children: teamOption }, teamOption)))] }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "Welcome! Since you're new, please select your team to get started." })] }), error && (_jsx("p", { className: "rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200", children: error })), _jsxs("button", { type: "submit", disabled: loading || !team, className: "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-70", children: [_jsx(Send, { className: "h-4 w-4" }), loading ? "Sending OTP..." : "Send OTP"] }), _jsx("button", { type: "button", onClick: () => {
                                        setStep('email');
                                        setTeam('');
                                        setIsNewUser(false);
                                    }, className: "w-full text-xs text-slate-400 hover:text-slate-200", children: "\u2190 Back to email" })] })), _jsxs("p", { className: "text-center text-xs text-slate-400", children: ["By continuing, you agree to our ", _jsx("span", { className: "underline", children: "Terms" }), " and", " ", _jsx("span", { className: "underline", children: "Privacy" }), "."] })] })] }) }));
}
/* --- Small inline SVG mark for modal --- */
function LoginLogoMark(props) {
    return (_jsxs("svg", { viewBox: "0 0 160 104", role: "img", "aria-label": "CarbonSight", ...props, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "csSweepLogin", x1: "0", x2: "1", children: [_jsx("stop", { offset: "0", stopColor: "#fff", stopOpacity: "0" }), _jsx("stop", { offset: ".5", stopColor: "#fff", stopOpacity: ".7" }), _jsx("stop", { offset: "1", stopColor: "#fff", stopOpacity: "0" })] }), _jsx("clipPath", { id: "csEyeClipLogin", children: _jsx("path", { d: "M0,52 C34,0 126,0 160,52 C126,104 34,104 0,52Z" }) })] }), _jsx("path", { d: "M0,52 C34,0 126,0 160,52 C126,104 34,104 0,52Z", fill: "none", stroke: "#10B981", strokeWidth: "6", opacity: ".9" }), _jsx("circle", { cx: "80", cy: "52", r: "28", fill: "none", stroke: "#10B981", strokeWidth: "6", opacity: ".55" }), _jsx("path", { d: "M80 33c11 9 16 19 16 29s-5 20-16 29c-11-9-16-19-16-29s5-20 16-29Z", fill: "#10B981" }), _jsx("g", { clipPath: "url(#csEyeClipLogin)", children: _jsx("rect", { x: "-220", y: "0", width: "220", height: "104", fill: "url(#csSweepLogin)", children: _jsx("animate", { attributeName: "x", from: "-220", to: "220", dur: "3.6s", repeatCount: "indefinite" }) }) })] }));
}
/* --- Background deco --- */
function EcoWaveDeco() {
    return (_jsxs("div", { className: "pointer-events-none absolute inset-0 -z-10", children: [_jsx("div", { className: "absolute left-1/2 top-[-120px] h-[700px] w-[1200px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" }), _jsxs(motion.svg, { initial: { y: -12, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { duration: 0.8, ease: "easeOut" }, className: "absolute left-0 top-0 h-[280px] w-full", viewBox: "0 0 1440 280", preserveAspectRatio: "none", "aria-hidden": true, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "ecoGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#10B981", stopOpacity: "0.25" }), _jsx("stop", { offset: "100%", stopColor: "#10B981", stopOpacity: "0.0" })] }) }), _jsxs(motion.g, { animate: { x: [0, 240, 0] }, transition: { duration: 18, repeat: Infinity, ease: "linear" }, children: [_jsx("path", { d: "M0,80 C240,40 480,120 720,80 C960,40 1200,120 1440,80 L1440,280 L0,280 Z", fill: "url(#ecoGrad)" }), _jsx("path", { d: "M-1440,80 C-1200,40 -960,120 -720,80 C-480,40 -240,120 0,80 L0,280 L-1440,280 Z", fill: "url(#ecoGrad)" })] })] }), _jsx("div", { className: "absolute inset-x-0 top-[260px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" })] }));
}
const MODEL_FACTORS = {
    "gemini-2.5-pro": { label: "gemini-2.5-pro", costPer1K: 0.0076, co2Per1K: 0.6313, baseLatency: 721.43 },
    "gemini-2.5-flash": { label: "gemini-2.5-flash", costPer1K: 0.0037, co2Per1K: 0.3285, baseLatency: 1013.89 },
    "gemini-2.5-flash-lite": { label: "gemini-2.5-flash-lite", costPer1K: 0.0012, co2Per1K: 0.1225, baseLatency: 1225.00 },
    "gemini-1.5-pro": { label: "gemini-1.5-pro", costPer1K: 0.0121, co2Per1K: 0.9075, baseLatency: 756.25 },
    "gemini-1.5-flash": { label: "gemini-1.5-flash", costPer1K: 0.0051, co2Per1K: 0.4050, baseLatency: 1012.50 },
    "gemini-1.5-flash-lite": { label: "gemini-1.5-flash-lite", costPer1K: 0.0023, co2Per1K: 0.1830, baseLatency: 1270.83 },
};
function estTokens(prompt) {
    const t = Math.ceil((prompt.trim().length || 1) / 4); // ~4 chars / token
    return Math.max(1, t);
}
function computeRows(prompt) {
    const tokens = estTokens(prompt);
    const k = tokens / 1000;
    return Object.entries(MODEL_FACTORS).map(([modelId, f]) => {
        // small latency growth with prompt size
        const latency = f.baseLatency + Math.sqrt(tokens) * 6; // tweakable
        return {
            modelId,
            model: f.label,
            costUSD: +(k * f.costPer1K).toFixed(4),
            co2kg: +(k * f.co2Per1K).toFixed(4),
            latencyMs: +latency.toFixed(2),
            tokens,
        };
    });
}
/** Static baseline rows to match your screenshot feel. */
const GEMINI_BASELINES = [
    { model: "gemini-2.5-pro", costUsdPer1k: 0.0076, co2Per1k: 0.6313, latencyMsP95: 721.43 },
    { model: "gemini-2.5-flash", costUsdPer1k: 0.0037, co2Per1k: 0.3285, latencyMsP95: 1013.89 },
    { model: "gemini-2.5-flash-lite", costUsdPer1k: 0.0012, co2Per1k: 0.1225, latencyMsP95: 1225.00 },
    { model: "gemini-1.5-pro", costUsdPer1k: 0.0121, co2Per1k: 0.9075, latencyMsP95: 756.25 },
    { model: "gemini-1.5-flash", costUsdPer1k: 0.0051, co2Per1k: 0.4050, latencyMsP95: 1012.50 },
    { model: "gemini-1.5-flash-lite", costUsdPer1k: 0.0023, co2Per1k: 0.1830, latencyMsP95: 1270.83 },
];
/** If you want to scale by prompt length, you can; for now we just return baselines. */
function estimateForPrompt(_text) {
    return GEMINI_BASELINES;
}
function ChatScreen() {
    const { user, logout } = useAuth();
    // Models
    const [modelId, setModelId] = useState(MODELS[0].id);
    const currentModel = useMemo(() => MODELS.find((m) => m.id === modelId), [modelId]);
    // FX state
    const [fx, setFx] = useState({ show: false, color: "green" });
    const playedColorsRef = useRef(new Set());
    const burstPlayedRef = useRef(false);
    const [uiAutoBest, setUiAutoBest] = useState(false);
    // Per-prompt analysis rows keyed by message index
    const [analyses, setAnalyses] = useState({});
    // Which message index is currently showing the info modal
    const [infoFor, setInfoFor] = useState(null);
    useEffect(() => {
        burstPlayedRef.current = false;
        playedColorsRef.current.clear();
    }, [modelId]);
    // Chat state (demo)
    const [convos, setConvos] = useState([{ id: "c1", title: "New chat" }]);
    const [activeId, setActiveId] = useState("c1");
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Hi! Ask me anything about CarbonSight. This is a demo UI." },
    ]);
    const [input, setInput] = useState("");
    const listRef = useRef(null);
    useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
    function newChat() {
        const id = Math.random().toString(36).slice(2);
        setConvos((c) => [{ id, title: "New chat" }, ...c]);
        setActiveId(id);
        setMessages([{ role: "assistant", content: "New conversation started." }]);
        playedColorsRef.current.clear();
    }
    function deleteChat(id) {
        setConvos((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id && convos.length > 1) {
            const next = convos.find((c) => c.id !== id);
            setActiveId(next.id);
            setMessages([{ role: "assistant", content: "Switched conversation." }]);
        }
    }
    const BURST_MS = 3200;
    async function sendMessage() {
        const text = input.trim();
        if (!text)
            return;
        setInput("");
        // Add user message and capture its index
        setMessages((prev) => {
            const myIndex = prev.length; // this user's message will be at this index
            const next = [...prev, { role: "user", content: text }];
            // compute analysis rows for this prompt (front-end demo)
            const rows = estimateForPrompt(text);
            setAnalyses((a) => ({ ...a, [myIndex]: rows }));
            return next;
        });
        // (optional) your Supabase insert/analysis call can stay here if you have it
        // try { await insertGeminiToSupabase(text, user?.email ?? ""); } catch {}
        // Play the burst once per color
        const effectColor = currentModel.energy === "intensive" ? "red" : "green";
        if (!playedColorsRef.current.has(effectColor)) {
            requestAnimationFrame(() => {
                setFx({ show: true, color: effectColor });
                window.setTimeout(() => setFx((p) => ({ ...p, show: false })), BURST_MS);
            });
            playedColorsRef.current.add(effectColor);
        }
        // Demo assistant reply
        const reply = `(${currentModel.label}) I've analyzed your prompt for carbon emissions across different Gemini models. The data is shown via the ⓘ button next to your message.`;
        setTimeout(() => setMessages((m) => [...m, { role: "assistant", content: reply }]), 350);
    }
    /* -------- Sidebar state: desktop collapse + mobile overlay -------- */
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cs.sidebarCollapsed") === "1");
    useEffect(() => { localStorage.setItem("cs.sidebarCollapsed", collapsed ? "1" : "0"); }, [collapsed]);
    const [mobileOpen, setMobileOpen] = useState(false);
    useEffect(() => {
        const onKey = (e) => {
            const key = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && key === "b") {
                setCollapsed((v) => !v);
                e.preventDefault();
            }
            if ((e.ctrlKey || e.metaKey) && key === "n") {
                newChat();
                e.preventDefault();
            }
            if (key === "escape")
                setMobileOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    /* -------- Energy chip styling -------- */
    const energyChip = {
        sustainable: { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/10 ring-emerald-400/30", label: "Sustainable" },
        balanced: { dot: "bg-amber-300", text: "text-amber-200", bg: "bg-amber-400/10 ring-amber-300/30", label: "Balanced" },
        intensive: { dot: "bg-rose-400", text: "text-rose-300", bg: "bg-rose-500/10 ring-rose-400/30", label: "Energy-intensive" },
    }[currentModel.energy];
    /* -------- Sidebar content (reused for desktop + mobile) -------- */
    // Sidebar open/closed
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    // (optional) remember preference
    useEffect(() => {
        const saved = localStorage.getItem("cs_sidebar_open");
        if (saved !== null)
            setIsSidebarOpen(saved === "1");
    }, []);
    useEffect(() => {
        localStorage.setItem("cs_sidebar_open", isSidebarOpen ? "1" : "0");
    }, [isSidebarOpen]);
    useEffect(() => {
        localStorage.setItem("cs_sidebar_open", isSidebarOpen ? "1" : "0");
    }, [isSidebarOpen]);
    const SidebarContent = ({ collapsed, showClose, onClose }) => (_jsxs("div", { className: "relative flex h-full flex-col", children: [_jsx("div", { className: "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-500/10 to-transparent" }), _jsxs("div", { className: "relative z-10 flex items-center justify-between", children: [_jsxs(PrimaryButton, { onClick: newChat, className: `${collapsed ? "px-2" : "px-3"} w-full`, children: [_jsx(Plus, { className: "h-4 w-4" }), !collapsed && _jsx("span", { children: "New chat" })] }), !showClose && (_jsx("button", { onClick: () => setCollapsed((v) => !v), className: "ml-2 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10", title: collapsed ? "Expand sidebar (⌘/Ctrl+B)" : "Collapse sidebar (⌘/Ctrl+B)", children: collapsed ? _jsx(ChevronRight, { className: "h-4 w-4" }) : _jsx(ChevronLeft, { className: "h-4 w-4" }) })), showClose && (_jsx("button", { onClick: onClose, className: "ml-2 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10", title: "Close", children: _jsx(X, { className: "h-4 w-4" }) }))] }), _jsx("div", { className: "mt-3 flex-1 space-y-1 overflow-y-auto pr-1", children: convos.map((c) => {
                    const active = activeId === c.id;
                    return (_jsxs("div", { className: `group relative flex items-center justify-between rounded-lg ${collapsed ? "px-1" : "px-2"} py-2 text-sm ${active ? "bg-white/10" : "hover:bg-white/10"}`, children: [active && _jsx("span", { className: "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r bg-gradient-to-b from-emerald-400 to-emerald-300" }), _jsxs("button", { onClick: () => setActiveId(c.id), className: "flex w-full items-center gap-2 text-left", title: c.title, children: [_jsx(MessageSquare, { className: "h-4 w-4 text-emerald-300 shrink-0" }), !collapsed && _jsx("span", { className: "line-clamp-1", children: c.title })] }), !collapsed && (_jsx("button", { onClick: () => deleteChat(c.id), className: "ml-2 hidden rounded-md p-1 text-slate-500 hover:text-rose-400 hover:bg-white/10 group-hover:block", title: "Delete", children: _jsx(Trash2, { className: "h-4 w-4" }) }))] }, c.id));
                }) }), _jsxs("div", { className: `mt-3 rounded-xl border border-white/10 bg-white/5 ${collapsed ? "px-2" : "px-3"} py-2`, children: [_jsxs(Link, { to: "/dashboard", className: `flex items-center gap-2 rounded-lg ${collapsed ? "px-1" : "px-2"} py-2 text-sm hover:bg-white/10`, title: "Dashboard", children: [_jsx(BarChart3, { className: "h-4 w-4" }), !collapsed && _jsx("span", { children: "Dashboard" })] }), _jsxs("button", { onClick: logout, className: `mt-1 flex w-full items-center gap-2 rounded-lg ${collapsed ? "px-1" : "px-2"} py-2 text-left text-sm hover:bg-white/10`, title: "Logout", children: [_jsx(LogOut, { className: "h-4 w-4" }), !collapsed && _jsx("span", { children: "Logout" })] }), !collapsed && (_jsxs("div", { className: "mt-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-slate-400", children: [_jsxs("div", { className: "truncate", children: [_jsx("span", { className: "text-slate-300", children: "Signed in:" }), " ", user?.email ?? "guest"] }), _jsx("div", { className: "mt-1 opacity-80", children: "Shortcuts: \u2318/Ctrl+B collapse \u2022 \u2318/Ctrl+N new chat" })] }))] })] }));
    return (_jsxs("div", { className: "min-h-screen bg-[#0b1115] text-slate-100 flex", children: [_jsxs("aside", { className: `relative hidden md:flex flex-col border-r border-white/10 bg-gradient-to-b from-black/40 to-black/20 transition-[width] duration-300 ease-out ${isSidebarOpen ? "w-[280px]" : "w-[76px]"}`, children: [_jsx("button", { onClick: () => setIsSidebarOpen((v) => !v), "aria-label": isSidebarOpen ? "Collapse sidebar" : "Expand sidebar", className: "absolute -right-3 top-100 z-30 grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-[#0d1418]/80 text-slate-200 backdrop-blur transition hover:bg-white/10", title: isSidebarOpen ? "Collapse sidebar" : "Expand sidebar", children: isSidebarOpen ? (_jsx(ChevronLeft, { className: "h-5 w-5" })) : (_jsx(ChevronRight, { className: "h-5 w-5" })) }), _jsx("button", { onClick: () => setIsSidebarOpen((s) => !s), "aria-label": isSidebarOpen ? "Collapse sidebar" : "Expand sidebar", className: "group absolute top-4 -right-3 grid h-8 w-8 place-items-center rounded-full bg-black/60 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/10 hover:ring-white/30", children: isSidebarOpen ? (_jsx(ChevronLeft, { className: "h-4 w-4 text-slate-200" })) : (_jsx(ChevronRight, { className: "h-4 w-4 text-slate-200" })) }), _jsx("div", { className: "sticky top-0 z-10 border-b border-white/10 bg-black/30 px-2 pt-3 pb-3 backdrop-blur", children: _jsxs("button", { onClick: newChat, className: `flex h-10 w-full items-center rounded-xl bg-emerald-500 font-semibold text-black transition hover:bg-emerald-400 ${isSidebarOpen ? "justify-center gap-2 px-3" : "justify-center"}`, title: "New chat", children: [_jsx(Plus, { className: "h-5 w-5" }), _jsx("span", { className: `${isSidebarOpen ? "inline" : "hidden"}`, children: "New chat" })] }) }), _jsx("div", { className: "flex-1 space-y-1 overflow-y-auto p-2 pr-1", children: convos.map((c) => {
                            const active = c.id === activeId;
                            return (_jsxs("button", { onClick: () => setActiveId(c.id), className: `group relative flex h-10 w-full items-center rounded-xl transition-colors ${isSidebarOpen ? "justify-between px-3" : "justify-center"} ${active ? "bg-white/10" : "hover:bg-white/5"}`, title: c.title, children: [_jsx("span", { className: `absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-emerald-400 transition-opacity ${isSidebarOpen ? "" : "hidden"} ${active ? "opacity-100" : "opacity-0 group-hover:opacity-60"}` }), _jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [_jsx(MessageSquare, { className: "h-4 w-4 text-emerald-300" }), _jsx("span", { className: `truncate text-left ${isSidebarOpen ? "block" : "hidden"}`, children: c.title })] }), isSidebarOpen && (_jsx(Trash2, { className: "h-4 w-4 shrink-0 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-rose-400" }))] }, c.id));
                        }) }), _jsxs("div", { className: "border-t border-white/10 p-2", children: [_jsxs(Link, { to: "/dashboard", className: `flex items-center rounded-xl px-2 py-2 text-sm transition hover:bg-white/5 ${isSidebarOpen ? "gap-2" : "justify-center"}`, title: "Dashboard", children: [_jsx(BarChart3, { className: "h-4 w-4 text-slate-300" }), _jsx("span", { className: `${isSidebarOpen ? "inline" : "hidden"}`, children: "Dashboard" })] }), _jsxs("button", { onClick: logout, className: `mt-1 flex w-full items-center rounded-xl px-2 py-2 text-left text-sm transition hover:bg-white/5 ${isSidebarOpen ? "gap-2" : "justify-center"}`, title: "Logout", children: [_jsx(LogOut, { className: "h-4 w-4 text-slate-300" }), _jsx("span", { className: `${isSidebarOpen ? "inline" : "hidden"}`, children: "Logout" })] }), _jsx("div", { className: `mt-1 flex items-center rounded-xl px-2 py-2 text-sm text-slate-400 ${isSidebarOpen ? "gap-2" : "justify-center"}`, title: "Settings" })] })] }), _jsxs("div", { className: `md:hidden fixed inset-0 z-40 ${mobileOpen ? "" : "pointer-events-none"}`, role: "dialog", "aria-modal": "true", children: [_jsx("div", { className: `absolute inset-0 bg-black/60 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`, onClick: () => setMobileOpen(false) }), _jsx("div", { className: `absolute left-0 top-0 h-full w-[85%] max-w-[340px] border-r border-white/10 bg-black/40 backdrop-blur transform transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`, children: _jsx("div", { className: "h-full p-3", children: _jsx(SidebarContent, { collapsed: false, showClose: true, onClose: () => setMobileOpen(false) }) }) })] }), _jsxs("section", { className: "relative isolate flex min-w-0 flex-1 flex-col", children: [_jsx(WaterBurstFX, { show: fx.show, color: fx.color }), _jsxs("header", { className: "relative z-20 flex items-center justify-between border-b border-white/10 px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setMobileOpen(true), className: "mr-1 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 md:hidden", title: "Open sidebar", "aria-label": "Open sidebar", children: _jsx(Menu, { className: "h-5 w-5" }) }), _jsx("div", { className: "flex items-center", children: _jsx(CarbonSightLogo, { energy: "sustainable", width: 200, height: 32, className: "block" }) })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsxs("div", { className: `hidden sm:flex items-center gap-2 rounded-xl ring-1 px-2 py-1.5 ${energyChip.bg}`, children: [_jsx("span", { className: `inline-flex h-2.5 w-2.5 rounded-full ${energyChip.dot}` }), _jsx("span", { className: `text-xs ${energyChip.text}`, children: energyChip.label }), _jsx("span", { className: "mx-2 h-4 w-px bg-white/10" }), _jsx("span", { className: "text-xs text-slate-400", children: "Model" }), _jsx("select", { className: "rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none hover:border-white/20", value: modelId, onChange: (e) => setModelId(e.target.value), title: "Choose an AI model", children: MODELS.map((m) => (_jsx("option", { value: m.id, children: m.label }, m.id))) })] }) }), _jsx("div", { className: "text-[11px] text-slate-400", children: user?.email ? _jsxs(_Fragment, { children: ["Signed in as ", _jsx("span", { className: "text-slate-300", children: user.email })] }) : "guest" })] }), _jsx("div", { ref: listRef, className: "relative z-20 flex-1 space-y-4 overflow-y-auto px-4 py-6", children: messages.map((m, i) => {
                            const mine = m.role === "user";
                            return (_jsx("div", { className: `flex ${mine ? "justify-end" : "justify-start"}`, children: _jsxs("div", { className: `relative max-w-[72ch] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.05)] ${mine
                                        ? "bg-gradient-to-br from-emerald-500 to-emerald-400 text-black"
                                        : "bg-white/5 text-slate-100"}`, children: [m.content, mine && (_jsx("button", { onClick: () => setInfoFor(i), className: "absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-black/30 text-white/80 backdrop-blur hover:bg-black/50", title: "Show model metrics", children: _jsx(Info, { className: "h-3.5 w-3.5" }) }))] }) }, i));
                        }) }), infoFor !== null && (_jsx(PromptInfoModal, { prompt: messages[infoFor]?.content ?? "", rows: analyses[infoFor] ?? [], onClose: () => setInfoFor(null) })), _jsx("footer", { className: "relative z-20 border-t border-white/10 p-3", children: _jsxs("div", { className: "mx-auto max-w-4xl", children: [_jsxs("div", { className: "flex items-end gap-2 rounded-2xl border border-white/10 bg-black/30 p-2", children: [_jsxs("div", { className: "flex items-center gap-2 self-center px-1", children: [_jsx("span", { className: "text-[11px] text-slate-400", children: "Auto Best" }), _jsx("button", { type: "button", "aria-pressed": uiAutoBest, onClick: () => setUiAutoBest(v => !v), className: `relative inline-flex h-6 w-11 items-center rounded-full transition ${uiAutoBest ? "bg-emerald-500" : "bg-white/10"}`, title: "Auto-select best model (UI only)", children: _jsx("span", { className: `inline-block h-5 w-5 transform rounded-full bg-white transition ${uiAutoBest ? "translate-x-5" : "translate-x-1"}` }) })] }), _jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), placeholder: "Ask CarbonSight\u2026", rows: 1, onKeyDown: (e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendMessage();
                                                }
                                            }, className: "min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-500" }), _jsxs("button", { onClick: sendMessage, className: "inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-70", disabled: !input.trim(), children: [_jsx(Send, { className: "h-4 w-4" }), _jsx("span", { className: "hidden sm:inline", children: "Send" })] })] }), _jsxs("p", { className: "mt-2 text-center text-[11px] text-slate-500", children: ["Burst plays once per color \u2014 ", _jsx("span", { className: "text-emerald-300", children: "green" }), " for sustainable/balanced,", " ", _jsx("span", { className: "text-rose-400", children: "red" }), " for intensive."] })] }) })] })] }));
}
function AnimatedNumber({ value, decimals = 2 }) {
    const mv = useMotionValue(0);
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        const controls = animate(mv, value, {
            duration: 0.35,
            onUpdate: (v) => setDisplay(v),
        });
        return () => controls.stop();
    }, [value]);
    return _jsx("span", { children: display.toFixed(decimals) });
}
function PromptInfoModal({ prompt, rows, // optional seed rows from your `analyses[index]` map
onClose, }) {
    // Live local calc every render
    const live = useMemo(() => computeRows(prompt), [prompt]);
    // Optional: merge with realtime rows coming from Supabase (table example: "prompt_metrics")
    const [remoteRows, setRemoteRows] = useState(rows ?? []);
    useEffect(() => setRemoteRows(rows ?? []), [rows]);
    useEffect(() => {
        // Skip if you don't have supabase set up yet
        // Example realtime feed keyed by a prompt hash you store when you insert
        if (!supabase)
            return;
        const key = simpleHash(prompt); //  short hash for channel topic
        const channel = supabase
            .channel(`metrics_${key}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prompt_metrics', filter: `prompt_hash=eq.${key}` }, (payload) => {
            // Expect rows shaped like EstRow; adapt if your table differs
            const r = payload.new;
            setRemoteRows((prev) => {
                const map = new Map(prev.map((x) => [x.modelId, x]));
                map.set(r.modelId, r);
                return Array.from(map.values());
            });
        })
            .subscribe();
        return () => { try {
            supabase.removeChannel(channel);
        }
        catch { } };
    }, [prompt]);
    // Choose: remote overrides live, else live
    const merged = useMemo(() => {
        if (!remoteRows.length)
            return live;
        const byId = new Map(remoteRows.map(r => [r.modelId, r]));
        return live.map(r => byId.get(r.modelId) ?? r);
    }, [live, remoteRows]);
    return (_jsx("div", { className: "fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4", children: _jsxs("div", { className: "w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b1115] p-5 shadow-2xl", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "text-base font-semibold text-white", children: "Prompt metrics" }), _jsx("button", { onClick: onClose, className: "rounded-lg px-2 py-1 text-slate-400 hover:text-white", children: "\u2715" })] }), _jsxs("p", { className: "mb-3 truncate text-sm text-slate-400", children: ["\u201C", prompt, "\u201D"] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-slate-400", children: [_jsx("th", { className: "px-3 py-2", children: "Model" }), _jsx("th", { className: "px-3 py-2", children: "Tokens" }), _jsx("th", { className: "px-3 py-2", children: "Cost (USD)" }), _jsx("th", { className: "px-3 py-2", children: "CO\u2082 (kg)" }), _jsx("th", { className: "px-3 py-2", children: "Latency (ms)" })] }) }), _jsx("tbody", { children: merged.map((r) => (_jsxs("tr", { className: "odd:bg-white/0 even:bg-white/5", children: [_jsx("td", { className: "px-3 py-2 font-medium", children: r.model }), _jsx("td", { className: "px-3 py-2", children: r.tokens }), _jsx("td", { className: "px-3 py-2", children: _jsx(AnimatedNumber, { value: r.costUSD, decimals: 4 }) }), _jsx("td", { className: "px-3 py-2", children: _jsx(AnimatedNumber, { value: r.co2kg, decimals: 4 }) }), _jsx("td", { className: "px-3 py-2", children: _jsx(AnimatedNumber, { value: r.latencyMs, decimals: 2 }) })] }, r.modelId))) })] }) })] }) }));
}
// tiny prompt hash (good enough for channel key)
function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (h << 5) - h + s.charCodeAt(i), h |= 0;
    return Math.abs(h).toString(36);
}
function Card({ title, icon, children, }) {
    return (_jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsxs("div", { className: "mb-1 flex items-center gap-2 text-sm text-slate-300", children: [icon, " ", title] }), _jsx("div", { className: "text-2xl font-semibold", children: children })] }));
}
/* Duplicate PromptInfoModal removed to fix compile error */
/* ---------------- Screen 3: Dashboard ---------------- */
// add these imports if not present:
/* ---------------- Screen 3: Dashboard ---------------- */
function DashboardScreen() {
    const nav = useNavigate();
    const { logout } = useAuth();
    // Live team averages from Supabase (computed from public.user_metrics)
    const [rows, setRows] = useState([]);
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchTeamAveragesFromView(); // <-- reads from public.user_metrics
            setRows(data);
            setErr(null);
        }
        catch (e) {
            setErr(e?.message ?? String(e));
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        // initial fetch
        load();
        // subscribe to realtime changes in public.user_metrics → refresh charts
        const channel = supabase
            ?.channel("realtime:user_metrics")
            .on("postgres_changes", { event: "*", schema: "public", table: "user_metrics" }, () => load())
            .subscribe();
        return () => {
            channel?.unsubscribe();
        };
    }, [load]);
    // Snapshot cards (weighted by num_entries)
    const snapshot = useMemo(() => {
        if (rows.length === 0)
            return { csi: 78, carbon: 0, tvl: "$—" };
        const totalUsers = rows.reduce((s, r) => s + (r.num_entries ?? 0), 0) || 1;
        const weightedCarbon = rows.reduce((s, r) => s + Number(r.avg_co2_kg) * (r.num_entries ?? 0), 0) / totalUsers;
        return {
            csi: Math.round(80 + Math.random() * 10), // demo KPI for now
            carbon: Number(weightedCarbon.toFixed(2)),
            tvl: `$${(rows.length * 0.5).toFixed(1)}M`, // placeholder
        };
    }, [rows]);
    // Chart datasets
    const co2Data = rows.map((r) => ({ team: r.team, value: Number(r.avg_co2_kg) || 0 }));
    const latencyData = rows.map((r) => ({ team: r.team, value: Number(r.avg_latency_ms) || 0 }));
    const costData = rows.map((r) => ({ team: r.team, value: Number(r.avg_cost_usd) || 0 }));
    // Sort table by lowest CO2 first
    const teamBoard = [...rows].sort((a, b) => Number(a.avg_co2_kg) - Number(b.avg_co2_kg));
    return (_jsxs("div", { className: "min-h-screen bg-[#0b1115] text-slate-100", children: [_jsx(BackdropGlow, {}), _jsxs("header", { className: "mx-auto flex max-w-7xl items-center justify-between px-4 py-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(BarChart3, { className: "h-5 w-5 text-emerald-300" }), _jsx("span", { className: "font-semibold", children: "Dashboard" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Link, { to: "/chat", className: "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10", children: "Chat" }), _jsxs("button", { onClick: async () => {
                                    await logout();
                                    nav("/");
                                }, className: "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10", children: [_jsx(LogOut, { className: "mr-1 inline-block h-4 w-4" }), " Logout"] })] })] }), _jsxs("main", { className: "mx-auto max-w-7xl px-4 pb-24", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-3", children: [_jsx(Card, { title: "CSI Now", icon: _jsx(Zap, { className: "h-4 w-4 text-emerald-300" }), children: snapshot.csi }), _jsx(Card, { title: "Avg CO\u2082 per Team (kg)", icon: _jsx(Leaf, { className: "h-4 w-4 text-emerald-300" }), children: loading ? "…" : snapshot.carbon }), _jsx(Card, { title: "Pool TVL", icon: _jsx(Award, { className: "h-4 w-4 text-emerald-300" }), children: snapshot.tvl })] }), _jsxs("div", { className: "mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-sm text-slate-300", children: [_jsx(ChartLine, { className: "h-4 w-4" }), " Average CO\u2082 by Team (kg)"] }), _jsx("div", { className: "h-64 w-full", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(RBarChart, { data: co2Data, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.08)" }), _jsx(XAxis, { dataKey: "team", stroke: "#9CA3AF" }), _jsx(YAxis, { stroke: "#9CA3AF" }), _jsx(Tooltip, { contentStyle: {
                                                            background: "#0f172a",
                                                            border: "1px solid rgba(255,255,255,0.1)",
                                                            borderRadius: 12,
                                                            color: "#e5e7eb",
                                                        } }), _jsx(Bar, { dataKey: "value", name: "Avg CO\u2082 (kg)", fill: "#10B981", radius: [6, 6, 0, 0] })] }) }) })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsx("div", { className: "mb-2 text-sm text-slate-300", children: "Average Cost by Team (USD)" }), _jsx("div", { className: "h-64 w-full", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(RBarChart, { data: costData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.08)" }), _jsx(XAxis, { dataKey: "team", stroke: "#9CA3AF" }), _jsx(YAxis, { stroke: "#9CA3AF" }), _jsx(Tooltip, { contentStyle: {
                                                            background: "#0f172a",
                                                            border: "1px solid rgba(255,255,255,0.1)",
                                                            borderRadius: 12,
                                                            color: "#e5e7eb",
                                                        }, formatter: (value) => [`$${Number(value).toFixed(4)}`, "Avg Cost (USD)"] }), _jsx(Bar, { dataKey: "value", name: "Avg Cost (USD)", fill: "#3B82F6", radius: [6, 6, 0, 0] })] }) }) })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsx("div", { className: "mb-2 text-sm text-slate-300", children: "Average Latency by Team (ms)" }), _jsx("div", { className: "h-64 w-full", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(RBarChart, { data: latencyData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.08)" }), _jsx(XAxis, { dataKey: "team", stroke: "#9CA3AF" }), _jsx(YAxis, { stroke: "#9CA3AF" }), _jsx(Tooltip, { contentStyle: {
                                                            background: "#0f172a",
                                                            border: "1px solid rgba(255,255,255,0.1)",
                                                            borderRadius: 12,
                                                            color: "#e5e7eb",
                                                        } }), _jsx(Bar, { dataKey: "value", name: "Avg Latency (ms)", fill: "#F59E0B", radius: [6, 6, 0, 0] })] }) }) })] })] }), _jsxs("div", { className: "mt-6 rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsx("div", { className: "mb-3 text-sm text-slate-300", children: "Team Averages (from public.user_metrics)" }), err && _jsx("p", { className: "text-rose-400 text-sm", children: err }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-slate-400", children: [_jsx("th", { className: "px-3 py-2", children: "Team" }), _jsx("th", { className: "px-3 py-2", children: "Team Size" }), _jsx("th", { className: "px-3 py-2", children: "Avg CO\u2082 (kg)" }), _jsx("th", { className: "px-3 py-2", children: "Avg Cost (USD)" }), _jsx("th", { className: "px-3 py-2", children: "Avg Latency (ms)" })] }) }), _jsxs("tbody", { children: [loading && (_jsx("tr", { children: _jsx("td", { className: "px-3 py-4 text-slate-400", colSpan: 5, children: "Loading\u2026" }) })), !loading &&
                                                    teamBoard.map((r) => (_jsxs("tr", { className: "odd:bg-white/0 even:bg-white/5", children: [_jsx("td", { className: "px-3 py-2 font-medium", children: r.team }), _jsx("td", { className: "px-3 py-2", children: r.num_entries }), _jsx("td", { className: "px-3 py-2", children: Number(r.avg_co2_kg).toFixed(3) }), _jsx("td", { className: "px-3 py-2", children: Number(r.avg_cost_usd).toFixed(4) }), _jsx("td", { className: "px-3 py-2", children: Number(r.avg_latency_ms).toFixed(0) })] }, r.team))), !loading && rows.length === 0 && (_jsx("tr", { children: _jsx("td", { className: "px-3 py-4 text-slate-400", colSpan: 4, children: "No data yet." }) }))] })] }) })] })] })] }));
}
/* ---------------- Route guard & App ---------------- */
function Protected({ children }) {
    const { session } = useAuth();
    if (!session)
        return _jsx(Navigate, { to: "/", replace: true });
    return _jsx(_Fragment, { children: children });
}
export default function App() {
    if (MISSING_ENV)
        return _jsx(MissingEnv, {});
    return (_jsx(ErrorBoundary, { children: _jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/chat", element: _jsx(Protected, { children: _jsx(ChatScreen, {}) }) }), _jsx(Route, { path: "/dashboard", element: _jsx(Protected, { children: _jsx(DashboardScreen, {}) }) })] }) }) }) }));
}
