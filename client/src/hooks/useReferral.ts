import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const REFERRAL_STORAGE_KEY = "auraly_pending_referral";

export function captureReferralCode() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) {
    localStorage.setItem(REFERRAL_STORAGE_KEY, ref.toUpperCase().trim());
    const url = new URL(window.location.href);
    url.searchParams.delete("ref");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
}

export function useReferralProcessor() {
  const { isAuthenticated } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || processed.current) return;

    const pendingCode = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!pendingCode) return;

    processed.current = true;
    localStorage.removeItem(REFERRAL_STORAGE_KEY);

    apiRequest("POST", "/api/referral/process", { referralCode: pendingCode })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          queryClient.invalidateQueries({ queryKey: ["/api/scan/quota"] });
          queryClient.invalidateQueries({ queryKey: ["/api/referral"] });
          console.log(`[REFERRAL] Successfully processed referral. Gained ${data.scansGranted} scans.`);
        }
      })
      .catch((err) => {
        console.log("[REFERRAL] Could not process referral:", err.message);
      });
  }, [isAuthenticated]);
}
