"use client";

import {
  Bookmark,
  ChevronDown,
  Download,
  FileStack,
  LockKeyhole,
  RotateCcw,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildPrintpakkeDownloadHref } from "@/lib/printpakker/links";
import {
  getCardDownloadActions,
  getPrintmaterialFilterOptions,
  type Printmaterial,
  type PrintmaterialDownload,
} from "@/lib/printpakker/materials";
import {
  dispatchSavedMaterials,
  readSavedMaterialIds,
  SAVED_MATERIALS_EVENT,
  writeSavedMaterialIds,
} from "@/lib/printpakker/savedMaterials";

import { SavedMaterialButton } from "./SavedMaterialButton";
import styles from "./PrintpakkerCatalog.module.css";

type PrintpakkerCatalogProps = {
  materials: readonly Printmaterial[];
};

type FilterState = {
  format: string;
  gradeLevel: string;
  query: string;
  subject: string;
  topic: string;
};

const emptyFilters: FilterState = {
  query: "",
  subject: "",
  gradeLevel: "",
  topic: "",
  format: "",
};

function filtersFromLocation(): FilterState {
  if (typeof window === "undefined") return emptyFilters;
  const params = new URLSearchParams(window.location.search);
  return {
    query: params.get("q") ?? "",
    subject: params.get("fag") ?? "",
    gradeLevel: params.get("trin") ?? "",
    topic: params.get("emne") ?? "",
    format: params.get("format") ?? "",
  };
}

function hasActiveFilters(filters: FilterState) {
  return Object.values(filters).some(Boolean);
}

function catalogHref(slug: string, filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.subject) params.set("fag", filters.subject);
  if (filters.gradeLevel) params.set("trin", filters.gradeLevel);
  if (filters.topic) params.set("emne", filters.topic);
  if (filters.format) params.set("format", filters.format);
  const query = params.toString();
  return query ? `/printpakker/${slug}?fra=${encodeURIComponent(`/printpakker?${query}`)}` : `/printpakker/${slug}`;
}

function ActionIcon({ action }: { action: PrintmaterialDownload }) {
  if (action.cardAction === "answers") return <LockKeyhole aria-hidden="true" className="h-4 w-4" />;
  if (action.cardAction === "whole") return <FileStack aria-hidden="true" className="h-4 w-4" />;
  return <Download aria-hidden="true" className="h-4 w-4" />;
}

export function PrintpakkerCatalog({ materials }: PrintpakkerCatalogProps) {
  const [filters, setFilters] = useState<FilterState>(filtersFromLocation);
  const [openMenuSlug, setOpenMenuSlug] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const menuButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const filterOptions = getPrintmaterialFilterOptions(materials);
  const savedIdSet = useMemo(() => new Set(savedIds), [savedIds]);

  useEffect(() => {
    function readSaved() {
      try {
        setSavedIds(readSavedMaterialIds(window.localStorage));
      } catch {
        setStorageMessage("Mine gemte kan ikke læses i denne browser.");
      }
    }

    function handleSavedMaterials(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      if (Array.isArray(detail) && detail.every((id) => typeof id === "string")) {
        setSavedIds(detail);
      }
    }

    readSaved();
    window.addEventListener(SAVED_MATERIALS_EVENT, handleSavedMaterials);
    return () => window.removeEventListener(SAVED_MATERIALS_EVENT, handleSavedMaterials);
  }, []);

  useEffect(() => {
    function handlePopState() {
      setFilters(filtersFromLocation());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.subject) params.set("fag", filters.subject);
    if (filters.gradeLevel) params.set("trin", filters.gradeLevel);
    if (filters.topic) params.set("emne", filters.topic);
    if (filters.format) params.set("format", filters.format);
    const nextUrl = params.size > 0 ? `/printpakker?${params.toString()}` : "/printpakker";
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [filters]);

  const visibleMaterials = useMemo(() => {
    const normalizedQuery = filters.query.trim().toLocaleLowerCase("da-DK");

    return materials.filter((material) => {
      const matchesQuery = !normalizedQuery || [
        material.title,
        material.description,
        material.subject,
        material.gradeLevel,
        material.topic,
        material.format,
      ].some((value) => value.toLocaleLowerCase("da-DK").includes(normalizedQuery));

      return matchesQuery
        && (!filters.subject || material.subject === filters.subject)
        && (!filters.gradeLevel || material.gradeLevel === filters.gradeLevel)
        && (!filters.topic || material.topic === filters.topic)
        && (!filters.format || material.format === filters.format)
        && (!showSaved || savedIdSet.has(material.id));
    });
  }, [filters, materials, savedIdSet, showSaved]);

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

  function updateFilter<Key extends keyof FilterState>(key: Key, value: FilterState[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
  }

  function clearSavedMaterials() {
    try {
      const ids = writeSavedMaterialIds(window.localStorage, []);
      setSavedIds(ids);
      setShowSaved(false);
      setStorageMessage("Mine gemte er ryddet i denne browser.");
      dispatchSavedMaterials(ids);
    } catch {
      setStorageMessage("Kunne ikke rydde Mine gemte i denne browser.");
    }
  }

  const resultLabel = `${visibleMaterials.length} ${visibleMaterials.length === 1 ? "materiale" : "materialer"}${showSaved ? " i Mine gemte" : ""}`;

  return (
    <section className={styles.shell} aria-labelledby="printbibliotek-catalogue-heading">
      <h2 className="sr-only" id="printbibliotek-catalogue-heading">Find et materiale i Printbiblioteket</h2>

      <div className={styles.controls}>
        <label className={styles.search}>
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-sky-700" />
          <span className="sr-only">Søg i Printbiblioteket</span>
          <input
            className={styles.searchInput}
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Søg efter fag, trin, emne eller format"
            type="search"
            value={filters.query}
          />
        </label>

        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            Fag
            <select className={styles.filterSelect} onChange={(event) => updateFilter("subject", event.target.value)} value={filters.subject}>
              <option value="">Alle fag</option>
              {filterOptions.subjects.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.filterLabel}>
            Trin
            <select className={styles.filterSelect} onChange={(event) => updateFilter("gradeLevel", event.target.value)} value={filters.gradeLevel}>
              <option value="">Alle trin</option>
              {filterOptions.gradeLevels.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.filterLabel}>
            Emne
            <select className={styles.filterSelect} onChange={(event) => updateFilter("topic", event.target.value)} value={filters.topic}>
              <option value="">Alle emner</option>
              {filterOptions.topics.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.filterLabel}>
            Format
            <select className={styles.filterSelect} onChange={(event) => updateFilter("format", event.target.value)} value={filters.format}>
              <option value="">Alle formater</option>
              {filterOptions.formats.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.catalogueTools}>
        <p aria-atomic="true" aria-live="polite" className={styles.resultCount}>{resultLabel}</p>
        <div className={styles.catalogueToolActions}>
          <button
            aria-pressed={showSaved}
            className={styles.savedFilterButton}
            onClick={() => setShowSaved((current) => !current)}
            type="button"
          >
            <Bookmark aria-hidden="true" className="h-4 w-4" />
            Mine gemte
          </button>
          {hasActiveFilters(filters) ? (
            <button className={styles.resetButton} onClick={clearFilters} type="button">
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Nulstil filtre
            </button>
          ) : null}
          {savedIds.length > 0 ? (
            <button className={styles.resetButton} onClick={clearSavedMaterials} type="button">Ryd gemte</button>
          ) : null}
        </div>
      </div>
      {storageMessage ? <p aria-live="polite" className={styles.storageMessage}>{storageMessage}</p> : null}

      <div className={styles.results}>
        {visibleMaterials.length === 0 ? (
          <div className={styles.empty}>
            <p className="font-black text-slate-800">Ingen materialer matcher lige nu.</p>
            <p className="mt-2 text-sm leading-6">Prøv et andet søgeord, vælg færre filtre eller nulstil filtrene.</p>
            {hasActiveFilters(filters) ? <button className={styles.resetButton} onClick={clearFilters} type="button">Nulstil filtre</button> : null}
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleMaterials.map((material) => {
              const isOpen = openMenuSlug === material.slug;
              const cardActions = getCardDownloadActions(material);
              const detailHref = catalogHref(material.slug, filters);
              return (
                <article
                  className={`${styles.card}${isOpen ? ` ${styles.cardOpen}` : ""}`}
                  key={material.id}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenuSlug(null);
                  }}
                >
                  <Link aria-label={`Se materialet ${material.title}`} className={styles.cardImageLink} href={detailHref}>
                    <Image
                      alt={material.preview.thumbnailAlt}
                      className={styles.cardImage}
                      height={842}
                      sizes="(min-width: 1280px) 23vw, (min-width: 900px) 30vw, (min-width: 640px) 46vw, 100vw"
                      src={material.preview.thumbnailUrl}
                      unoptimized
                      width={595}
                    />
                    <span className={styles.paperTag}>{material.format}</span>
                  </Link>

                  <div className={styles.cardBody}>
                    <Link className={styles.titleLink} href={detailHref}>{material.title}</Link>
                    <p className={styles.description}>{material.description}</p>
                    <ul className={styles.metadata} aria-label={`Oplysninger om ${material.title}`}>
                      <li>{material.subject}</li>
                      <li>{material.gradeLevel}</li>
                      <li>{material.duration}</li>
                    </ul>

                    <div className={styles.menuRow}>
                      <span className={styles.readyLabel}>{material.topic}</span>
                      <button
                        aria-controls={`printmaterial-actions-${material.slug}`}
                        aria-expanded={isOpen}
                        className={styles.menuButton}
                        onClick={() => setOpenMenuSlug((current) => current === material.slug ? null : material.slug)}
                        ref={(element) => { menuButtons.current[material.slug] = element; }}
                        type="button"
                      >
                        Materialer
                        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition${isOpen ? " rotate-180" : ""}`} />
                      </button>
                    </div>

                    <div className={styles.quickActions} hidden={!isOpen} id={`printmaterial-actions-${material.slug}`}>
                      {cardActions.map((action) => (
                        <a className={styles.action} href={buildPrintpakkeDownloadHref(material.slug, action.variant)} key={action.variant}>
                          <span>{action.label}</span>
                          <ActionIcon action={action} />
                        </a>
                      ))}
                      <SavedMaterialButton materialId={material.id} />
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
