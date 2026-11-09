# Guida passo passo (senza sapere programmare)

Dove vedi **Windows** o **Mac**, segui solo la parte del tuo computer.

---

## Parte 1 · Installare Node.js (una sola volta)

Node.js è il "motore" che fa funzionare il CRM.

1. Apri il browser e vai su **https://nodejs.org**
2. Clicca il pulsante grande con scritto **LTS** (è la versione consigliata).
3. Apri il file scaricato (lo trovi in **Download**).
4. Clicca sempre **Avanti / Continua / Accetto / Installa** fino alla fine.
   - **Windows**: se compare una casella "Automatically install the necessary tools", lasciala **vuota**.
5. Riavvia il computer.

---

## Parte 2 · Scaricare il CRM

1. Vai su **https://github.com/PellicanKing/CRM-UGC-personale** (devi aver fatto l'accesso a GitHub).
2. Clicca il pulsante verde **`<> Code`**.
3. Clicca **Download ZIP**.
4. Apri la cartella **Download** e trova il file `CRM-UGC-personale-main.zip`.
   - **Windows**: tasto destro sul file → **Estrai tutto…** → **Estrai**.
   - **Mac**: doppio clic sul file.
5. Ora hai una cartella `CRM-UGC-personale-main`. Spostala in **Documenti** (trascinala).

---

## Parte 3 · Accendere il CRM

1. Apri la cartella `CRM-UGC-personale-main` che hai messo in Documenti.
2. Doppio clic su:
   - **Windows**: `AVVIA (Windows)`
     - Se compare "Windows ha protetto il PC": clicca **Ulteriori informazioni** → **Esegui comunque**.
   - **Mac**: `AVVIA (Mac)`
     - Se compare "non può essere aperto perché proviene da uno sviluppatore non identificato":
       clicca **Fine**, poi **tasto destro** sul file → **Apri** → **Apri**.
       In alcune versioni di macOS devi andare in **Impostazioni di Sistema → Privacy e sicurezza**, scorrere in basso e cliccare **Apri comunque**.
3. Si apre una **finestra nera** con delle scritte. **La prima volta aspetta qualche minuto.**
4. Quando vedi `Il CRM è acceso`, il browser si apre da solo sul CRM.
   Se non si apre, apri il browser e scrivi nella barra in alto: **localhost:3000** e premi Invio.

> ⚠️ **La finestra nera deve restare aperta** finché usi il CRM. Puoi ridurla a icona, ma non chiuderla.
> Per spegnere il CRM: chiudi la finestra nera.

A questo punto il CRM funziona già, in **modalità di prova**: puoi aggiungere aziende e scrivere messaggi, ma **non parte nessuna email vera**.

---

## Parte 4 · Collegare l'intelligenza artificiale (Claude)

Serve per scrivere schede e messaggi in automatico. È a pagamento (si paga a consumo, pochi centesimi per azienda).

1. Vai su **https://console.anthropic.com** e crea un account.
2. Vai nella sezione **Billing** e aggiungi del credito (ad esempio 5 €).
3. Vai nella sezione **API Keys** → **Create Key** → dai un nome qualsiasi (es. "CRM") → **Create**.
4. Clicca **Copy** per copiare la chiave (inizia con `sk-ant-`).
   ⚠️ Non mandarla a nessuno, nemmeno in chat.
5. Nella cartella del CRM fai doppio clic su:
   - **Windows**: `CONFIGURA (Windows)` (si apre il Blocco note)
   - **Mac**: `CONFIGURA (Mac)` (si apre TextEdit)
6. Trova la riga `ANTHROPIC_API_KEY=` e incolla la chiave **subito dopo l'uguale**, senza spazi:
   `ANTHROPIC_API_KEY=sk-ant-xxxxxxxx`
7. Salva (**Ctrl+S** su Windows, **Cmd+S** su Mac) e chiudi.
8. Chiudi la finestra nera e rifai doppio clic su **AVVIA**.

---

## Parte 5 · Usare il CRM

1. **Aziende** → **+ Aggiungi azienda manualmente** → compila nome, sito, email ecc. → **Aggiungi**.
2. **Revisione** → per ogni azienda premi **Genera scheda e messaggi** (o il tasto `G`).
3. Leggi, correggi il testo se serve, poi:
   - **Approva** (tasto `A`) → il messaggio va in coda
   - **Scarta** (tasto `D`) → l'azienda viene scartata
   - **Rigenera** (tasto `R`) → l'AI riscrive il messaggio
4. **Programmati** → vedi quando partirà ogni email (martedì dalle 7:30).

> Il tono dei messaggi si cambia nel file `prompts/tono.md` (aprilo con Blocco note / TextEdit).
> Scrivi lì cosa offri e come vuoi presentarti.

---

## Parte 6 · Collegare Proton Mail (per inviare email vere)

Serve un piano Proton **a pagamento** (Mail Plus o superiore). Consiglio: un indirizzo dedicato al lavoro, su un tuo dominio.

1. Vai su **https://proton.me/mail/bridge**, scarica **Proton Mail Bridge** e installalo.
2. Apri il Bridge e accedi con il tuo account Proton.
3. Nel Bridge, clicca sul tuo account: compaiono le **impostazioni per il client di posta** (indirizzo, **Username**, **Password**, porte).
   Questa password è diversa da quella del tuo account Proton.
4. Doppio clic su **CONFIGURA** (come nella Parte 4) e compila:
   ```
   EMAIL_PROVIDER=proton
   MAIL_FROM_ADDRESS=il-tuo-indirizzo@tuodominio.it
   MAIL_FROM_NAME=Il tuo nome
   SMTP_USER=  (Username del Bridge)
   SMTP_PASS=  (Password del Bridge)
   IMAP_USER=  (Username del Bridge)
   IMAP_PASS=  (Password del Bridge)
   ```
   Non toccare le righe `HOST` e `PORT`.
5. Salva, chiudi la finestra nera e rifai doppio clic su **AVVIA**.
6. Nel CRM vai in **Impostazioni**:
   - compila **Firma** e controlla la **riga di disiscrizione**, poi **Salva**;
   - clicca **Prova connessione** → deve dire OK;
   - clicca **Invia prova a me stesso** → controlla che l'email ti arrivi.
7. Solo quando sei pronto: **Programmati** → **Attiva invii**.

---

## Parte 7 · Il martedì mattina

Le email partono **solo se**:
- il computer è **acceso e non in stop** (dalle 7:30 finché la coda non è finita);
- la **finestra nera** del CRM è aperta;
- **Proton Mail Bridge** è aperto.

Per evitare che il computer vada in stop:
- **Windows**: Impostazioni → Sistema → Alimentazione → Sospensione → **Mai** (almeno quando è collegato alla corrente).
- **Mac**: Impostazioni di Sistema → Batteria (o Risparmio energia) → attiva **Impedisci lo stop automatico quando lo schermo è spento**, con il computer collegato alla corrente.

Se il computer era spento, gli invii saltati vengono spostati **al martedì successivo** (niente email a orari strani).

---

## Problemi frequenti

| Cosa vedi | Cosa fare |
|---|---|
| "Node.js non è installato" | Rifai la Parte 1 e riavvia il computer. |
| Il browser dice "Impossibile raggiungere il sito" | La finestra nera è chiusa o non ha finito: riapri **AVVIA** e aspetta "Il CRM è acceso". |
| "AI non configurata" | Rifai la Parte 4 e riavvia il CRM. |
| "Prova connessione" dà errore | Controlla che il Bridge sia aperto e che username/password siano quelli **del Bridge**. |
| Qualcosa non va | Fai una foto/screenshot della finestra nera e mandala (senza password visibili). |

---

## Aggiornare il CRM a una nuova versione

1. Chiudi la finestra nera.
2. Scarica di nuovo lo ZIP (Parte 2) ed estrailo.
3. Dalla **vecchia** cartella copia nella **nuova**:
   - il file **`.env.local`** (la tua configurazione)
   - la cartella **`data`** (tutte le tue aziende e i messaggi)
   - il file **`prompts/tono.md`**, se l'hai modificato

   ⚠️ `.env.local` è un file "nascosto". Per vederlo:
   - **Windows**: in Esplora file → **Visualizza** → **Mostra** → spunta **Elementi nascosti**.
   - **Mac**: nella cartella premi **Cmd + Maiusc + .** (punto).
4. Avvia la nuova cartella con **AVVIA**.
