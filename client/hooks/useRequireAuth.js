"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function useRequireAuth(requiredRole) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(requiredRole === "driver" ? "/driver/login" : "/login");
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.replace("/");
    }
  }, [user, loading, requiredRole, router]);

  return { user, loading };
}