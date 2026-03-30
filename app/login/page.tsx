import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">SRHU</p>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          SRHU GUEST HOUSE BOOKING
        </h1>
        <p className="text-sm text-slate-500">Sign in to manage guest house bookings.</p>
      </div>
      <LoginForm />
    </main>
  );
}
