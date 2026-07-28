# j26-screens

En liten Vite-app som renderar vertikala skärmsidor från J26 CMS. Appen hämtar slide-data via CMS-endpoints, normaliserar innehållet i `src/main.js` och roterar sedan mellan slides baserat på varje slides `durationSeconds`.

Om ingen `slug` anges används det inbyggda standardinnehållet från `src/assets/j26_default.json`.

## Krav

- Node 24
- npm

Installera beroenden:

```bash
npm install
```

## Kom igång

Starta utvecklingsservern:

```bash
npm run dev
```

Bygg för produktion:

```bash
npm run build
```

Förhandsgranska den byggda appen lokalt:

```bash
npm run preview
```

## Runtime-parametrar

Appen läser sin runtime-konfiguration från query-parametrar i URL:en.

| Parameter | Exempel | Effekt |
| --- | --- | --- |
| `slug` | `?slug=j26_default` | Väljer vilken screen som ska hämtas. Om parametern saknas används `j26_default`. |
| `apiBase` | `?slug=min-screen&apiBase=https://example.com/_services/cms/api/screens` | Pekar om CMS-basen. Praktiskt för test mot annan miljö. |
| `animation` | `?slug=min-screen&animation=off` | Stänger av entry-animationer mellan sidbyten. Allt annat beteende är oförändrat. |
| `refreshMinutes` | `?slug=min-screen&refreshMinutes=2` | Tyst bakgrundsuppdatering av slide-data i minuter. Standard är 2 minuter för CMS-slugs och av för `j26_default`. |
| `refresh` | `?slug=min-screen&refresh=off` | Stänger av bakgrundsuppdatering även om `refreshMinutes` eller miljövariabel är satt. |

Exempel:

```text
http://localhost:5173/?slug=j26_default
http://localhost:5173/?slug=my-screen
http://localhost:5173/?slug=my-screen&apiBase=https://app.dev.j26.se/_services/cms/api/screens
http://localhost:5173/?slug=my-screen&animation=off
http://localhost:5173/?slug=my-screen&refreshMinutes=1
```

Tangentbordsinput hanteras utanför webappen, till exempel via en lokal brygga på Raspberry Pi.

Bakgrundsuppdateringen är tyst och byter bara innehåll när API-svaret faktiskt ändrats. När backend stöder `ETag` eller `Last-Modified` skickar appen villkorliga headers och kan få `304 Not Modified`, vilket minskar både payload och CPU.

## Hur Vite fungerar här

Det här projektet använder Vite ganska nära standardflödet, men med några viktiga anpassningar.

### 1. `index.html` är ingången

Vite läser `index.html` som app-entry och laddar sedan `src/main.js` via:

```html
<script type="module" src="/src/main.js"></script>
```

Det betyder att Vite automatiskt hanterar:

- ESM-importer i JavaScript
- CSS-importer som `import './style.css'`
- asset-hantering för filer som JSON, bilder och fonter

### 2. `base: './'` gör builden relativ

I `vite.config.js` är `base` satt till `./`:

```js
export default defineConfig({
	base: './',
})
```

Det gör att byggda asset-URL:er blir relativa i stället för att anta root `/`. Det är viktigt när appen deployas under en nästlad sökväg, till exempel `/_services/screens/`, och inte som en root-app.

### 3. Dev-servern proxar `/_services`

Under lokal utveckling proxar Vite alla anrop till `/_services` vidare till:

```text
https://app.dev.j26.se
```

Det gör att denna runtime-bas fungerar lokalt utan extra CORS-lösningar:

```text
/_services/cms/api/screens
```

Så när du kör `npm run dev` beter sig appen mer som i den riktiga miljön, även om du kör på `localhost`.

### 4. Default-innehållet packas som en asset

I `src/main.js` importeras standard-JSON så här:

```js
import defaultSlidesUrl from './assets/j26_default.json?url'
```

`?url` säger åt Vite att behandla filen som en statisk asset och ge tillbaka en URL till den byggda filen. Vid runtime hämtas den sedan med `fetch(...)`. Det gör att samma kod fungerar både i dev och i byggd produktion.

### 5. Produktion använder annan `base` i Docker-byggsteget

Docker-bygget kör:

```bash
npm run build -- --base=/_services/screens/
```

Det innebär att standardläget i `vite.config.js` är säkert för lokal/nästlad körning, medan container-builden explicit sätter den produktionssökväg som används vid deploy.

## Innehållsflöde i korthet

1. `src/main.js` läser query-parametrar och bygger runtime-konfiguration.
2. Appen hämtar antingen standard-JSON eller CMS-data från `<apiBase>/<slug>/content`.
3. Innehållet normaliseras i `src/lib/screen-content.js`.
4. Layout och block renderas från `src/layouts/` och `src/blocks/`.
5. Slides roteras med `setTimeout(...)` baserat på varje slides varaktighet.

## Felsökning

- Om inget innehåll visas, börja med att kontrollera `slug` i URL:en.
- Om CMS-anrop fallerar lokalt, kontrollera att du kör via `npm run dev` så att Vite-proxyn används.
- Om appen ska köras mot annan backend, sätt `apiBase` i query eller miljövariabeln `VITE_SCREENS_API_BASE`.
- Om äldre skärmar inte ska ha övergångsanimationer, använd `animation=off`.
- Om ni vill ändra bakgrundsuppdatering globalt, sätt `VITE_SCREENS_REFRESH_MINUTES` i miljön.
