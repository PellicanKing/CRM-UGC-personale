// Seeds the database with 5 fictional example companies (all data is made up).
import { db, schema } from "../src/db";
import { adLibraryUrl } from "../src/lib/links";

type SeedCompany = {
  company: Omit<typeof schema.companies.$inferInsert, "adLibraryUrl">;
  contact: Omit<typeof schema.contacts.$inferInsert, "companyId">;
  drafts: { subject: string; text: string }[];
};

const data: SeedCompany[] = [
  {
    company: {
      name: "Forno Sant'Elia (esempio)",
      website: "https://forno-santelia.example.com",
      sector: "Panifici e pasticcerie",
      city: "Bologna",
      instagram: "https://www.instagram.com/forno_santelia_esempio/",
      facebookPage: "https://www.facebook.com/fornosantelia.esempio",
      summary:
        "Panificio artigianale a gestione familiare dal 1987, due punti vendita in centro. Pane a lievitazione naturale, dolci tipici bolognesi, colazioni.",
      target: "Residenti del quartiere, famiglie, uffici della zona per le colazioni.",
      weaknesses:
        "Sito senza orari aggiornati, nessun ordine online per le torte, Instagram fermo da 4 mesi.",
      hook: "Le foto delle torte su Instagram sono bellissime ma non c'è un modo per ordinarle.",
      status: "review",
    },
    contact: { name: "Giulia Martelli", role: "Titolare", email: "giulia@forno-santelia.example.com", source: "sito" },
    drafts: [
      {
        subject: "ordini delle torte",
        text: "Ciao Giulia,\n\nho visto le torte che pubblicate su Instagram: la crostata di riso è davvero invitante. Ho notato però che chi le vede non ha un modo semplice per ordinarle, né dal profilo né dal sito.\n\nAiuto attività come la vostra a trasformare chi guarda in chi prenota, con un modulo d'ordine semplice e qualche post mirato nel quartiere.\n\nTi andrebbe se ti mandassi due idee concrete per il vostro caso?",
      },
      {
        subject: "re: ordini delle torte",
        text: "Ciao Giulia,\n\nriprendo il messaggio della settimana scorsa. Un'idea pratica: un link \"Prenota la torta\" nella bio di Instagram con ritiro in negozio, da spingere il giovedì per il weekend.\n\nVuoi che ti mostri come lo imposterei?",
      },
      {
        subject: "re: ordini delle torte",
        text: "Ciao Giulia,\n\nimmagino sia un periodo pieno, quindi non insisto. Se in futuro vorrete raccogliere ordini online, sarò felice di darvi una mano.\n\nBuon lavoro!",
      },
    ],
  },
  {
    company: {
      name: "Palestra Kinetica (esempio)",
      website: "https://kinetica-fit.example.com",
      sector: "Palestre e fitness",
      city: "Torino",
      instagram: "https://www.instagram.com/kinetica_fit_esempio/",
      facebookPage: "https://www.facebook.com/kineticafit.esempio",
      summary:
        "Palestra boutique con corsi di functional training e pilates reformer, circa 300 iscritti. Personal trainer certificati.",
      target: "Professionisti 28-45 anni che cercano allenamenti brevi e seguiti.",
      weaknesses: "Nessuna prova gratuita prenotabile online; le recensioni positive non vengono valorizzate.",
      hook: "Hanno oltre 200 recensioni a 4,9 stelle che non compaiono da nessuna parte sul sito.",
      status: "review",
    },
    contact: { name: "Marco Bellini", role: "Fondatore", email: "marco@kinetica-fit.example.com", source: "sito" },
    drafts: [
      {
        subject: "le vostre recensioni",
        text: "Ciao Marco,\n\nKinetica ha più di 200 recensioni a 4,9 stelle: un risultato raro. Sul sito però non se ne vede traccia, e manca un modo per prenotare una lezione di prova.\n\nLavoro con palestre come la vostra per trasformare la reputazione che già avete in nuove iscrizioni, partendo da una pagina di prova gratuita.\n\nTi interessa se ti preparo una bozza di come potrebbe essere?",
      },
      {
        subject: "re: le vostre recensioni",
        text: "Ciao Marco,\n\nun'idea veloce: tre recensioni vere in un annuncio con \"prenota la tua prova\" funzionano spesso meglio di qualsiasi promozione sul prezzo.\n\nNe parliamo 10 minuti?",
      },
      {
        subject: "re: le vostre recensioni",
        text: "Ciao Marco,\n\nultimo messaggio da parte mia, promesso. Se più avanti vorrete lavorare sulle prove gratuite, scrivimi pure.\n\nBuon allenamento!",
      },
    ],
  },
  {
    company: {
      name: "Studio Dentistico Ferraro (esempio)",
      website: "https://studioferraro.example.com",
      sector: "Studi dentistici",
      city: "Verona",
      instagram: null,
      facebookPage: "https://www.facebook.com/studioferraro.esempio",
      summary: "Studio dentistico con 3 poltrone, specializzato in implantologia e ortodonzia invisibile.",
      target: "Adulti 35-60 anni, famiglie della provincia.",
      weaknesses: "Nessun profilo Instagram, pagina Facebook con post solo sugli orari delle festività.",
      hook: "L'ortodonzia invisibile è il loro servizio di punta ma sul sito è nascosta in una sottopagina.",
      status: "review",
    },
    contact: { name: "Dott.ssa Elena Ferraro", role: "Titolare", email: "segreteria@studioferraro.example.com", source: "sito", emailVerified: true },
    drafts: [
      {
        subject: "ortodonzia invisibile",
        text: "Gentile Dott.ssa Ferraro,\n\nleggendo il sito dello studio ho notato che l'ortodonzia invisibile, che mi sembra uno dei vostri servizi principali, è raggiungibile solo da una sottopagina.\n\nAiuto studi medici a far conoscere i propri servizi di punta a chi li sta già cercando in zona, in modo sobrio e conforme alle regole deontologiche.\n\nLe farebbe piacere ricevere qualche spunto specifico per il vostro studio?",
      },
      {
        subject: "re: ortodonzia invisibile",
        text: "Gentile Dott.ssa Ferraro,\n\nun esempio concreto: una pagina dedicata con le domande più frequenti dei pazienti e la possibilità di richiedere una prima visita.\n\nSe Le interessa, posso mostrarLe un esempio.",
      },
      {
        subject: "re: ortodonzia invisibile",
        text: "Gentile Dott.ssa Ferraro,\n\nnon voglio disturbarLa oltre. Se in futuro vorrà approfondire, resto a disposizione.\n\nCordiali saluti",
      },
    ],
  },
  {
    company: {
      name: "Agriturismo Le Querce (esempio)",
      website: "https://lequerce.example.com",
      sector: "Agriturismi",
      city: "Montepulciano (SI)",
      instagram: "https://www.instagram.com/lequerce_esempio/",
      facebookPage: "https://www.facebook.com/agriturismolequerce.esempio",
      summary: "Agriturismo con 8 camere, ristorante e produzione propria di vino e olio. Organizza degustazioni.",
      target: "Coppie e turisti stranieri (Germania, Nord Europa), wedding di piccole dimensioni.",
      weaknesses: "Prenotazioni solo tramite portali con commissione; il sito non è tradotto in tedesco.",
      hook: "Molti ospiti tedeschi nelle recensioni, ma il sito è solo in italiano e inglese.",
      status: "review",
    },
    contact: { name: "Andrea Bucci", role: "Gestore", email: "info@lequerce.example.com", source: "sito" },
    drafts: [
      {
        subject: "ospiti dalla germania",
        text: "Ciao Andrea,\n\nleggendo le recensioni de Le Querce ho notato quanti ospiti arrivano dalla Germania. Il sito però è solo in italiano e inglese, e le prenotazioni passano quasi tutte dai portali.\n\nAiuto strutture come la vostra ad aumentare le prenotazioni dirette, senza commissioni, partendo dai mercati che già vi scelgono.\n\nTi andrebbe di vedere un paio di idee pensate per voi?",
      },
      {
        subject: "re: ospiti dalla germania",
        text: "Ciao Andrea,\n\nun'idea pratica: offrire la degustazione inclusa a chi prenota dal sito. È un vantaggio che i portali non possono dare.\n\nVuoi che ti spieghi come lo comunicherei?",
      },
      {
        subject: "re: ospiti dalla germania",
        text: "Ciao Andrea,\n\nnon ti scrivo oltre. Se per la prossima stagione vorrete lavorare sulle prenotazioni dirette, sarò felice di sentirti.\n\nUn saluto",
      },
    ],
  },
  {
    company: {
      name: "Ottica Visione Chiara (esempio)",
      website: "https://visionechiara.example.com",
      sector: "Ottici",
      city: "Bari",
      instagram: "https://www.instagram.com/visionechiara_esempio/",
      facebookPage: null,
      summary: "Negozio di ottica indipendente con laboratorio interno e controllo della vista gratuito su appuntamento.",
      target: "Adulti e anziani del quartiere, giovani interessati a montature di design.",
      weaknesses: "Nessuna pagina Facebook, controllo della vista prenotabile solo per telefono.",
      hook: "Offrono il controllo della vista gratuito, ma si prenota solo telefonando in orario di negozio.",
      status: "new",
    },
    contact: { name: "Sara De Santis", role: "Ottica optometrista", email: "sara@visionechiara.example.com", source: "Instagram" },
    drafts: [],
  },
];

function main() {
  // Reset tables (children first)
  db.delete(schema.events).run();
  db.delete(schema.messages).run();
  db.delete(schema.contacts).run();
  db.delete(schema.companies).run();
  db.delete(schema.sequences).run();
  db.delete(schema.settings).run();

  db.insert(schema.settings).values({ id: 1, signature: "Il tuo nome\nIl tuo ruolo · tuosito.it" }).run();
  db.insert(schema.sequences).values({ name: "Standard", steps: [0, 3, 7] }).run();

  for (const item of data) {
    const company = db
      .insert(schema.companies)
      .values({
        ...item.company,
        adLibraryUrl: adLibraryUrl(item.company.name, item.company.facebookPage),
      })
      .returning()
      .get();
    const contact = db
      .insert(schema.contacts)
      .values({ ...item.contact, companyId: company.id })
      .returning()
      .get();
    item.drafts.forEach((d, step) => {
      db.insert(schema.messages)
        .values({
          companyId: company.id,
          contactId: contact.id,
          step,
          subject: d.subject,
          aiDraft: d.text,
          finalText: d.text,
          status: "draft",
        })
        .run();
    });
  }
  console.log(`Seed completato: ${data.length} aziende di esempio.`);
}

main();
