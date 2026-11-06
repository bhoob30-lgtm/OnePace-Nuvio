# One Pace (HTTP) – addon per Nuvio / Stremio

Streaming diretto da Pixeldrain, senza torrent. L'addon restituisce solo l'elenco degli
episodi: il video arriva direttamente da Pixeldrain al tuo player.

## Opzione A – Cloud con Vercel (consigliata)
1. Crea un account gratuito su github.com e un repository nuovo (es. `onepace-nuvio`).
   Carica tutti i file di questa cartella (compresa la cartella `api` e `vercel.json`).
2. Vai su vercel.com → "Sign up" con GitHub → "Add New… → Project" → scegli il repository → Deploy.
   Non cambiare nessuna impostazione.
3. A fine deploy ottieni un indirizzo tipo `https://onepace-nuvio.vercel.app`.
   Controlla che aprendo `https://onepace-nuvio.vercel.app/manifest.json` compaia del testo JSON.
4. In Nuvio: Impostazioni → Addon → aggiungi tramite URL → incolla quel link `.../manifest.json`.

## Opzione B – Termux sul telefono
    pkg update && pkg upgrade
    pkg install nodejs git        # oppure copia la cartella sul telefono
    cd onepace-nuvio
    npm start
Manifest: http://127.0.0.1:7000/manifest.json (incollalo in Nuvio sullo stesso telefono).
Termux deve restare aperto in background (attiva "Acquire wakelock" dalla notifica).

## Note
- Se Pixeldrain non risponde con `pixeldrain.com`, puoi impostare la variabile
  d'ambiente `PIXELDRAIN_URL=https://pixeldrain.net`.
- Pixeldrain ha un limite di banda giornaliero per IP: se lo stream si ferma, riprova più tardi.
- Gli episodi con più versioni (sub/dub, 1080p/720p) compaiono come stream diversi.
- La lista viene messa in cache per 1 ora. Per nuovi archi basta aggiungere una riga a `arcs.json`.
