import { redirect } from "next/navigation";

// Reports were merged into the CRA tab. Keep this path working for any
// existing links/bookmarks by redirecting.
export default function ReportsPage() {
  redirect("/dashboard/cra");
}
