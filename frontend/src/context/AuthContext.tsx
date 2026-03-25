"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fcl } from "@/lib/fcl";

interface FclService {
  uid?: string;
  provider?: { name?: string; id?: string };
  [key: string]: unknown;
}

interface FclUser {
  loggedIn?: boolean | null;
  addr?: string | null;
  services?: FclService[];
}

export interface AuthContextValue {
  user: FclUser;
  isLoggedIn: boolean;
  isLoading: boolean;
  isDapper: boolean;
  address: string | null;
  logIn: () => void;
  logOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function detectDapper(services?: FclService[]): boolean {
  if (!services) return false;
  return services.some(
    (s) =>
      s.uid?.toLowerCase().includes("dapper") ||
      s.provider?.name?.toLowerCase().includes("dapper") ||
      s.provider?.id?.toLowerCase().includes("dapper"),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // loggedIn starts as null (unknown) until FCL fires the first subscription event
  const [user, setUser] = useState<FclUser>({ loggedIn: null, addr: null });

  useEffect(() => {
    // FCL's internal CurrentUser type is narrower than our interface — cast via any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = fcl.currentUser.subscribe((u: any) => setUser(u));

    // FCL can get stuck at loggedIn:null in some environments (e.g. React
    // StrictMode double-invoke). snapshot() resolves the current state
    // immediately and serves as a reliable fallback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fcl.currentUser.snapshot().then((u: any) => setUser(u));

    return () => unsubscribe();
  }, []);

  // FCL 1.21+ keeps loggedIn:null indefinitely when no session exists —
  // it does NOT auto-resolve to false. Treat null as "not authenticated".
  // The subscription fires again with loggedIn:true if a stored session exists.
  const isLoading = false;
  const isLoggedIn = user.loggedIn === true;

  const isDapper = isLoggedIn ? detectDapper(user.services) : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        isLoading,
        isDapper,
        address: user.addr ?? null,
        logIn: fcl.authenticate,
        logOut: fcl.unauthenticate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
