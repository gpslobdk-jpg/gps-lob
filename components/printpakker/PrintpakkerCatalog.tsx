"use client";

import { ChevronDown, Download, LockKeyhole, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getPrintpakkeFilterOptions,
  type Printpakke,
} from "@/lib/printpakker/catalog";
import { buildPrintpakkeDownloadHref } from "@/lib/printpakker/links";

import styles from "./PrintpakkerCatalog.module.css";

type PrintpakkerCatalogProps = {
  printpakker: readonly Printpakke[];
};

const downloadActions = [
  { label: "Hele pakken", variant: "whole-colour" },
  { label: "Elevark", variant: "student" },
  { label: "Facit", variant: "answer-key" },
  { label: "Lærervejledning", variant: "teacher-guide" },
] as const;

export function PrintpakkerCatalog({ printpakker }: PrintpakkerCatalogProps) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [activityType, setActivityType] = useState("");
  const [openMenuSlug, setOpenMenuSlug] = useState<string | null>(null);
  const menuButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const filterOptions = getPrintpakkeFilterOptions(printpakker);

  const visiblePrintpakker = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("da-DK");

    return printpakker.filter((printpakke) => {
      const matchesQuery = !normalizedQuery || [
        printpakke.title,
        printpakke.description,
        printpakke.subject,
        printpakke.gradeLevel,
        printpakke.activityType,
      ].some((value) => value.toLocaleLowerCase("da-DK").includes(normalizedQuery));

      return matchesQuery
        && (!subject || printpakke.subject === subject)
        && (!gradeLevel || printpakke.gradeLevel === gradeLevel)
        && (!activityType || printpakke.activityType === activityType);
    });
  }, [activityType, gradeLevel, printpakker, query, subject]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !openMenuSlug) return;
      event.preventDefault();
      const slug = openMenuSlug;
      setOpenMenuSlug(null);
      requestAnimationFrame(() => menuButtons.current[slug]?.focus());
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [openMenuSlug]);

  return (
    <section className={styles.shell} aria-labelledby="printpakker-catalogue-heading">
      <h2 className="sr-only" id="printpakker-catalogue-heading">Find en færdig undervisningspakke</h2>

      <div className={styles.controls}>
        <label className={styles.search}>
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-sky-700" />
          <span className="sr-only">Søg i Printpakker</span>
          <input
            className={styles.searchInput}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søg efter fag, klassetrin eller aktivitet"
            type="search"
            value={query}
          />
        </label>

        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            Fag
            <select className={styles.filterSelect} onChange={(event) => setSubject(event.target.value)} value={subject}>
              <option value="">Alle fag</option>
              {filterOptions.subjects.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.filterLabel}>
            Klassetrin
            <select className={styles.filterSelect} onChange={(event) => setGradeLevel(event.target.value)} value={gradeLevel}>
              <option value="">Alle klassetrin</option>
              {filterOptions.gradeLevels.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.filterLabel}>
            Aktivitet
            <select className={styles.filterSelect} onChange={(event) => setActivityType(event.target.value)} value={activityType}>
              <option value="">Alle aktiviteter</option>
              {filterOptions.activityTypes.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.results} aria-live="polite">
        {visiblePrintpakker.length === 0 ? (
          <div className={styles.empty}>
            <p className="font-black text-slate-800">Ingen pakker matcher lige nu.</p>
            <p className="mt-2 text-sm leading-6">Prøv et andet søgeord eller nulstil et af de tre filtre.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {visiblePrintpakker.map((printpakke) => {
              const isOpen = openMenuSlug === printpakke.slug;
              return (
                <article
                  className={`${styles.card}${isOpen ? ` ${styles.cardOpen}` : ""}`}
                  key={printpakke.slug}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenuSlug(null);
                  }}
                  onMouseLeave={() => setOpenMenuSlug(null)}
                >
                  <Link aria-label={`Se pakken ${printpakke.title}`} className={styles.cardImageLink} href={`/printpakker/${printpakke.slug}`}>
                    <Image
                      alt={printpakke.illustrationAlt}
                      className={styles.cardImage}
                      fill
                      sizes="(min-width: 960px) 42vw, 100vw"
                      src={printpakke.illustration}
                    />
                    <span className={styles.paperTag}>Færdig pakke</span>
                  </Link>

                  <div className={styles.cardBody}>
                    <Link className={styles.titleLink} href={`/printpakker/${printpakke.slug}`}>
                      {printpakke.title}
                    </Link>
                    <p className={styles.description}>{printpakke.description}</p>
                    <ul className={styles.metadata} aria-label={`Oplysninger om ${printpakke.title}`}>
                      <li>{printpakke.subject}</li>
                      <li>{printpakke.gradeLevel}</li>
                      <li>{printpakke.duration}</li>
                    </ul>

                    <div className={styles.menuRow}>
                      <span className={styles.readyLabel}>Klar til print</span>
                      <button
                        aria-controls={`printpakke-actions-${printpakke.slug}`}
                        aria-expanded={isOpen}
                        className={styles.menuButton}
                        onClick={() => setOpenMenuSlug(isOpen ? null : printpakke.slug)}
                        ref={(element) => { menuButtons.current[printpakke.slug] = element; }}
                        type="button"
                      >
                        Materialer
                        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition${isOpen ? " rotate-180" : ""}`} />
                      </button>
                    </div>

                    <div className={styles.quickActions} id={`printpakke-actions-${printpakke.slug}`}>
                      {downloadActions.map((action) => (
                        <a
                          className={styles.action}
                          href={buildPrintpakkeDownloadHref(printpakke.slug, action.variant)}
                          key={action.variant}
                        >
                          <span>{action.label}</span>
                          {action.variant === "student" ? (
                            <Download aria-hidden="true" className="h-4 w-4 text-sky-700" />
                          ) : (
                            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-sky-700" />
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
