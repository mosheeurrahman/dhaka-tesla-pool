"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Nav from "@/components/layout/Nav";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Vine from "@/components/motifs/Vine";

export default function PassengerSignup() {
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
      await signup("passenger", form);
      router.push("/dashboard");
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
        <h1 className="font-display text-3xl font-bold text-rickshaw-green text-center mb-2">
          Hop in
        </h1>
        <p className="text-center text-ink/70 mb-6">Create your passenger account</p>
        <div className="flex justify-center mb-6">
          <Vine className="w-40 h-5" color="var(--color-rickshaw-green)" />
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

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating your account..." : "Find My Tesla"}
          </Button>
        </form>

        <p className="text-center text-sm text-ink/60 mt-6">
          Already riding with us?{" "}
          <Link href="/login" className="text-rickshaw-green font-semibold">
            Log in
          </Link>
        </p>
        <p className="text-center text-sm text-ink/60 mt-2">
          Are you a driver?{" "}
          <Link href="/driver/signup" className="text-rickshaw-green font-semibold">
            Sign up here
          </Link>
        </p>
      </section>
    </main>
  );
}