"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { authStorage } from "@/lib/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = authStorage.getToken();
    const storedUser = authStorage.getUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  async function signup(role, formData) {
    const fn = role === "driver" ? api.driverSignup : api.passengerSignup;
    const { data } = await fn(formData);
    authStorage.save(data.token, data.user);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function login(role, formData) {
    const fn = role === "driver" ? api.driverLogin : api.passengerLogin;
    const { data } = await fn(formData);
    authStorage.save(data.token, data.user);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    authStorage.clear();
    setToken(null);
    setUser(null);
    router.push("/");
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}