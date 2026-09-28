import { ArrowLeft, Download, FileText, LockKeyhole, Printer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import styles from "@/components/printpakker/PrintpakkerPage.module.css";
import { poppins, rubik } from "@/lib/fonts";
import { getPrintpakke, PRINTPAKKER } from "@/lib/printpakker/catalog";
import { hasPrintpakkeDownloadSession } from "@/lib/printpakker/access";
import {
  buildPrintpakkeDownloadHref,
  isPrintpakkeDownloadVariant,
} from "@/lib/printpakker/links";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ download?: string | string[] }>;
};

export function generateStaticParams() {
  return PRINTPAKKER.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { slug } = await params;
  const printpakke = getPrintpakke(slug);
  return printpakke
    ? { title: `${printpakke.title} - Printpakker - SkoleGPS`, description: printpakke.description }
    : { title: "Printpakke ikke fundet - SkoleGPS" };
}

const downloads = [
  { title: "Elevark", description: "Forside, seks poster og holdark uden svar.", variant: "student", icon: FileText },
  { title: "Hele pakken - farve", description: "Samlet lærerpakke med elevark, guide og facit.", variant: "whole-colour", icon: Printer },
  { title: "Hele pakken - blækbesparende", description: "Samme opgaver i en rolig sort-hvid udgave.", variant: "whole-ink-saver", icon: Printer },
  { title: "Facit", description: "Separat, kontrolleret løsningsark til læreren.", variant: "answer-key", icon: LockKeyhole },
  { title: "Lærervejledning", description: "Forberedelse, materialeliste og gennemførsel.", variant: "teacher-guide", icon: LockKeyhole },
] as const;

export default async function PrintpakkeDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const printpakke = getPrintpakke(slug);
  if (!printpakke) notFound();

  const requestedDownload = (await searchParams).download;
  const downloadVariant = Array.isArray(requestedDownload) ? undefined : requestedDownload;

  // The public page stays public. Only a successful safe-login return asks the
  // existing session for a download, and the route handler independently
  // verifies that same session before serving the file.
  if (downloadVariant && isPrintpakkeDownloadVariant(downloadVariant)) {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && hasPrintpakkeDownloadSession(user)) redirect(buildPrintpakkeDownloadHref(printpakke.slug, downloadVariant));
    } catch {
      // A missing local Supabase setup must not block the public catalogue.
    }
  }

  return (
    <main className={`${styles.page} ${poppins.className}`}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">SkoleGPS <span>Printpakker</span></Link>
        <nav aria-label="Printpakker-navigation" className={styles.nav}>
          <Link className={styles.navLink} href="/printpakker">Alle pakker</Link>
          <Link className={styles.navLink} href="/dashboard/laerervaerktoejer">Lærerværktøjer</Link>
        </nav>
      </header>

      <section className={styles.packageHero}>
        <Image
          alt="Et efterårsmysterie med kort, konvolut og små sporbrikker på et bord."
          className={styles.packageCover}
          fill
          priority
          sizes="100vw"
          src="/printpakker/afteraarsmysteriet-cover.png"
        />
        <div className={styles.packageOverlay}>
          <p className={styles.eyebrow}>Matematik · 5.-6. klasse</p>
          <h1 className={rubik.className}>{printpakke.title}</h1>
          <p>Den forsvundne lanterne er en komplet, analog mysteriejagt med seks korte matematikposter og et fælles spor at samle.</p>
          <ul className={styles.facts} aria-label="Pakkens nøgleoplysninger">
            <li>6 poster</li><li>{printpakke.duration}</li><li>Makkerarbejde</li><li>Version {printpakke.version}</li>
          </ul>
        </div>
      </section>

      <div className={styles.content}>
        <Link className={styles.navLink} href="/printpakker"><ArrowLeft aria-hidden="true" className="mr-1 inline h-4 w-4" />Tilbage til kataloget</Link>

        <div className={styles.twoColumn}>
          <section className={styles.overview} aria-labelledby="indhold-heading">
            <p className={styles.eyebrow}>Overblik</p>
            <h2 id="indhold-heading">Fra første ledetråd til fælles afsløring</h2>
            <p>Eleverne regner, forklarer og noterer ved seks stationer. Hver godkendt løsning giver læreren et spor at dele ud.</p>
            <ol className={styles.overviewList}>
              <li><span className={styles.stepNumber}>1</span><span><strong>Klargør.</strong> Print seks poster, holdark og lærerens sporbrikker.</span></li>
              <li><span className={styles.stepNumber}>2</span><span><strong>Arbejd i makkere.</strong> Hvert hold får tid til at vise sin strategi - ikke bare svaret.</span></li>
              <li><span className={styles.stepNumber}>3</span><span><strong>Saml mysteriet.</strong> Klassen bruger de seks udleverede brikker til den afsluttende besked.</span></li>
            </ol>
          </section>

          <section className={styles.downloadPanel} aria-labelledby="download-heading">
            <p className={styles.eyebrow}>Klar til print</p>
            <h2 id="download-heading">Vælg den rigtige mappe</h2>
            <p>Downloads kræver et SkoleGPS-lærerlogin. Elevmaterialet indeholder aldrig facit; lærerfilerne ligger bag en serverkontrolleret download.</p>
            <div className={styles.downloads}>
              {downloads.map((download) => {
                const Icon = download.icon;
                return (
                  <a className={styles.downloadLink} href={buildPrintpakkeDownloadHref(printpakke.slug, download.variant)} key={download.variant}>
                    <span><strong>{download.title}</strong><small>{download.description}</small></span>
                    <Icon aria-hidden="true" className="h-5 w-5 text-sky-700" />
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        <section className={styles.previewSection} aria-labelledby="preview-heading">
          <p className={styles.eyebrow}>Facitfri forhaandsvisning</p>
          <h2 id="preview-heading">Se formatet, før du logger ind.</h2>
          <p className={styles.previewIntro}>De to sider her er ægte renderinger af den offentlige forhåndsvisning. De viser kun forside og en elevpost - aldrig løsninger eller sporbrikker.</p>
          <div className={styles.previewGrid}>
            <figure className={styles.previewCard}>
              <Image alt="Første side af den facitfrie forhåndsvisning til Efterårsmysteriet." className={styles.previewImage} height={842} sizes="(min-width: 640px) 42vw, 100vw" src="/printpakker/previews/afteraarsmysteriet-preview-1.png" unoptimized width={595} />
              <figcaption>Forside og kort start til eleverne.</figcaption>
            </figure>
            <figure className={styles.previewCard}>
              <Image alt="Anden side af den facitfrie forhåndsvisning med en eksempelpost og skriveplads." className={styles.previewImage} height={842} sizes="(min-width: 640px) 42vw, 100vw" src="/printpakker/previews/afteraarsmysteriet-preview-2.png" unoptimized width={595} />
              <figcaption>Eksempelpost med reel skriveplads - uden svar.</figcaption>
            </figure>
          </div>
          <a className={styles.previewLink} href={printpakke.publicPreview} target="_blank" rel="noreferrer"><Download aria-hidden="true" className="h-4 w-4" />Åbn facitfri forhåndsvisning (PDF)</a>
        </section>

        <aside className={styles.builderCallout} aria-labelledby="byg-selv-detail-heading">
          <div>
            <p className={styles.eyebrow}>Byg selv</p>
            <h2 id="byg-selv-detail-heading">Vil du lave din egen analoge postrute?</h2>
            <p>Fysisk Stjerneløb bevares uændret som SkoleGPS&apos; eksisterende byg-selv-værktøj. Det er adskilt fra denne færdige pakke.</p>
          </div>
          <Link className={styles.builderLink} href="/dashboard/opret/stjerneloeb">Åbn Fysisk Stjerneløb <ArrowLeft aria-hidden="true" className="ml-1 h-4 w-4 rotate-180" /></Link>
        </aside>
      </div>
    </main>
  );
}
