#!/bin/bash
# Double-click launcher for macOS: installs, prepares and starts the CRM.
cd "$(dirname "$0")"
printf '\033]0;CRM Outreach - NON CHIUDERE QUESTA FINESTRA\007'
if ! command -v node >/dev/null 2>&1; then
  echo; echo "  Node.js non è installato. Segui la Parte 1 della guida."; echo
  read -r -p "Premi Invio per chiudere..."; exit 1
fi
[ -f .env.local ] || cp .env.example .env.local
echo; echo "  Preparazione in corso... (la prima volta può richiedere alcuni minuti)"; echo
if ! (npm install --no-audit --no-fund && npm run db:push && npm run build); then
  echo; echo "  Qualcosa è andato storto. Fai uno screenshot di questa finestra e mandalo."
  read -r -p "Premi Invio per chiudere..."; exit 1
fi
(sleep 6; open "http://localhost:3000") &
echo
echo "  ============================================================"
echo "   Il CRM è acceso: http://localhost:3000"
echo "   Lascia aperta questa finestra. Per spegnere il CRM, chiudila."
echo "  ============================================================"
echo
npm run start
