"use client";

import { useRouter } from "next/navigation";

type IdleTimeoutAlertProps = {
  open: boolean;
  onDismiss: () => void;
};

export function IdleTimeoutAlert({ open, onDismiss }: IdleTimeoutAlertProps) {
  const router = useRouter();

  if (!open) return null;

  function goToLogin() {
    onDismiss();
    router.replace("/login");
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-alert-title"
      aria-describedby="idle-alert-desc"
      onClick={goToLogin}
    >
      <div
        className="w-full max-w-md rounded-xl border border-kp-border bg-kp-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="idle-alert-title" className="text-lg font-semibold text-kp-text">
          Alert
        </h2>
        <p id="idle-alert-desc" className="mt-3 text-sm leading-relaxed text-kp-muted">
          Your session has been timed out due to inactivity. Please login in again to continue.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={goToLogin}
            className="rounded-lg bg-kp-blue px-5 py-2 text-sm font-medium text-white hover:bg-kp-blue/90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
