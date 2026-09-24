import styles from "./PisaNotice.module.css";

export type PisaNoticeLinks = {
  classroom: string;
  worksheets: string;
  gps: string;
};

type PisaNoticeProps = {
  className?: string;
  links: PisaNoticeLinks;
};

const SOURCES = {
  results:
    "https://uvm.dk/ministeriet/internationalt-arbejde/internationale-undersoegelser/om-pisa/pisa-2025/",
  digital:
    "https://www.oecd.org/en/publications/pisa-2025-results-volume-i_73451bc5-en/full-report/student-school-life-and-beyond_861e5904.html",
  danish:
    "https://www.vive.dk/da/nyheder-og-debat/2026/danske-elevers-pisa-resultater-fortsaetter-med-at-falde/",
};

/**
 * Afgrænset forsidebanner. Indsæt én gang umiddelbart efter det eksisterende
 * mobiltelefonbanner i den samme indholdscontainer.
 *
 * Native <details> virker uden komponent-state, cookies, netværkskald eller
 * nye afhængigheder. Links er obligatoriske, så forsiden beholder sine
 * verificerede login- og SSO-indgange.
 */
export default function PisaNotice({ className, links }: PisaNoticeProps) {
  return (
    <section
      className={[styles.notice, className].filter(Boolean).join(" ")}
      aria-label="PISA 2025 og SkoleGPS"
      data-testid="pisa-notice"
    >
      <details className={styles.disclosure}>
        <summary className={styles.summary}>
          <span className={styles.copy}>
            <span className={styles.eyebrow}>PISA 2025</span>
            <span className={styles.title}>Mere fordybelse. Mere faglighed.</span>
            <span className={styles.description}>
              Se, hvordan du kan bruge SkoleGPS-familien til fokustid, arbejde på papir
              og aktive opgaver med et tydeligt fagligt formål.
            </span>
          </span>
          <span className={styles.action}>
            <span className={styles.whenClosed}>Se mulighederne</span>
            <span className={styles.whenOpen}>Luk forklaringen</span>
            <span className={styles.chevron} aria-hidden="true">⌄</span>
          </span>
        </summary>

        <div className={styles.content}>
          <header className={styles.intro}>
            <h2>Tre måder at sætte fagligheden først</h2>
            <p>
              Danske 15-åriges resultater er gået tilbage i læsning, matematik og naturfag.
              {" "}<a href={SOURCES.results} aria-label="Kilde 1: Undervisningsministeriets hovedresultater">[1]</a>
              {" "}PISA 2025 viser også elevers rapporter om digital distraktion og fald i vedholdenhed.
              {" "}<a href={SOURCES.digital} aria-label="Kilde 2: OECD om digital brug og skoleliv">[2]</a>
              {" "}<a href={SOURCES.danish} aria-label="Kilde 3: VIVE om de danske resultater">[3]</a>
              {" "}Her er vores forslag til at arbejde med de udfordringer i undervisningen.
            </p>
          </header>

          <div className={styles.grid}>
            <article className={styles.card}>
              <p className={styles.tool}>DagensTavle</p>
              <h3>Saml klassen om én opgave</h3>
              <p>
                Brug DagensTavle til at samle dagens program og klasseaktiviteter på skærmen.
                Eleverne kan arbejde med bog, papir eller materialer, mens læreren gør næste
                skridt tydeligt.
              </p>
              <p className={styles.example}>
                <strong>Prøv i timen:</strong> Vis et læsemål, giv tid til fordybelse,
                og saml op på, hvordan eleverne fandt svaret i teksten.
              </p>
              <a className={styles.toolLink} href={links.classroom}>
                Åbn DagensTavle <span aria-hidden="true">→</span>
              </a>
            </article>

            <article className={styles.card}>
              <p className={styles.tool}>PrintMitArbejdsark</p>
              <h3>Giv plads til arbejdet på papir</h3>
              <p>
                Brug printbare arbejdsark til faglig øvelse uden en skærm foran hver elev.
                Bed eleverne forklare, hvordan de fandt svaret — ikke kun udfylde facit.
              </p>
              <p className={styles.example}>
                <strong>Prøv i timen:</strong> Vælg få opgaver, og tilføj lærerens spørgsmål:
                “Hvordan ved du det?” eller “Kan du vise en anden løsning?”
              </p>
              <a className={styles.toolLink} href={links.worksheets}>
                Åbn PrintMitArbejdsark <span aria-hidden="true">→</span>
              </a>
            </article>

            <article className={styles.card}>
              <p className={styles.tool}>SkoleGPS-løb</p>
              <h3>Brug faget i virkeligheden</h3>
              <p>
                Planlæg lærerstyrede opgaver, hvor eleverne observerer, måler, læser eller
                undersøger omgivelserne. Lad dem tale om svarene og begrunde dem i den fælles
                opsamling.
              </p>
              <p className={styles.example}>
                <strong>Prøv i timen:</strong> Lad eleverne måle et område, beregne arealet
                og forklare deres fremgangsmåde. Point er ikke målet i sig selv.
              </p>
              <p className={styles.caution}>
                Et digitalt GPS-løb er ikke skærmfrit. Planlæg brugen af enheder inden for skolens rammer.
              </p>
              <a className={styles.toolLink} href={links.gps}>
                Gå til lærerområdet <span aria-hidden="true">→</span>
              </a>
            </article>
          </div>

          <div className={styles.principle}>
            <strong>Vores princip: Skærmen skal have et tydeligt fagligt formål.</strong>
            <p>
              Brug den, når den hjælper undervisningen — og læg den væk, når opgaven kalder på
              læsning, samtale eller arbejde med hænderne. Eventuel AI kan hjælpe lærerens
              forberedelse, men skal ikke overtage elevens tænkning.
            </p>
          </div>

          <footer className={styles.sources}>
            <h3>Kilder og afgrænsning</h3>
            <p>
              <a href={SOURCES.results}>[1] Undervisningsministeriet: PISA 2025</a>
              <br />
              <a href={SOURCES.digital}>[2] OECD: Digital brug og skoleliv, PISA 2025</a>
              <br />
              <a href={SOURCES.danish}>[3] VIVE: Danske elevers PISA-resultater</a>
            </p>
            <p>
              PISA undersøger 15-årige og er ikke en effektevaluering af SkoleGPS.
              Koblingen til værktøjerne er vores pædagogiske vurdering, ikke en anbefaling
              fra OECD eller VIVE. Der loves ikke bedre PISA-resultater.
              Sammenhænge i undersøgelsen fastslår ikke i sig selv årsager.
            </p>
            <p className={styles.date}>
              PISA 2025 offentliggjort 8. september 2026. Redaktionel vurdering: 24. september 2026.
            </p>
          </footer>
        </div>
      </details>
    </section>
  );
}
