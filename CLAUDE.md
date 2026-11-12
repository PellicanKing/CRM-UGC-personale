# CRM Outreach personale

CRM per uso esclusivamente personale (un solo utente) per trovare aziende, generare messaggi personalizzati con l'AI, revisionarli e inviarli con follow-up automatici.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- SQLite con Drizzle ORM (file locale `data/crm.db`)
- Claude API (`@anthropic-ai/sdk`) per riassunti e messaggi
- Invio email: Proton Mail. Invio via SMTP (Proton Mail Bridge su `127.0.0.1:1025`, oppure SMTP submission `smtp.protonmail.ch:587` con token per dominio personalizzato); rilevamento di risposte, bounce e disiscrizioni via IMAP del Bridge (`127.0.0.1:1143`). Usare un indirizzo dedicato su dominio proprio e volumi bassi. Tutto dietro l'interfaccia `EmailProvider` (`src/lib/email/`) per poter cambiare; provider `console` per le prove senza invio.
- Chiavi e segreti solo in `.env.local`, mai nel codice e mai committati.

## Flusso principale
1. Lista ("Trova lead"): l'utente scrive alcune aziende a cui vorrebbe scrivere (nome, sito o profilo) → l'AI (Claude con ricerca web) le completa e aggiunge aziende simili, con sito, email pubblica, Instagram, TikTok, pagina Facebook e il motivo della scelta. L'utente rivede la lista, corregge le email, scarta quelle che non vuole e preme "Passa alla scrittura".
2. Arricchimento e generazione in background: lettura del sito → scheda azienda (cosa fanno, target, punti deboli, aggancio) → primo messaggio + follow-up 1 e 2. Le email partono da template fissi dell'utente (segnaposto `{{nome}}`, `{{azienda}}`, `{{personalizzazione}}`); l'AI scrive solo la parte personalizzata (o l'intera email se il template è vuoto), nel tono di `prompts/tono.md`.
3. Scrittura (revisione a carrellata): una card per azienda. A ogni cambio di card il CRM apre in automatico 3 schede: profilo Instagram (o TikTok), Facebook Ad Library e sito; la quarta è il CRM con la bozza. Azioni: Approva / Modifica / Rigenera / Scarta. Scorciatoie da tastiera.
4. Apprendimento dello stile: ogni 3 email corrette e approvate l'AI confronta bozza e versione finale e aggiorna le note "Il tuo stile" (modificabili in Impostazioni); le ultime correzioni sono usate come esempi nelle generazioni successive.
5. Programmazione: giorni e fasce orarie, fuso del destinatario, limite giornaliero, intervallo casuale tra invii, spostamento manuale di un singolo invio. Preferenza attuale: invii solo il martedì, dalle 7:30, con pausa casuale di 2–6 minuti tra un invio e l'altro (deve sembrare una persona che scrive a mano).
6. Follow-up: partono dopo X giorni solo se non c'è risposta (il CRM legge la posta via IMAP); la sequenza si ferma su risposta, bounce o richiesta di disiscrizione. Preferenza attuale: follow-up 1 dopo 7 giorni dal primo messaggio, follow-up 2 dopo 15 giorni dal follow-up 1 (sempre nel primo giorno di invio utile).

## Modello dati
- companies: nome, sito, settore, città, instagram, tiktok, facebook_page, ad_library_url, summary, hook, origin (utente/ai), lead_reason, search_id, status (lead/new/review/approved/contacted/replied/discarded)
- lead_searches: aziende di partenza, note, quantità, stato (running/done/error), trovate
- contacts: company_id, nome, ruolo, email, email_verified, source
- sequences: nome, steps (giorni di attesa per ogni step)
- messages: company_id, contact_id, step, ai_draft, final_text, subject, status (draft/approved/scheduled/sent/cancelled), scheduled_at, sent_at
- events: message_id, tipo (sent/opened/replied/bounced/unsubscribed), timestamp
- settings: fasce orarie, limite giornaliero, intervallo min/max, firma, template (3 step), stile imparato

## Vincoli
- Instagram/TikTok: nessuno scraping e nessun invio automatico di DM. Solo link al profilo (trovato con la ricerca web) e, per i DM, messaggio pronto da copiare.
- Facebook Ad Library: link diretto filtrato sulla pagina dell'azienda (non incorporabile in iframe).
- Ogni email include un modo semplice per non ricevere altri messaggi.
- Mai inviare nulla senza approvazione esplicita dell'utente.

## Ordine di sviluppo (MVP)
1. Setup progetto + database + seed con 5 aziende di esempio
2. Pagina di revisione a carrellata
3. Integrazione Claude API (riassunto + messaggi)
4. Programmazione e invio + follow-up
5. "Trova lead" automatico
6. Statistiche

## Lingua
Interfaccia e messaggi in italiano. Commenti nel codice in inglese.
