import { redirect } from "next/navigation";

// The tab was called Live before it was called Paystubs. Anything already
// bookmarked or linked keeps working.
export default function LiveRedirect() {
  redirect("/dashboard/paystubs");
}
