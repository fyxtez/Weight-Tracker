import { useEffect, useState } from "react";
import { api, type AuthUser } from "../api";
// Session restoration is isolated from presentation so auth routing remains easy to test and change.
export function useSession() {
    const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
    useEffect(() => {
        void api.restoreSession().then(setUser);
    }, []);
    return { user, setUser };
}
