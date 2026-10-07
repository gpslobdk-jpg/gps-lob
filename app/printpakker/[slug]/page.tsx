import {
  ArrowLeft,
  Download,
  FileText,
  LockKeyhole,
  Printer,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SavedMaterialButton } from "@/components/printpakker/SavedMaterialButton";
import styles from "@/components/printpakker/PrintpakkerPage.module.css";
import { poppins, rubik } from "@/lib/fonts";
import {
  getCardDownloadActions,
  getPrintmaterial,
  PRINTMATERIALS,
  type PrintmaterialDownload,
} from "@/lib/printpakker/materials";
import { hasPrintpakkeDownloadSession } from "@/lib/printpakker/access";
import { getProtectedPrintpakkeDownload } from "@/lib/printpakker/downloads.server";
import {
  buildPrintpakkeDownloadHref,
  isPrintpakkeDownloadVariant,
} from "@/lib/printpakker/links";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ download?: string | string[]; fra?: string | string[] }>;
};

export function generateStaticParams() {
  return PRINTMATERIALS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { slug } = await params;
  const material = getPrintmaterial(slug);
  return material
    ? { title: `${material.title} - Printbibliotek - SkoleGPS`, description: material.description }
    : { title: "Materiale ikke fundet - Printbibliotek - SkoleGPS" };
}

function safeCatalogReturnPath(value: string | undefined) {
  if (!value) return "/printpakker";
  try {
    const parsed = new URL(value, "https://www.skolegps.dk");
    if (parsed.origin !== "https://www.skolegps.dk" || parsed.pathname !== "/printpakker") return "/printpakker";
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/printpakker";
  }
}

function DownloadIcon({ download }: { download: PrintmaterialDownload }) {
  if (download.cardAction === "answers" || download.variant.includes("answer-key")) {
    return <LockKeyhole aria-hidden="true" className="h-5 w-5" />;
  }
  if (download.cardAction === "whole" || download.variant.startsWith("whole")) {
    return <Printer aria-hidden="true" className="h-5 w-5" />;
  }
  if (download.variant.includes("teacher-guide")) {
    return <FileText aria-hidden="true" className="h-5 w-5" />;
  }
  return <Download aria-hidden="true" className="h-5 w-5" />;
}

export default async function PrintpakkeDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const material = getPrintmaterial(slug);
  if (!material) notFound();

  const query = await searchParams;
  const requestedDownload = Array.isArray(query.download) ? undefined : query.download;
  const returnPath = safeCatalogReturnPath(Array.isArray(query.fra) ? undefined : query.fra);

  // The public page stays public. After the existing safe login bridge has
  // returned a teacher here, the route handler independently verifies the
  // same session before serving a fixed manifest entry.
  if (requestedDownload && isPrintpakkeDownloadVariant(requestedDownload) && getProtectedPrintpakkeDownload(material.slug, requestedDownload)) {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && hasPrintpakkeDownloadSession(user)) {
        redirect(buildPrintpakkeDownloadHref(material.slug, requestedDownload));
      }
    } catch {
      // A missing local Supabase setup must not block the public catalogue.
    }
  }

  const cardDownloads = getCardDownloadActions(material);
  const otherDownloads = material.downloads.filter((download) => !download.cardAction);
  const relatedMaterials = material.relatedSlugs
    .map((relatedSlug) => getPrintmaterial(relatedSlug))
    .filter((related): related is NonNullable<typeof related> => Boolean(related));

  return (
    <main className={`${styles.page} ${poppins.className}`}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">SkoleGPS <span>Printbibliotek</span></Link>
        <nav aria-label="Printbibliotek-navigation" className={styles.nav}>
          <Link className={styles.navLink} href={returnPath}>Alle materialer</Link>
          <Link className={styles.navLink} href="/dashboard/laerervaerktoejer">Lærerværktøjer</Link>
        </nav>
      </header>

      <div className={styles.content}>
        <Link className={styles.backLink} href={returnPath}><ArrowLeft aria-hidden="true" className="h-4 w-4" />Tilbage til materialer</Link>

        <section className={styles.materialHeader} aria-labelledby="material-title">
          <div className={styles.materialPreview}>
            <Image
              alt={material.preview.thumbnailAlt}
              className={styles.materialPreviewImage}
              height={842}
              priority
              sizes="(min-width: 800px) 30vw, 90vw"
              src={material.preview.thumbnailUrl}
              unoptimized
              width={595}
            />
          </div>
          <div className={styles.materialIntro}>
            <p className={styles.eyebrow}>{material.subject} · {material.topic}</p>
            <h1 className={`${styles.materialTitle} ${rubik.className}`} id="material-title">{material.title}</h1>
            <p className={styles.materialDescription}>{material.detailDescription}</p>
            <ul className={styles.facts} aria-label="Materialets nøgleoplysninger">
              <li>{material.format}</li>
              <li>{material.gradeLevel}</li>
              <li>{material.duration}</li>
              {material.stationCount ? <li>{material.stationCount} poster</li> : null}
              <li>Version {material.contentVersion}</li>
            </ul>
            <p className={styles.materialStatus}>Redaktionel status: {material.contentStatus === "draft" ? "Udkast til lokal pilot" : "Eksisterende materiale"}.</p>
          </div>
        </section>

        <div className={styles.twoColumn}>
          <section className={styles.overview} aria-labelledby="fagligt-heading">
            <p className={styles.eyebrow}>Fagligt formål</p>
            <h2 id="fagligt-heading">Det arbejder eleverne med</h2>
            <ul className={styles.textList}>
              {material.learningIntentions.map((intention) => <li key={intention}>{intention}</li>)}
            </ul>

            {material.prerequisites.length > 0 ? (
              <>
                <h3>Det skal de kunne på forhånd</h3>
                <ul className={styles.textList}>
                  {material.prerequisites.map((prerequisite) => <li key={prerequisite}>{prerequisite}</li>)}
                </ul>
              </>
            ) : null}

            <h3>Sådan bruger du materialet</h3>
            <ol className={styles.numberedList}>
              {material.howToUse.map((step) => <li key={step}>{step}</li>)}
            </ol>

            <h3>Det skal printes</h3>
            <p>{material.printInstructions}</p>

            <details className={styles.curriculum}>
              <summary>Fagligt grundlag</summary>
              {material.curriculum.map((source) => (
                <p key={source.href}>
                  <strong>{source.source}</strong> · {source.status} · kontrolleret {source.checkedAt}. {source.note} {" "}
                  <a href={source.href} rel="noreferrer" target="_blank">Åbn kilden</a>
                </p>
              ))}
            </details>
          </section>

          <section className={styles.downloadPanel} aria-labelledby="download-heading">
            <p className={styles.eyebrow}>Filer</p>
            <h2 id="download-heading">Hent den rigtige fil</h2>
            <p className={styles.downloadIntro}>Downloads kræver SkoleGPS-lærerlogin. Elevmaterialet er uden facit; lærerfilerne er fortsat serverbeskyttede.</p>
            <div className={styles.primaryActions}>
              {cardDownloads.map((download) => (
                <a className={styles.primaryDownloadLink} href={buildPrintpakkeDownloadHref(material.slug, download.variant)} key={download.variant}>
                  <span><strong>{download.label}</strong><small>{download.description}</small></span>
                  <DownloadIcon download={download} />
                </a>
              ))}
              <SavedMaterialButton materialId={material.id} />
            </div>

            {otherDownloads.length > 0 ? (
              <details className={styles.secondaryDownloads}>
                <summary>Flere filer og blækbesparende udgaver</summary>
                <div className={styles.downloadList}>
                  {otherDownloads.map((download) => (
                    <a className={styles.downloadLink} href={buildPrintpakkeDownloadHref(material.slug, download.variant)} key={download.variant}>
                      <span><strong>{download.label}</strong><small>{download.description}</small></span>
                      <DownloadIcon download={download} />
                    </a>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>

        <section className={styles.previewSection} aria-labelledby="preview-heading">
          <p className={styles.eyebrow}>Facitfri forhåndsvisning</p>
          <h2 id="preview-heading">Se en rigtig opgaveside før login</h2>
          <p className={styles.previewIntro}>Previewet er udvalgte elevsider fra samme version som elevmaterialet. Det indeholder aldrig facit eller lærernoter.</p>
          <div className={styles.previewGrid}>
            {material.preview.pageImageUrls.map((imageUrl, index) => (
              <figure className={styles.previewCard} key={imageUrl}>
                <Image alt={material.preview.pageImageAlts[index] ?? material.preview.thumbnailAlt} className={styles.previewImage} height={842} sizes="(min-width: 640px) 42vw, 100vw" src={imageUrl} unoptimized width={595} />
                <figcaption>Facitfri elevside · version {material.preview.version}</figcaption>
              </figure>
            ))}
          </div>
          <a className={styles.previewLink} href={material.preview.publicPdfUrl} rel="noreferrer" target="_blank"><Download aria-hidden="true" className="h-4 w-4" />Åbn facitfri forhåndsvisning (PDF)</a>
        </section>

        {relatedMaterials.length > 0 ? (
          <section className={styles.relatedSection} aria-labelledby="related-heading">
            <p className={styles.eyebrow}>Samme familie</p>
            <h2 id="related-heading">Find også</h2>
            <div className={styles.relatedLinks}>
              {relatedMaterials.map((related) => <Link href={`/printpakker/${related.slug}`} key={related.slug}>{related.title}</Link>)}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
