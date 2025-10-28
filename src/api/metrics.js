import { supabase } from "../lib/supabaseClient";
/** Fixed team order for consistent UI. Adjust if your TeamName includes others. */
const TEAM_ORDER = ["ML", "Engineering", "Finance", "Research", "HR"];
/* =========================================================
   New function: Fetch from user_metrics view directly
   ========================================================= */
/** Fetch team averages directly from the user_metrics view */
export async function fetchTeamAveragesFromView() {
    try {
        const { data, error } = await supabase
            .from('user_metrics')
            .select('team, avg_cost_usd, avg_latency_ms, avg_co2_kg, num_entries');
        if (error) {
            console.error("[API] Error fetching from user_metrics view:", error);
            throw new Error(error.message);
        }
        if (!data || data.length === 0) {
            console.log("[API] No data found in user_metrics view");
            return [];
        }
        // Map the data to TeamAverages format
        const teamAverages = data.map((row) => ({
            team: row.team,
            num_entries: Number(row.num_entries ?? 0),
            avg_co2_kg: Number(row.avg_co2_kg ?? 0),
            avg_cost_usd: Number(row.avg_cost_usd ?? 0),
            avg_latency_ms: Number(row.avg_latency_ms ?? 0),
        }));
        // Sort according to TEAM_ORDER for consistent UI and include all teams
        const teamMap = new Map(teamAverages.map(t => [t.team, t]));
        const sortedTeams = TEAM_ORDER.map(team => teamMap.get(team) || {
            team,
            num_entries: 0,
            avg_co2_kg: 0,
            avg_cost_usd: 0,
            avg_latency_ms: 0,
        });
        console.log("[API] Fetched team averages from view (including teams with no data):", sortedTeams);
        return sortedTeams;
    }
    catch (err) {
        console.error("[API] Exception fetching team averages from view:", err);
        throw err;
    }
}
/* =========================================================
   Reads (Dashboard)
   ========================================================= */
/** Preferred: fetch via SECURITY DEFINER RPC (works with RLS). */
async function fetchTeamAveragesViaRpc() {
    const { data, error } = await supabase.rpc("get_team_averages");
    if (error) {
        // If the function doesn't exist, PostgREST returns a 404/No function — treat as "no RPC"
        if (/function/i.test(error.message))
            return null;
        throw new Error(error.message);
    }
    if (!data)
        return [];
    const byTeam = new Map();
    for (const r of data) {
        const row = {
            team: String(r.team),
            num_entries: Number(r.num_entries ?? 0),
            avg_co2_kg: Number(r.avg_co2_kg ?? 0),
            avg_cost_usd: Number(r.avg_cost_usd ?? 0),
            avg_latency_ms: Number(r.avg_latency_ms ?? 0),
        };
        byTeam.set(row.team, row);
    }
    return TEAM_ORDER.map(t => byTeam.get(t)).filter(Boolean);
}
/** Fallback: client-side join of user_metrics + profiles (limited by RLS to the current user’s row). */
async function fetchTeamAveragesViaClientJoin() {
    const { data: metrics, error: mErr } = await supabase
        .from("user_metrics")
        .select("user_id,total_co2_kg,total_cost_usd,total_latency_ms");
    if (mErr)
        throw new Error(mErr.message);
    if (!metrics || metrics.length === 0)
        return [];
    const userIds = Array.from(new Set(metrics.map(m => String(m.user_id))));
    if (userIds.length === 0)
        return [];
    const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id,team")
        .in("id", userIds);
    if (pErr)
        throw new Error(pErr.message);
    const teamByUser = new Map(profs.map(p => [String(p.id), p.team]));
    const acc = new Map();
    for (const m of metrics) {
        const uid = String(m.user_id);
        const team = teamByUser.get(uid);
        if (!team)
            continue;
        const a = acc.get(team) ?? { count: 0, co2: 0, cost: 0, lat: 0 };
        a.count += 1;
        a.co2 += Number(m.total_co2_kg ?? 0);
        a.cost += Number(m.total_cost_usd ?? 0);
        a.lat += Number(m.total_latency_ms ?? 0);
        acc.set(team, a);
    }
    const out = TEAM_ORDER
        .map(team => {
        const a = acc.get(team);
        if (!a || a.count === 0)
            return null;
        return {
            team,
            num_entries: a.count,
            avg_co2_kg: Number((a.co2 / a.count).toFixed(3)),
            avg_cost_usd: Number((a.cost / a.count).toFixed(4)),
            avg_latency_ms: Math.round(a.lat / a.count),
        };
    })
        .filter(Boolean);
    return out;
}
export async function fetchTeamAverages() {
    const viaRpc = await fetchTeamAveragesViaRpc();
    if (viaRpc !== null)
        return viaRpc; // null => RPC missing, otherwise use it
    return fetchTeamAveragesViaClientJoin();
}
export async function getMyProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        return null;
    const { data, error } = await supabase
        .from("profiles")
        .select("id, team, created_at")
        .eq("id", user.id)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    return (data ?? null);
}
export async function setMyTeam(team) {
    // Safest under RLS:
    const { error } = await supabase.rpc("set_my_team", { p_team: team });
    if (error)
        throw new Error(error.message);
}
/* =========================================================
   Per-user totals (writes)
   ========================================================= */
export async function upsertMyTotals(totals) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        throw new Error("Not signed in");
    const payload = { user_id: user.id, ...totals };
    const { error } = await supabase
        .from("user_metrics")
        .upsert([payload], { onConflict: "user_id" });
    if (error)
        throw new Error(error.message);
}
export async function bumpMyTotals(delta) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        throw new Error("Not signed in");
    const { data, error } = await supabase
        .from("user_metrics")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    const current = data ?? null;
    const next = {
        total_co2_kg: round((current?.total_co2_kg ?? 0) + (delta.co2_kg ?? 0)),
        total_cost_usd: round((current?.total_cost_usd ?? 0) + (delta.cost_usd ?? 0)),
        total_latency_ms: Math.round((current?.total_latency_ms ?? 0) + (delta.latency_ms ?? 0)),
    };
    await upsertMyTotals(next);
}
/* =========================================================
   Realtime helper (optional)
   ========================================================= */
/**
 * Subscribe to changes in user_metrics and get fresh team averages.
 * Returns an unsubscribe function.
 */
export function subscribeTeamAverages(onChange) {
    // initial fetch
    fetchTeamAverages().then(onChange).catch(console.error);
    const channel = supabase
        .channel("user_metrics_changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "user_metrics" }, async () => {
        try {
            const rows = await fetchTeamAverages();
            onChange(rows);
        }
        catch (e) {
            console.error(e);
        }
    })
        .subscribe();
    return () => {
        supabase.removeChannel(channel);
    };
}
/* ---------------- util ---------------- */
function round(n, dp = 4) {
    const p = Math.pow(10, dp);
    return Math.round(n * p) / p;
}
