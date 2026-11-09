# CRM Outreach personale

CRM per uso esclusivamente personale (un solo utente) per trovare aziende, generare messaggi personalizzati con l'AI, revisionarli e inviarli con follow-up automatici.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- SQLite con Drizzle ORM (file locale `data/crm.db`)
- Claude API (`@anthropic-ai/sdk`) per riassunti e messaggi
- Invio email: Proton Mail. Invio via SMTP (Proton Mail Bridge su `127.0.0.1:1025`, oppure SMTP submission `smtp.protonmail.ch:587` con token per dominio personalizzato); rilevamento di risposte, bounce e disiscrizioni via IMAP del Bridge (`127.0.0.1:1143`). Usare un indirizzo dedicato su dominio proprio e volumi bassi. Tutto dietro l'interfaccia `EmailProvider` (`src/lib/email/`) per poter cambiare; provider `console` per le prove senza invio.
- Chiavi e segreti solo in `.env.local`, mai nel codice e mai committati.

## Flusso principale
1. "Trova lead": l'utente inserisce un criterio (settore + zona) → l'agente trova aziende, sito, email, Instagram, pagina Facebook.
2. Arricchimento: lettura del sito e dei dati pubblici → scheda azienda (cosa fanno, target, punti deboli, aggancio).
3. Generazione: primo messaggio + follow-up 1 e 2 nel tono definito in `prompts/tono.md`.
4. Revisione a carrellata: una card per azienda (riassunto, link Instagram, link Facebook Ad Library, messaggio modificabile). Azioni: Approva / Modifica / Rigenera / Scarta. Scorciatoie da tastiera.
5. Programmazione: giorni e fasce orarie, fuso del destinatario, limite giornaliero, intervallo casuale tra invii, spostamento manuale di un singolo invio. Preferenza attuale: invii solo il martedì, dalle 7:30, con pausa casuale di 2–6 minuti tra un invio e l'altro (deve sembrare una persona che scrive a mano).
6. Follow-up: partono dopo X giorni solo se non c'è risposta; la sequenza si ferma su risposta, bounce o richiesta di disiscrizione. Preferenza attuale: follow-up 1 dopo 7 giorni dal primo messaggio, follow-up 2 dopo 15 giorni dal follow-up 1 (sempre nel primo giorno di invio utile).

## Modello dati
- companies: nome, sito, settore, città, instagram, facebook_page, ad_library_url, summary, hook, status (new/review/approved/contacted/replied/discarded)
- contacts: company_id, nome, ruolo, email, email_verified, source
- sequences: nome, steps (giorni di attesa per ogni step)
- messages: company_id, contact_id, step, ai_draft, final_text, subject, status (draft/approved/scheduled/sent/cancelled), scheduled_at, sent_at
- events: message_id, tipo (sent/opened/replied/bounced/unsubscribed), timestamp
- settings: fasce orarie, limite giornaliero, intervallo min/max, firma

## Vincoli
- Instagram: nessuno scraping e nessun invio automatico di DM. Solo link al profilo e, per i DM, messaggio pronto da copiare.
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
