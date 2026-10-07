import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PrintpakkerCatalog } from "@/components/printpakker/PrintpakkerCatalog";
import styles from "@/components/printpakker/PrintpakkerPage.module.css";
import { poppins, rubik } from "@/lib/fonts";
import { PRINTMATERIALS } from "@/lib/printpakker/materials";

export const metadata = {
  title: "Printbibliotek - SkoleGPS",
  description: "Printklare arbejdsark og postløb med tydelig faglighed, lige til at printe.",
};

export default function PrintpakkerPage() {
  return (
    <main className={`${styles.page} ${poppins.className}`}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">SkoleGPS <span>Printbibliotek</span></Link>
        <nav aria-label="Printbibliotek-navigation" className={styles.nav}>
          <Link className={styles.navLink} href="/dashboard/laerervaerktoejer">Lærerværktøjer</Link>
          <Link className={styles.navLink} href="/login?next=%2Fdashboard">Log ind</Link>
        </nav>
      </header>

      <div className={styles.content}>
        <header className={styles.libraryHeader}>
          <p className={styles.eyebrow}>SkoleGPS Printbibliotek</p>
          <h1 className={`${styles.libraryTitle} ${rubik.className}`}>Printklare arbejdsark og postløb.</h1>
          <p className={styles.libraryText}>Tydelig faglighed. Lige til at printe. Vælg et materiale, se et rigtigt preview og hent den fil, der passer til undervisningen.</p>
        </header>

        <PrintpakkerCatalog materials={PRINTMATERIALS} />

        <aside className={styles.builderCallout} aria-labelledby="byg-selv-heading">
          <div>
            <p className={styles.eyebrow}>Byg selv</p>
            <h2 id="byg-selv-heading">Har du en egen idé til et postløb?</h2>
            <p>Fysisk Stjerneløb er fortsat stedet, hvor du bygger et eget analogt løb. Printbiblioteket er de faste, redigerede materialer.</p>
          </div>
          <Link className={styles.builderLink} href="/dashboard/opret/stjerneloeb">Åbn Fysisk Stjerneløb <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link>
        </aside>
      </div>
    </main>
  );
}
