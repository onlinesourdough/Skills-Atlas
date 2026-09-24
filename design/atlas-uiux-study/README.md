# Skill Atlas — UI/UX-udkast

Et separat, klikbart udkast til vores Atlas, inspireret af [Remis offentlige preview](https://skill-atlas-preview.vercel.app/).

[Åbn udkastet](http://127.0.0.1:49201/) · [Prøv onboarding](http://127.0.0.1:49201/?welcome=1) · [Læs gennemgangen](AUDIT.md)

## Prøv det

- Klik på en grafnode, og følg Read skill ind i biblioteket.
- Brug All skills i sidebar til at åbne hele biblioteket og nulstille filtre.
- Prøv kildecheckboxes og global søgning med Cmd/Ctrl-K. Søg eksempelvis efter `second tracking system` for at finde tekst inde i en skill.
- Åbn Read / Source / Files. Supporting Markdown bliver i samme reader.
- Find Weekly review under My Skills, vælg Propose edit, lav en ændring, og se preview og diff. Prøv også at forlade en ugemt kladde.
- Åbn Usage: den begynder uden tracking. Explore sample activity viser den mulige data-UI med tydelig demo-markering.
- Åbn profilen nederst til venstre: Light / Dark / System, onboarding, loading og forklaring af konto/agentadgang.
- Prøv Add a source med `demo/new-library`. Det gennemløber validering, preview og lokal bekræftelse med tre fiktive skills.
- Gør vinduet smalt: kilder og profil bliver en skuffe; graf, detaljer og reader får hver deres skærm.

## Indhold

| Fil                                 | Formål                                                          |
| ----------------------------------- | --------------------------------------------------------------- |
| `index.html`                        | Dokument og fælles shell                                        |
| `atlas.css`                         | Vores visuelle tokens, responsive layout og motion              |
| `atlas.js`                          | Prototypens interaktioner; ingen eksterne API-kald              |
| `data.js`                           | 44 originale, fiktive skills og 40 eksempelreferencer           |
| `DESIGN.md`                         | Samlet designretning, komponent- og motion-kontrakt             |
| `AUDIT.md`                          | Gennemgang af referencen, vores baseline og prioritering        |
| `REVIEW.md`                         | Verificering, begrænsninger og review af det renderede resultat |
| `reference/observed-design.json`    | Faktiske udvalgte DOM-/CSS-observationer                        |
| `reference/extracted-controls.html` | Inerte HTML-udsnit fra referencepreviewet                       |
| `reference/observed.css`            | Udvalgte computed CSS-regler, ikke originalt stylesheet         |
| `reference/coverage.json`           | De 65 reference-læsere og tre supporting files                  |
| `evidence/`                         | Skærmbilleder og afgrænset test-/kontrastevidens                |
| `assets/`                           | Vores eksisterende Atlas-ikon og lokale Geist-fonts + licens    |

## Start igen lokalt

Kræver Node.js. Ingen installation eller build.

```sh
node serve.mjs
```

Kør kommandoen fra denne mappe. Serveren vælger en ledig port og skriver adressen i terminalen. Alternativt kan en ledig fast port angives som første argument. Den binder kun til `127.0.0.1` og serverer statiske filer via GET/HEAD. Ingen mutation-endpoints.

De direkte links ovenfor bruger porten fra denne task. Hvis den lokale preview-server er stoppet, skal du starte den igen og bruge den nye adresse. Onboarding åbnes ved at tilføje `?welcome=1`.

## Grænser

Dette er en designprototype, ikke en ny produktversion. Den eksisterende applikation og andre tasks er ikke ændret. Kilder, indhold, konto, events og foreslåede ændringer er eksempler. Ingen login, repository-læsning, telemetry, agentforbindelse, branch, commit eller PR oprettes.

Tema, source-valg, fiktiv import og kladder lever kun i hukommelsen. Reload nulstiller eksemplet. Kopiér en kladde, hvis du ønsker at beholde den; prototypen har ikke varig kladdelagring.

En rigtig implementation skal bruge produktets eksisterende komponenter og sikkerheds-/adgangskontrakter. Især editor og usage kræver mere end denne visuelle prototype, før de kan tilbydes som virkelige funktioner.
