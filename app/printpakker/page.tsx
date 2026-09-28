import { ArrowRight, Printer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PrintpakkerCatalog } from "@/components/printpakker/PrintpakkerCatalog";
import styles from "@/components/printpakker/PrintpakkerPage.module.css";
import { poppins, rubik } from "@/lib/fonts";
import { PRINTPAKKER } from "@/lib/printpakker/catalog";

export const metadata = {
  title: "Printpakker - SkoleGPS",
  description: "Færdige analoge undervisningspakker klar til print.",
};

export default function PrintpakkerPage() {
  return (
    <main className={`${styles.page} ${poppins.className}`}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">SkoleGPS <span>Printpakker</span></Link>
        <nav aria-label="Printpakker-navigation" className={styles.nav}>
          <Link className={styles.navLink} href="/dashboard/laerervaerktoejer">Lærerværktøjer</Link>
          <Link className={styles.navLink} href="/login?next=%2Fdashboard">Log ind</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <Image
          alt="Elever arbejder sammen om et papirbaseret efterårsmysterie i skolegården."
          className={styles.heroImage}
          fill
          priority
          sizes="100vw"
          src="/printpakker/afteraarsmysteriet-hero.png"
        />
        <div aria-hidden="true" className={styles.heroShade} />
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>SkoleGPS Printpakker</p>
          <h1 className={`${styles.heroTitle} ${rubik.className}`}>Færdige pakker, der får papir og nysgerrighed i gang.</h1>
          <p className={styles.heroText}>
            Analoge undervisningspakker med gennemtænkte materialer, smukke print og en enkel start: print, del ud og gå i gang.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.button} href="#katalog"><Printer aria-hidden="true" className="h-4 w-4" />Se færdige pakker</a>
            <Link className={styles.quietButton} href="/dashboard/opret/stjerneloeb">Byg selv med Fysisk Stjerneløb <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <div className={styles.content} id="katalog">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Katalog</p>
          <h2 className={`${styles.sectionTitle} ${rubik.className}`}>Vælg et forløb, der er klar til klassen.</h2>
          <p className={styles.sectionText}>Hver pakke samler elevark, lærervejledning og kontrolleret facit. Vælg materialerne direkte fra kortet eller se hele pakken først.</p>
        </div>
        <div className="mt-7">
          <PrintpakkerCatalog printpakker={PRINTPAKKER} />
        </div>

        <aside className={styles.builderCallout} aria-labelledby="byg-selv-heading">
          <div>
            <p className={styles.eyebrow}>Byg selv</p>
            <h2 id="byg-selv-heading">Har du allerede din egen idé?</h2>
            <p>Fysisk Stjerneløb er stadig stedet, hvor du selv bygger et analogt løb til print. Printpakker er de færdige forløb.</p>
          </div>
          <Link className={styles.builderLink} href="/dashboard/opret/stjerneloeb">Åbn Fysisk Stjerneløb <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link>
        </aside>
      </div>
    </main>
  );
}
