import { redirect } from "next/navigation";

/** Alerts merged into AI Insights. */
export default function AlertsRedirect() {
  redirect("/dashboard/ai-insights");
}
