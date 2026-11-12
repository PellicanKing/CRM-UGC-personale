# Guida passo passo (senza sapere programmare)

Dove vedi **Windows** o **Mac**, segui solo la parte del tuo computer.
Consiglio: usa **Google Chrome**.

---

## Parte 1 · Installare Node.js (una sola volta)

Node.js è il "motore" che fa funzionare il CRM.

1. Apri il browser e vai su **https://nodejs.org**
2. Clicca il pulsante grande con scritto **LTS**.
3. Apri il file scaricato (lo trovi in **Download**).
4. Clicca sempre **Avanti / Continua / Accetto / Installa** fino alla fine.
   - **Windows**: se compare una casella "Automatically install the necessary tools", lasciala **vuota**.
5. Riavvia il computer.

---

## Parte 2 · Scaricare il CRM

1. Vai su **https://github.com/PellicanKing/CRM-UGC-personale** (devi aver fatto l'accesso a GitHub).
2. Clicca il pulsante verde **`<> Code`** → **Download ZIP**.
3. Apri la cartella **Download** e trova `CRM-UGC-personale-main.zip`.
   - **Windows**: tasto destro → **Estrai tutto…** → **Estrai**.
   - **Mac**: doppio clic.
4. Trascina la cartella `CRM-UGC-personale-main` dentro **Documenti**.

---

## Parte 3 · Accendere il CRM

1. Apri la cartella del CRM e fai doppio clic su:
   - **Windows**: `AVVIA (Windows)`
     Se compare "Windows ha protetto il PC": **Ulteriori informazioni** → **Esegui comunque**.
   - **Mac**: `AVVIA (Mac)`
     Se compare "sviluppatore non identificato": **Fine**, poi **tasto destro** sul file → **Apri** → **Apri**.
     (In alcune versioni: **Impostazioni di Sistema → Privacy e sicurezza** → in basso **Apri comunque**.)
2. Si apre una **finestra nera**. **La prima volta aspetta qualche minuto.**
3. Quando vedi `Il CRM è acceso`, il browser si apre da solo.
   Se non succede, scrivi **localhost:3000** nella barra in alto del browser e premi Invio.

> ⚠️ **La finestra nera deve restare aperta** (puoi ridurla a icona). Chiuderla spegne il CRM.

---

## Parte 4 · Collegare l'intelligenza artificiale (obbligatorio)

L'AI cerca le aziende e scrive le bozze. Si paga a consumo.

1. Vai su **https://console.anthropic.com** e crea un account.
2. Sezione **Billing** → aggiungi credito (es. 10 €).
3. Sezione **API Keys** → **Create Key** → nome "CRM" → **Create** → **Copy**.
   ⚠️ Non mandare la chiave a nessuno, nemmeno in chat.
4. Nella cartella del CRM doppio clic su **`CONFIGURA (Windows)`** o **`CONFIGURA (Mac)`**.
5. Nella riga `ANTHROPIC_API_KEY=` incolla la chiave subito dopo l'uguale, senza spazi.
6. Salva (**Ctrl+S** / **Cmd+S**) e chiudi.
7. Chiudi la finestra nera e rifai doppio clic su **AVVIA**.

---

## Parte 5 · Preparare i tuoi testi (una volta)

1. Nel CRM vai su **Impostazioni**.
2. In **Template delle email** scrivi l'email che mandi sempre. Usa:
   - `{{nome}}` → il nome della persona (se non c'è, diventa solo "Ciao,")
   - `{{azienda}}` → il nome del brand
   - `{{personalizzazione}}` → qui l'AI scrive 1-3 frasi su quel brand specifico

   Lascia vuoti i follow-up se vuoi che li scriva tutti l'AI.
3. Scrivi la **Firma** e clicca **Salva**.
4. Facoltativo: nella cartella del CRM apri `prompts` → `tono.md` (con Blocco note / TextEdit) e descrivi chi sei e cosa offri.

---

## Parte 6 · Il lavoro di tutti i giorni

### 1) Crea la lista
1. Vai su **Lista**.
2. In **Aziende di partenza** scrivi alcuni brand a cui vorresti scrivere, **uno per riga** (nome, sito o link Instagram/TikTok).
3. Se vuoi, scrivi cosa cerchi (es. "brand skincare italiani che fanno pubblicità").
4. Scegli quante aziende simili trovare e clicca **Crea la lista**.
5. Aspetta qualche minuto: compare la lista con sito, email, Instagram, TikTok e il motivo della scelta.
6. Controlla la lista:
   - togli la spunta alle aziende che non ti interessano;
   - se manca un'email (casella arancione), scrivila tu.
7. Clicca **Passa alla scrittura**.

### 2) Scrivi
1. Si apre **Scrittura**. L'AI prepara le bozze una alla volta (in alto vedi quante sono pronte).
2. Clicca **Apri le 3 pagine** (o premi il tasto `O`): si aprono il profilo Instagram/TikTok, la Facebook Ad Library e il sito dell'azienda.
   - **La prima volta** Chrome blocca le finestre: in alto a destra nella barra degli indirizzi compare un'icona con una finestrella barrata → clicca → **Consenti sempre popup e reindirizzamenti da localhost** → **Fine**. Poi premi di nuovo `O`.
   - Consiglio: tieni il CRM in una finestra separata, così passi facilmente dalle pagine alla bozza.
3. Guarda le pagine, poi leggi la bozza e **correggila come scriveresti tu**.
4. Premi **Approva** (tasto `A`): passa all'azienda successiva e le pagine si aggiornano da sole.
   - **Scarta** (`D`) se non vuoi scriverle.
   - **Rigenera** (`R`) se vuoi che l'AI riscriva il messaggio. Puoi darle un'indicazione nella casella in basso (es. "più breve").

### 3) L'AI impara come scrivi
Ogni 3 email che correggi e approvi, l'AI studia le tue correzioni e aggiorna **Impostazioni → Il tuo stile**. Le bozze successive saranno più simili a come scrivi tu. Puoi anche correggere quelle note a mano.

### 4) Gli invii
In **Programmati** vedi quando partirà ogni email (martedì dalle 7:30, una ogni 2-6 minuti). I follow-up partono da soli dopo 7 e 15 giorni **solo se l'azienda non ha risposto**.

---

## Parte 7 · Collegare Proton Mail (per inviare email vere)

Finché non fai questa parte, il CRM è in **modalità di prova**: non parte nessuna email.
Serve un piano Proton **a pagamento**. Consiglio: un indirizzo dedicato al lavoro.

1. Scarica **Proton Mail Bridge** da **https://proton.me/mail/bridge**, installalo, aprilo e accedi.
2. Nel Bridge clicca sul tuo account: vedi **Username** e **Password** (diversa da quella di Proton).
3. Apri **CONFIGURA** e compila:
   ```
   EMAIL_PROVIDER=proton
   MAIL_FROM_ADDRESS=il-tuo-indirizzo@tuodominio.it
   MAIL_FROM_NAME=Il tuo nome
   SMTP_USER=  (Username del Bridge)
   SMTP_PASS=  (Password del Bridge)
   IMAP_USER=  (Username del Bridge)
   IMAP_PASS=  (Password del Bridge)
   ```
   Non toccare le righe con HOST e PORT.
4. Salva, chiudi la finestra nera, rifai doppio clic su **AVVIA**.
5. **Impostazioni** → **Prova connessione** (deve dire OK) → **Invia prova a me stesso** (controlla che arrivi).
6. Quando sei pronto: **Programmati** → **Attiva invii**.

---

## Parte 8 · Il martedì mattina

Le email partono **solo se**, dalle 7:30:
- il computer è **acceso e non in stop**;
- la **finestra nera** del CRM è aperta;
- **Proton Mail Bridge** è aperto.

Per evitare lo stop:
- **Windows**: Impostazioni → Sistema → Alimentazione → Sospensione → **Mai** (quando è collegato alla corrente).
- **Mac**: Impostazioni di Sistema → Batteria → attiva **Impedisci lo stop automatico quando lo schermo è spento** (con il caricatore collegato).

Se il computer era spento, gli invii saltati si spostano **al martedì successivo**.

---

## Problemi frequenti

| Cosa vedi | Cosa fare |
|---|---|
| "Node.js non è installato" | Rifai la Parte 1 e riavvia il computer. |
| "Impossibile raggiungere il sito" | Riapri **AVVIA** e aspetta "Il CRM è acceso". |
| Il pulsante "Crea la lista" è grigio | Manca la chiave dell'AI: rifai la Parte 4. |
| La ricerca dà errore "Interrotta" | Hai chiuso la finestra nera durante la ricerca: rifalla. |
| Le 3 pagine non si aprono | Consenti i popup per localhost (Parte 6, punto 2). |
| "Prova connessione" dà errore | Il Bridge deve essere aperto; username e password sono quelli **del Bridge**. |
| Mac: "non hai i permessi" su AVVIA | Scrivimelo: ti do un comando da incollare. |
| Altro | Fai uno screenshot della finestra nera e mandalo (senza password visibili). |

---

## Aggiornare il CRM a una nuova versione

1. Chiudi la finestra nera.
2. Scarica di nuovo lo ZIP (Parte 2) ed estrailo.
3. Dalla **vecchia** cartella copia nella **nuova**:
   - il file **`.env.local`** (la tua configurazione)
   - la cartella **`data`** (aziende, messaggi, impostazioni, stile imparato)
   - il file **`prompts/tono.md`**, se l'hai modificato

   ⚠️ `.env.local` è un file "nascosto". Per vederlo:
   - **Windows**: Esplora file → **Visualizza** → **Mostra** → spunta **Elementi nascosti**.
   - **Mac**: nella cartella premi **Cmd + Maiusc + .** (punto).
4. Avvia la **nuova** cartella con **AVVIA**. I tuoi dati vengono aggiornati da soli, senza perdite.
