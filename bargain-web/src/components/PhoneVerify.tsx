"use client";

import { useState } from "react";
import { sendPhoneCode, confirmPhoneCode, resetPhoneAuth } from "@/lib/firebase";

interface Props {
  phone: string;
  onVerified: (idToken: string) => void;
  onError?: (msg: string) => void;
  autoSend?: boolean;
  compact?: boolean;
}

/** Firebase Phone Auth OTP flow: reCAPTCHA → SMS code → ID token. */
export default function PhoneVerify({ phone, onVerified, onError, compact }: Props) {
  const [step, setStep] = useState<"idle" | "sending" | "sent" | "verifying" | "done">("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const fail = (msg: string) => {
    setError(msg);
    onError?.(msg);
    setStep(step === "verifying" ? "sent" : "idle");
  };

  const sendCode = async () => {
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setError("Enter a valid phone number with country code (e.g. +15551234567)");
      return;
    }
    setError("");
    setStep("sending");
    try {
      await sendPhoneCode(phone, "phone-recaptcha");
      setStep("sent");
    } catch (e: any) {
      resetPhoneAuth();
      const msg = e?.code === "auth/invalid-phone-number"
        ? "Invalid phone number"
        : e?.code === "auth/too-many-requests"
          ? "Too many attempts — try again later"
          : "Couldn't send SMS — check the number and try again";
      fail(msg);
    }
  };

  const verifyCode = async () => {
    setError("");
    setStep("verifying");
    try {
      const idToken = await confirmPhoneCode(code.trim());
      setStep("done");
      onVerified(idToken);
    } catch {
      fail("Wrong code — try again");
    }
  };

  return (
    <div className="space-y-2">
      {step !== "sent" && step !== "verifying" && step !== "done" && (
        <button
          type="button"
          onClick={sendCode}
          disabled={step === "sending"}
          className={compact
            ? "px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            : "w-full py-2 text-sm bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/15 disabled:opacity-50"}
        >
          {step === "sending" ? "Sending SMS…" : "Verify via SMS"}
        </button>
      )}
      {(step === "sent" || step === "verifying") && (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={verifyCode}
            disabled={code.length < 6 || step === "verifying"}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {step === "verifying" ? "…" : "Verify"}
          </button>
        </div>
      )}
      {step === "sent" && <p className="text-xs text-slate-400">Code sent to {phone}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div id="phone-recaptcha" />
    </div>
  );
}
