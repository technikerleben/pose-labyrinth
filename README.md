# Pose-Labyrinth

Browserbasierter MVP für ein Bewegungsspiel auf dem iPad. Lernende nehmen eigene Körperposen auf; ein lokaler kNN-Klassifikator steuert damit eine Figur durch ein Labyrinth.

## Datenschutz

- Kamerabilder werden nicht hochgeladen oder gespeichert.
- MediaPipe wertet das Livebild im Browser aus.
- Lokal gespeichert werden nur normalisierte Körperkoordinaten.

## Entwicklung

```bash
npm install
npm run dev
```

## Produktion

```bash
npm run build
```

Für die Kameranutzung ist HTTPS erforderlich. Vercel stellt HTTPS automatisch bereit.

## MVP-Umfang

- feste Klassen: Links, Rechts, Hoch, Runter, Neutral
- Trainingsbeispiele lokal speichern
- Live-Klassifikation mit kNN
- Testmodus
- Labyrinthspiel
- JSON-Export

## Nächste Ausbauschritte

1. Projektimport
2. frei benennbare Klassen und Aktionszuordnung
3. IndexedDB statt localStorage
4. Serienaufnahme mit Countdown
5. Qualitätsanalyse und Verwechslungsmatrix
6. PWA/Offline-Modus
