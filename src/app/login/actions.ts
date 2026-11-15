"use server";
import { db } from "@/lib/db";
import { createSession, limit, verifyPassword } from "@/lib/auth";
import { redirect } from "next/navigation";
import { z } from "zod";
export async function login(_: { error: string }, form: FormData) {
  const parsed = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(128) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  try {
    await limit("login:" + parsed.data.email.toLowerCase(), 10);
    const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || user.disabled || !verifyPassword(parsed.data.password, user.passwordHash)) return { error: "Email or password is incorrect." };
    await createSession(user.id);
  } catch { return { error: "Sign in unavailable or too many attempts. Please try again later." }; }
  redirect("/dashboard");
}
