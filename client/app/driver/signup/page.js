"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Nav from "@/components/layout/Nav";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Vine from "@/components/motifs/Vine";

export default function DriverSignup() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup("driver", form);
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
          Drive with us
        </h1>
        <p className="text-center text-ink/70 mb-6">Register your Tesla, join the fleet</p>
        <div className="flex justify-center mb-6">
          <Vine className="w-40 h-5" color="var(--color-rickshaw-red)" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full name"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
            {submitting ? "Setting up..." : "Join as a Driver"}
          </Button>
        </form>

        <p className="text-center text-sm text-ink/60 mt-6">
          Already driving?{" "}
          <Link href="/driver/login" className="text-rickshaw-red font-semibold">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}