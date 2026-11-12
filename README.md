# CRM Outreach personale

Web app locale (un solo utente) per revisionare aziende, generare messaggi con Claude e, nei prossimi step, programmarne l'invio.

## Avvio
**Non sai programmare?** Segui [GUIDA.md](GUIDA.md): basta un doppio clic su `AVVIA (Windows)` o `AVVIA (Mac)`.

Da terminale:
```bash
npm install
cp .env.example .env.local   # inserisci ANTHROPIC_API_KEY
npm run db:push              # crea data/crm.db (vuoto)
npm run dev                  # http://localhost:3000
```

`npm run db:seed` azzera il database e carica 5 aziende **di esempio** (indirizzi finti: non attivare gli invii con queste).

## Email con Proton Mail
1. Serve un piano Proton a pagamento. Meglio un indirizzo dedicato su un tuo dominio.
2. Installa e apri **Proton Mail Bridge**, accedi, e copia dalla sua schermata utente e password SMTP/IMAP (non sono la password Proton).
3. In `.env.local`: `EMAIL_PROVIDER=proton`, `MAIL_FROM_*`, `SMTP_*`, `IMAP_*` (vedi `.env.example`).
4. In **Impostazioni**: *Prova connessione*, poi *Invia prova a me stesso*.

Senza Bridge puoi usare l'SMTP diretto (`smtp.protonmail.ch:587` + token, solo dominio personalizzato), ma allora le risposte non vengono rilevate.

## Pagine
- **Lista** – scrivi alcune aziende di partenza: l'AI cerca sul web i loro dati e aggiunge aziende simili. Rivedi, correggi le email, scarta, poi **Passa alla scrittura**.
- **Scrittura** – una card per azienda con bozza pronta (template + parte personalizzata dall'AI). A ogni cambio di card si aprono 3 schede: Instagram/TikTok, Ad Library, sito.
  Scorciatoie: `A` / `Ctrl+Invio` approva · `E` modifica · `R` rigenera step · `G` rigenera tutto · `D`/`X` scarta · `O` apri le 3 pagine · `←→`/`K J` naviga · `1 2 3` step · `?` aiuto.
- **Programmati** – coda degli invii, spostamento manuale, pausa/attivazione.
- **Aziende** – elenco completo e inserimento manuale.
- **Impostazioni** – email (Proton), template, "il tuo stile" imparato dall'AI, giorni e orari di invio, firma, disiscrizione.

## Struttura
- `src/db/schema.ts` – modello dati (Drizzle + SQLite)
- `src/lib/ai.ts` – Claude: scheda azienda, sequenza con template, apprendimento dello stile (output strutturato)
- `src/lib/leads.ts` – ricerca aziende con Claude + ricerca web (web_search / web_fetch lato server)
- `src/lib/generate.ts`, `src/lib/jobs.ts` – generazione bozze e lavori in background
- `src/lib/email/provider.ts` – interfaccia `EmailProvider`: `proton` (SMTP) e `console` (prova, nessun invio)
- `src/lib/email/send.ts` – invio di un singolo messaggio, solo se approvato e se la sequenza non è stata interrotta
- `src/lib/email/inbox.ts` – lettura IMAP: risposte, bounce e disiscrizioni fermano la sequenza
- `src/app/actions.ts` – server actions (approva, scarta, rigenera, impostazioni)

## Stato MVP
1. ✅ Setup + database + seed
2. ✅ Revisione a carrellata
3. ✅ Integrazione Claude (riassunto + messaggi)
4. ✅ Programmazione, invio e follow-up
5. ✅ "Trova lead" (Lista)
6. ⏳ Statistiche

## Programmazione
Pagina **Programmati**: coda degli invii divisa per giorno, spostamento manuale di un singolo invio, "Ferma sequenza", interruttore **Attiva invii / Metti in pausa** (spento di default).
- Il pianificatore gira dentro l'app (`src/instrumentation.ts` → `src/lib/scheduler/`): ogni 10 secondi legge la posta (ogni 5 min), assegna gli orari ai messaggi approvati e invia al massimo un messaggio.
- Regole predefinite: martedì dalle 7:30 (entro le 12:00), pausa casuale 2–6 minuti, follow-up 1 dopo 7 giorni, follow-up 2 dopo 15 giorni dal follow-up 1, sempre nel primo martedì utile.
- Invia solo mentre l'app è aperta. Se un invio salta di oltre 20 minuti, viene spostato al giorno utile successivo invece di partire a un orario strano.
- `SCHEDULER_DISABLED=1` in `.env.local` spegne il pianificatore.

"Approva" mette i messaggi in coda; partono solo con gli invii attivi.
