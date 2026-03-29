import AIChatButton from "@/components/AIChatButton";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import BetaBanner from "@/components/BetaBanner";
import DashboardAuthGate from "@/components/DashboardAuthGate";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense
      fallback={
        <AuthLoadingScreen
          title="Åbner dashboardet"
          description="Vi læser sessionen og gør kontroltårnet klar."
        />
      }
    >
      <DashboardAuthGate>
        <div className="relative pb-32 md:pb-0">
          <div className="print:hidden">
            <BetaBanner />
          </div>
          <div className="print:hidden">
            <DashboardHeader />
          </div>
          {children}
          <div className="print:hidden">
            <AIChatButton />
          </div>
        </div>
      </DashboardAuthGate>
    </Suspense>
  );
}
