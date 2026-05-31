"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Script from "next/script";
import { Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TurnstileInstance = {
  render: (container: HTMLElement | string, options: Record<string, unknown>) => string;
  execute: (widgetId?: string) => void;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
  getResponse: (widgetId?: string) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

export function LoginForm() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  const turnstileEnabled = Boolean(turnstileSiteKey);

  const [ecode, setEcode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileScriptLoaded, setTurnstileScriptLoaded] = useState(!turnstileEnabled);
  const [turnstileReady, setTurnstileReady] = useState(!turnstileEnabled);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const resolveTokenRef = useRef<((token: string) => void) | null>(null);
  const rejectTokenRef = useRef<((error: Error) => void) | null>(null);

  function resetCaptcha() {
    const widgetId = widgetIdRef.current;
    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
    }

    resolveTokenRef.current = null;
    rejectTokenRef.current = null;
  }

  useEffect(() => {
    if (
      !turnstileEnabled ||
      !turnstileScriptLoaded ||
      !widgetContainerRef.current ||
      widgetIdRef.current ||
      !window.turnstile
    ) {
      return;
    }

    const widgetId = window.turnstile.render(widgetContainerRef.current, {
      sitekey: turnstileSiteKey,
      action: "login",
      execution: "execute",
      appearance: "execute",
      callback: (token: string) => {
        resolveTokenRef.current?.(token);
        resolveTokenRef.current = null;
        rejectTokenRef.current = null;
      },
      "error-callback": () => {
        rejectTokenRef.current?.(new Error("Captcha verification failed. Please try again."));
        resolveTokenRef.current = null;
        rejectTokenRef.current = null;
        setTurnstileReady(Boolean(widgetIdRef.current));
      },
      "expired-callback": () => {
        rejectTokenRef.current?.(new Error("Captcha expired. Please try again."));
        resolveTokenRef.current = null;
        rejectTokenRef.current = null;
        setTurnstileReady(Boolean(widgetIdRef.current));
      },
    });

    widgetIdRef.current = widgetId;
    setTurnstileReady(true);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      resolveTokenRef.current = null;
      rejectTokenRef.current = null;
    };
  }, [turnstileEnabled, turnstileScriptLoaded, turnstileSiteKey]);

  function getCaptchaToken() {
    if (!turnstileEnabled) {
      return Promise.resolve<string | null>(null);
    }

    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile) {
      return Promise.reject(new Error("Captcha is still loading. Please try again in a moment."));
    }

    const existingToken = window.turnstile.getResponse(widgetId);
    if (existingToken) {
      return Promise.resolve(existingToken);
    }

    return new Promise<string>((resolve, reject) => {
      resolveTokenRef.current = resolve;
      rejectTokenRef.current = reject;
      window.turnstile.execute(widgetId);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const token = await getCaptchaToken();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          ecode,
          password,
          "cf-turnstile-response": token,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (typeof data.warning === "string" && data.warning) {
          setNotice(data.warning);
        }
        if (Array.isArray(data.captchaErrors) && data.captchaErrors.length > 0) {
          setNotice(`Captcha error: ${data.captchaErrors.join(", ")}`);
        }

        throw new Error(data.message || "Login failed");
      }

      resetCaptcha();
      window.location.replace(`/dashboard?ts=${Date.now()}`);
    } catch (err) {
      resetCaptcha();
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
      if (turnstileEnabled) {
        setTurnstileReady(Boolean(widgetIdRef.current));
      }
    }
  }

  return (
    <>
      {turnstileEnabled ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => {
            setTurnstileScriptLoaded(true);
            setTurnstileReady(Boolean(widgetIdRef.current));
          }}
        />
      ) : null}

      <Card className="w-full max-w-md border-sky-200/70 bg-white/95 shadow-xl">
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
            <ShieldCheck className="h-4 w-4" />
            Secure Access
          </div>
          <CardTitle className="text-2xl">SRHU Guest House Booking</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Use your employee ecode credentials to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="ecode">Ecode</Label>
              <Input
                id="ecode"
                placeholder="EMP001"
                value={ecode}
                onChange={(e) => setEcode(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {turnstileEnabled ? (
              <div
                ref={widgetContainerRef}
                aria-hidden="true"
                className="pointer-events-none h-0 overflow-hidden"
              />
            ) : null}

            {notice ? <p className="text-sm font-medium text-amber-700">{notice}</p> : null}
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={loading || (turnstileEnabled && !turnstileReady)}>
              {loading ? "Signing in..." : turnstileEnabled && !turnstileReady ? "Loading security check..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
