import type { Metadata } from "next";
import { ExecDashboard } from "@/components/exec/ExecDashboard";

export const metadata: Metadata = { title: "Company pulse · CompanyOS Cortex" };

export default function ExecPage() {
  return <ExecDashboard />;
}
