"use client";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface Props {
  t: (key: string) => string;
  onClose: () => void;
  lang: "en" | "it" | "sr";
}

/**
 * GDPR Art. 13/14 compliant privacy policy.
 * Also compliant with:
 * - ZZLP (Serbian DPA) — Art. 23 transparency requirements
 * - ePrivacy Directive — cookie information
 * - UK GDPR — post-Brexit equivalent requirements
 *
 * This is a structural template. Replace [COMPANY] placeholders with real data.
 */
export default function PrivacyModal({ t, onClose, lang }: Props) {
  const content = lang === "sr" ? privacySR : lang === "it" ? privacyIT : privacyEN;
  const trapRef = useFocusTrap<HTMLDivElement>();

  return (
    <div ref={trapRef} className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#111827] border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 id="privacy-modal-title" className="text-xl font-bold text-white">{t("privacy.title")}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-headings:font-bold
              prose-p:text-gray-400 prose-p:leading-relaxed
              prose-li:text-gray-400
              prose-strong:text-gray-300"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
          >
            {t("privacy.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

const privacyEN = `
<h3>1. Data Controller</h3>
<p>Centro Studi Grassi DOO, Belgrade, Serbia<br/>
Email: privacy@autopilot.rs<br/>
Data Protection Officer: dpo@autopilot.rs</p>

<h3>2. What Data We Collect</h3>
<p>We collect the following categories of personal data:</p>
<ul>
  <li><strong>Account data:</strong> Email address, name, factory name, role — to create and manage your account (Legal basis: GDPR Art. 6(1)(b) — contract performance)</li>
  <li><strong>Usage data:</strong> Features used, session duration, pages visited — to improve the platform (Legal basis: GDPR Art. 6(1)(f) — legitimate interest, or Art. 6(1)(a) — consent for analytics cookies)</li>
  <li><strong>Factory operational data:</strong> OEE metrics, production records, downtime logs, quality data — this is data YOU input to use the lean tools (Legal basis: GDPR Art. 6(1)(b) — contract performance)</li>
  <li><strong>AI interaction data:</strong> Chat messages with Factory Copilot — to provide AI analysis (Legal basis: GDPR Art. 6(1)(b) — contract performance)</li>
</ul>

<h3>3. How We Use Your Data</h3>
<ul>
  <li>To provide and maintain the LeanPilot platform</li>
  <li>To send you account-related communications (login credentials, service updates)</li>
  <li>To improve our product (aggregated, anonymized analytics only — with consent)</li>
  <li>To provide AI-powered insights based on your factory data</li>
</ul>
<p><strong>We do NOT:</strong> Sell your data, use your factory data to train AI models for other customers, or share individual data with third parties without your explicit consent.</p>

<h3>4. Data Retention</h3>
<ul>
  <li>Account data: retained while your account is active + 30 days after deletion request</li>
  <li>Factory operational data: retained while your subscription is active. Exported/deleted upon request.</li>
  <li>AI conversation data: retained for 90 days, then automatically purged</li>
  <li>Analytics data: anonymized after 26 months (if consent given)</li>
</ul>

<h3>5. Your Rights (GDPR Art. 15-22)</h3>
<p>You have the right to:</p>
<ul>
  <li><strong>Access</strong> your personal data (Art. 15)</li>
  <li><strong>Rectify</strong> inaccurate data (Art. 16)</li>
  <li><strong>Erase</strong> your data ("right to be forgotten") (Art. 17)</li>
  <li><strong>Restrict</strong> processing (Art. 18)</li>
  <li><strong>Data portability</strong> — export in machine-readable format (Art. 20)</li>
  <li><strong>Object</strong> to processing based on legitimate interest (Art. 21)</li>
  <li><strong>Withdraw consent</strong> at any time (Art. 7(3))</li>
</ul>
<p>To exercise any right, email: privacy@autopilot.rs. We respond within 30 days.</p>

<h3>6. International Data Transfers</h3>
<p>Your data is processed within the EU/EEA. If we transfer data outside the EEA (e.g., AI processing via OpenAI), we use Standard Contractual Clauses (SCCs) per GDPR Art. 46(2)(c).</p>
<p>For users in Serbia: we comply with ZZLP (Zakon o zaštiti podataka o ličnosti) and ensure equivalent data protection standards.</p>

<h3>7. Cookies</h3>
<ul>
  <li><strong>Essential cookies:</strong> Session management, language preference, security tokens — no consent needed (ePrivacy Art. 5(3) exemption)</li>
  <li><strong>Analytics cookies:</strong> Only with your explicit consent — you can change preferences anytime via the cookie settings</li>
</ul>

<h3>8. Sub-processors</h3>
<p>We use the following sub-processors:</p>
<ul>
  <li>Cloud hosting: Hetzner Cloud — EU data center (Germany/Finland)</li>
  <li>Email delivery: SMTP service — for sending account credentials</li>
  <li>Payment processing: Stripe — PCI DSS compliant (they are an independent controller for payment data)</li>
  <li>AI processing: OpenAI — with DPA and SCCs in place (Pro plan only)</li>
</ul>

<h3>9. Security</h3>
<p>We implement appropriate technical and organizational measures including: encryption in transit (TLS 1.2+), role-based access controls, password hashing (bcrypt), JWT token management, regular security assessments, and incident response procedures. Database security is managed at the infrastructure level by the hosting provider.</p>

<h3>10. Children</h3>
<p>LeanPilot is a B2B service for manufacturing professionals. We do not knowingly collect data from persons under 16.</p>

<h3>11. Changes to This Policy</h3>
<p>We will notify you of material changes via email at least 30 days before they take effect.</p>

<h3>12. Supervisory Authority</h3>
<p>You have the right to lodge a complaint with your local data protection authority. In Italy: Garante per la protezione dei dati personali. In Serbia: Poverenik za informacije od javnog značaja i zaštitu podataka o ličnosti.</p>

<p><em>Last updated: March 2026</em></p>
`;

const privacyIT = `
<h3>1. Titolare del Trattamento</h3>
<p>Centro Studi Grassi DOO, Beograd, Srbija<br/>
Email: privacy@autopilot.rs<br/>
Responsabile Protezione Dati: dpo@autopilot.rs</p>

<h3>2. Quali Dati Raccogliamo</h3>
<p>Raccogliamo le seguenti categorie di dati personali:</p>
<ul>
  <li><strong>Dati account:</strong> Email, nome, nome stabilimento, ruolo — per creare e gestire il tuo account (Base giuridica: GDPR Art. 6(1)(b) — esecuzione contratto)</li>
  <li><strong>Dati di utilizzo:</strong> Funzionalità usate, durata sessione, pagine visitate — per migliorare la piattaforma (Base giuridica: GDPR Art. 6(1)(f) — interesse legittimo, o Art. 6(1)(a) — consenso per cookie analytics)</li>
  <li><strong>Dati operativi fabbrica:</strong> Metriche OEE, registri produzione, log fermi, dati qualità — dati che TU inserisci per usare gli strumenti lean (Base giuridica: GDPR Art. 6(1)(b) — esecuzione contratto)</li>
  <li><strong>Dati interazione AI:</strong> Messaggi chat con Copilota Fabbrica — per fornire analisi AI (Base giuridica: GDPR Art. 6(1)(b) — esecuzione contratto)</li>
</ul>

<h3>3. Come Usiamo i Tuoi Dati</h3>
<ul>
  <li>Per fornire e mantenere la piattaforma LeanPilot</li>
  <li>Per inviarti comunicazioni relative all'account (credenziali accesso, aggiornamenti servizio)</li>
  <li>Per migliorare il prodotto (solo analytics aggregati e anonimizzati — con consenso)</li>
  <li>Per fornire insight basati su AI dei tuoi dati di fabbrica</li>
</ul>
<p><strong>NON:</strong> Vendiamo i tuoi dati, usiamo i dati della tua fabbrica per addestrare modelli AI per altri clienti, o condividiamo dati individuali con terze parti senza il tuo esplicito consenso.</p>

<h3>4. Conservazione Dati</h3>
<ul>
  <li>Dati account: conservati finché l'account è attivo + 30 giorni dopo richiesta cancellazione</li>
  <li>Dati operativi fabbrica: conservati durante l'abbonamento attivo. Esportati/cancellati su richiesta.</li>
  <li>Dati conversazione AI: conservati 90 giorni, poi eliminati automaticamente</li>
  <li>Dati analytics: anonimizzati dopo 26 mesi (se consenso dato)</li>
</ul>

<h3>5. I Tuoi Diritti (GDPR Art. 15-22)</h3>
<p>Hai il diritto di:</p>
<ul>
  <li><strong>Accesso</strong> ai tuoi dati personali (Art. 15)</li>
  <li><strong>Rettifica</strong> dati inesatti (Art. 16)</li>
  <li><strong>Cancellazione</strong> dei tuoi dati ("diritto all'oblio") (Art. 17)</li>
  <li><strong>Limitazione</strong> del trattamento (Art. 18)</li>
  <li><strong>Portabilità dati</strong> — esportazione in formato leggibile (Art. 20)</li>
  <li><strong>Opposizione</strong> al trattamento basato su interesse legittimo (Art. 21)</li>
  <li><strong>Revoca consenso</strong> in qualsiasi momento (Art. 7(3))</li>
</ul>
<p>Per esercitare qualsiasi diritto, scrivi a: privacy@autopilot.rs. Rispondiamo entro 30 giorni.</p>

<h3>6. Trasferimenti Internazionali</h3>
<p>I tuoi dati sono trattati nell'UE/SEE. Se trasferiamo dati fuori dal SEE (es. elaborazione AI via OpenAI), utilizziamo Clausole Contrattuali Standard (SCC) ai sensi dell'Art. 46(2)(c) GDPR.</p>
<p>Per utenti in Serbia: siamo conformi alla ZZLP (Zakon o zaštiti podataka o ličnosti) e garantiamo standard equivalenti di protezione dati.</p>

<h3>7. Cookie</h3>
<ul>
  <li><strong>Cookie essenziali:</strong> Gestione sessione, preferenza lingua, token sicurezza — non richiedono consenso (esenzione ePrivacy Art. 5(3))</li>
  <li><strong>Cookie analytics:</strong> Solo con il tuo esplicito consenso — puoi modificare le preferenze in qualsiasi momento tramite le impostazioni cookie</li>
</ul>

<h3>8. Sub-responsabili</h3>
<p>Utilizziamo i seguenti sub-responsabili:</p>
<ul>
  <li>Cloud hosting: Hetzner Cloud — data center UE (Germania/Finlandia)</li>
  <li>Invio email: Servizio SMTP — per invio credenziali account</li>
  <li>Elaborazione pagamenti: Stripe — conforme PCI DSS (titolare autonomo per dati pagamento)</li>
  <li>Elaborazione AI: OpenAI — con DPA e SCC in atto (solo piano Pro)</li>
</ul>

<h3>9. Sicurezza</h3>
<p>Implementiamo misure tecniche e organizzative appropriate tra cui: crittografia in transito (TLS 1.2+), controlli accesso basati su ruoli, hashing password (bcrypt), gestione token JWT, valutazioni sicurezza regolari e procedure di risposta agli incidenti. La sicurezza del database è gestita a livello infrastrutturale dal provider di hosting.</p>

<h3>10. Minori</h3>
<p>LeanPilot è un servizio B2B per professionisti manifatturieri. Non raccogliamo consapevolmente dati da persone sotto i 16 anni.</p>

<h3>11. Modifiche a Questa Policy</h3>
<p>Ti notificheremo modifiche sostanziali via email almeno 30 giorni prima della loro entrata in vigore.</p>

<h3>12. Autorità di Controllo</h3>
<p>Hai il diritto di presentare reclamo alla tua autorità locale di protezione dati. In Italia: Garante per la protezione dei dati personali. In Serbia: Poverenik za informacije od javnog značaja i zaštitu podataka o ličnosti.</p>

<p><em>Ultimo aggiornamento: Marzo 2026</em></p>
`;

const privacySR = `
<h3>1. Ko smo mi</h3>
<p>Centro Studi Grassi DOO, Beograd, Srbija<br/>
Email: privacy@autopilot.rs<br/>
Lice za zaštitu podataka o ličnosti (DPO): dpo@autopilot.rs</p>

<h3>2. DPO kontakt</h3>
<p>Za sva pitanja u vezi sa obradom vaših podataka o ličnosti, možete kontaktirati našeg DPO na: dpo@autopilot.rs</p>

<h3>3. Koje podatke obrađujemo i zašto</h3>
<p>Obrađujemo sledeće kategorije podataka o ličnosti:</p>
<ul>
  <li><strong>Podaci o nalogu:</strong> Email adresa, ime, naziv fabrike, uloga — za kreiranje i upravljanje vašim nalogom (Pravni osnov: GDPR čl. 6(1)(b) — izvršenje ugovora; ZZLP čl. 12 st. 1 tač. 2)</li>
  <li><strong>Podaci o korišćenju:</strong> Korišćene funkcije, trajanje sesije, posećene stranice — za unapređenje platforme (Pravni osnov: GDPR čl. 6(1)(f) — legitimni interes, ili čl. 6(1)(a) — pristanak za analitičke kolačiće; ZZLP čl. 12 st. 1 tač. 6 ili tač. 1)</li>
  <li><strong>Operativni podaci fabrike:</strong> OEE metrike, evidencija proizvodnje, logovi zastoja, podaci o kvalitetu — to su podaci koje VI unosite za korišćenje lean alata (Pravni osnov: GDPR čl. 6(1)(b) — izvršenje ugovora; ZZLP čl. 12 st. 1 tač. 2)</li>
  <li><strong>Podaci o AI interakciji:</strong> Chat poruke sa Factory Copilot-om — za pružanje AI analize (Pravni osnov: GDPR čl. 6(1)(b) — izvršenje ugovora; ZZLP čl. 12 st. 1 tač. 2)</li>
</ul>

<h3>4. Koliko čuvamo vaše podatke</h3>
<ul>
  <li>Podaci o nalogu: čuvaju se dok je nalog aktivan + 30 dana nakon zahteva za brisanje</li>
  <li>Operativni podaci fabrike: čuvaju se dok je vaša pretplata aktivna. Izvoz/brisanje na zahtev.</li>
  <li>Podaci o AI konverzacijama: čuvaju se 90 dana, zatim se automatski brišu</li>
  <li>Analitički podaci: anonimizuju se nakon 26 meseci (ako je dat pristanak)</li>
</ul>

<h3>5. Vaša prava</h3>
<p>U skladu sa GDPR (čl. 15-22) i ZZLP (čl. 26-37), imate pravo da:</p>
<ul>
  <li><strong>Pristupite</strong> vašim podacima o ličnosti (GDPR čl. 15; ZZLP čl. 26)</li>
  <li><strong>Ispravite</strong> netačne podatke (GDPR čl. 16; ZZLP čl. 29)</li>
  <li><strong>Obrišete</strong> vaše podatke ("pravo na zaborav") (GDPR čl. 17; ZZLP čl. 30)</li>
  <li><strong>Ograničite</strong> obradu (GDPR čl. 18; ZZLP čl. 31)</li>
  <li><strong>Prenosivost podataka</strong> — izvoz u mašinski čitljivom formatu (GDPR čl. 20; ZZLP čl. 36)</li>
  <li><strong>Prigovorite</strong> obradi zasnovanoj na legitimnom interesu (GDPR čl. 21; ZZLP čl. 37)</li>
  <li><strong>Povučete pristanak</strong> u bilo kom trenutku (GDPR čl. 7(3); ZZLP čl. 15 st. 3)</li>
</ul>
<p>Za ostvarivanje bilo kog prava, pišite na: privacy@autopilot.rs. Odgovaramo u roku od 30 dana.</p>

<h3>6. Međunarodni transferi</h3>
<p>Vaši podaci se obrađuju u okviru EU/EEA. Ako prenosimo podatke van EEA (npr. AI obrada putem OpenAI), koristimo Standardne ugovorne klauzule (SCCs) u skladu sa GDPR čl. 46(2)(c).</p>
<p>Za korisnike u Srbiji: postupamo u skladu sa ZZLP (Zakon o zaštiti podataka o ličnosti, "Sl. glasnik RS", br. 87/2018) i obezbeđujemo ekvivalentan nivo zaštite podataka. Transfer podataka u treće zemlje vrši se u skladu sa čl. 65 ZZLP.</p>

<h3>7. Bezbednost</h3>
<p>Primenjujemo odgovarajuće tehničke i organizacione mere uključujući: enkripciju u prenosu (TLS 1.2+), kontrole pristupa zasnovane na ulogama, heširanje lozinki (bcrypt), upravljanje JWT tokenima, redovne procene bezbednosti i procedure reagovanja na incidente. Bezbednost baze podataka se upravlja na nivou infrastrukture od strane hosting provajdera.</p>

<h3>8. Pod-obrađivači</h3>
<p>Koristimo sledeće pod-obrađivače:</p>
<ul>
  <li>Cloud hosting: Hetzner Cloud — data centar u EU (Nemačka/Finska)</li>
  <li>Dostava emailova: SMTP servis — za slanje pristupnih podataka za nalog</li>
  <li>Obrada plaćanja: Stripe — usklađen sa PCI DSS (nezavisni rukovalac za podatke o plaćanju)</li>
  <li>AI obrada: OpenAI — sa DPA i SCC ugovorima (samo Pro plan)</li>
</ul>

<h3>9. Kolačići</h3>
<ul>
  <li><strong>Neophodni kolačići:</strong> Upravljanje sesijom, jezička preferencija, bezbednosni tokeni — nije potreban pristanak (izuzeće prema ePrivacy čl. 5(3))</li>
  <li><strong>Analitički kolačići:</strong> Samo uz vaš izričiti pristanak — možete promeniti podešavanja u bilo kom trenutku putem podešavanja kolačića</li>
</ul>

<h3>10. Deca</h3>
<p>LeanPilot je B2B servis namenjen profesionalcima u proizvodnji. Ne prikupljamo svesno podatke od lica mlađih od 16 godina (ZZLP čl. 16).</p>

<h3>11. Promene politike</h3>
<p>Obavestićemo vas o značajnim promenama putem emaila najmanje 30 dana pre njihovog stupanja na snagu.</p>

<h3>12. Nadzorni organi</h3>
<p>Imate pravo da podnesete pritužbu nadležnom organu za zaštitu podataka. U Srbiji: Poverenik za informacije od javnog značaja i zaštitu podataka o ličnosti (https://www.poverenik.rs). U Italiji: Garante per la protezione dei dati personali.</p>

<h3>13. Kontakt</h3>
<p>Za sva pitanja u vezi sa ovom politikom privatnosti ili obradom vaših podataka o ličnosti:<br/>
Centro Studi Grassi DOO<br/>
Beograd, Srbija<br/>
Email: privacy@autopilot.rs<br/>
DPO: dpo@autopilot.rs</p>

<p><em>Poslednje ažuriranje: mart 2026.</em></p>
`;
