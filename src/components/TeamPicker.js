import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { setMyTeam, getMyProfile } from "../api/metrics";
const TEAMS = ["ML", "Engineering", "Finance", "Research", "HR"];
export default function TeamPicker() {
    const [team, setTeam] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    useEffect(() => {
        (async () => {
            const p = await getMyProfile();
            if (p?.team)
                setTeam(p.team);
        })();
    }, []);
    async function save() {
        if (!team)
            return;
        setSaving(true);
        setMsg(null);
        try {
            await setMyTeam(team);
            setMsg("Saved!");
        }
        catch (e) {
            setMsg(e?.message ?? String(e));
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-xs text-slate-400", children: "Team" }), _jsxs("select", { className: "rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none", value: team, onChange: (e) => setTeam(e.target.value), children: [_jsx("option", { value: "", disabled: true, children: "Select team\u2026" }), TEAMS.map(t => _jsx("option", { value: t, children: t }, t))] }), _jsx("button", { onClick: save, disabled: !team || saving, className: "rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60", children: saving ? "Saving…" : "Save" }), msg && _jsx("span", { className: "text-xs text-slate-400 ml-2", children: msg })] }));
}
