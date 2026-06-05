import "driver.js/dist/driver.css";

import AIChatButton from "@/components/AIChatButton";
import { AuthProvider } from "@/components/AuthProvider";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import BetaBanner from "@/components/BetaBanner";
import DashboardAudioPlayer from "@/components/DashboardAudioPlayer";
import DashboardAuthGate from "@/components/DashboardAuthGate";
import OnboardingTour from "@/components/OnboardingTour";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { AudioProvider } from "@/contexts/AudioContext";
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
      <AuthProvider>
        <DashboardAuthGate>
          <AudioProvider>
            <div className="relative pb-32 md:pb-0">
              <DashboardAudioPlayer />
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
          </AudioProvider>
        </DashboardAuthGate>
        <OnboardingTour />
      </AuthProvider>
    </Suspense>
  );
}
