import { useEffect, useState, useCallback } from "react";
import { fetchTeamAverages } from "../api/metrics";
export function useTeamAverages() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await fetchTeamAverages();
            setData(rows);
        }
        catch (e) {
            setError(e?.message ?? String(e));
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    return { data, error, loading, reload: load };
}
