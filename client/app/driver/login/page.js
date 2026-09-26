"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Nav from "@/components/layout/Nav";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function DriverLogin() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login("driver", form);
      router.push("/driver/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-md mx-auto px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-rickshaw-red text-center mb-2">
          Welcome back, driver
        </h1>
        <p className="text-center text-ink/70 mb-8">Log in to your dashboard</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          {error && <p className="text-rickshaw-red text-sm">{error}</p>}

          <Button type="submit" variant="secondary" className="w-full" disabled={submitting}>
            {submitting ? "Logging in..." : "Log In"}
          </Button>
        </form>

        <p className="text-center text-sm text-ink/60 mt-6">
          New driver?{" "}
          <Link href="/driver/signup" className="text-rickshaw-red font-semibold">
            Register here
          </Link>
        </p>
      </section>
    </main>
  );
}