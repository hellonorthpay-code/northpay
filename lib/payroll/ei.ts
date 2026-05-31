import { EI, EI_MAX_EMPLOYEE_PREMIUM } from "./constants";
import { round2 } from "@/lib/utils";

export function calculateEI(params: {
  insurableEarnings: number;
  ytdEi?: number;
}) {
  const { insurableEarnings, ytdEi = 0 } = params;
  let premium = insurableEarnings * EI.employeeRate;
  const remaining = EI_MAX_EMPLOYEE_PREMIUM - ytdEi;
  if (premium > remaining) premium = Math.max(0, remaining);
  return round2(premium);
}

export function calculateEIEmployer(employeePremium: number) {
  return round2(employeePremium * EI.employerMultiplier);
}
