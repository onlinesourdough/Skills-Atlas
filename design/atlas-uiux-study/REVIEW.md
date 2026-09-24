# Review af det klikbare designudkast

13. september 2026. Resultat: klar til Gustavs designvurdering. Ikke en production-, backend- eller releasegodkendelse.

## Hvad er verificeret?

Der er 47 afgrænsede, beståede browserkontroller i [checks.json](evidence/checks.json), suppleret med syntax- og fixture-kontrol. De blev udført i det lokale udkast gennem browserens faktiske kontroller. Review er udført af samme agent, ikke en uafhængig reviewer.

| Område          | Bevis                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Navigation      | All skills rydder filtre; skjult selection ryddes; scope/antal er konsistente                                                |
| Graf            | Hover uden kameraflytning; zoom og pan; Fit; piletaster og Enter; inspector-fokus                                            |
| Graf ↔ Library | Valgt skill og kamera bevares ved et normalt tur/retur-forløb                                                                |
| Søgning         | Cmd-K, body-match, tomt resultat, Down/Enter og Escape/fokusretur                                                            |
| Reader          | Frontmatter holdes ude af Read og bevares i Source; supporting Markdown åbner; tabs kan styres med piletaster                |
| Editor          | Tom/ugyldig kladde blokeres; HTML er inert i preview; dirty-guard, Keep editing, Discard og diff; ingen falsk PR-bekræftelse |
| Sources         | Tomt input, dublet, preview før confirm, fiktiv tilføjelse; nul synlige kilder med recovery                                  |
| Usage           | Ingen fabrikerede events i starttilstanden; eksplicit sample; periodevalg ændrer sample-tal; navne bevares på mobil          |
| Onboarding      | Nulvalg blokeres; tre trin til første skill; afvist adgang/recovery; mobil afslutter uden efterladt skuffe                   |
| Mobil           | Fokusafgrænset skuffe, Tab-wrap, Escape og trigger-retur; fuldbredde-reader; brugbar editorfod                               |
| Tema/motion     | Lys/mørk, reduceret CSS-motion og loader, synlig fokusmarkering                                                              |

`node --check` passerer for `atlas.js`, `data.js` og `serve.mjs`. Fixture-kontrollen bekræfter 44 unikke skill-ID'er, seks kilder, 40 gyldige reference-endpoints, overensstemmelse mellem SKILL.md og reader-data samt 65 unikke reference-læsere i auditinventaret. Browserens registrerede page error/warn-log var tom ved slutkontrollerne.

## Visuelt review

| Format, faktisk CSS-størrelse | Gennemgået                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------ |
| ca. 1441 × 900                | Overblik, inspector, library, search, editor/diff, profil, Usage og onboarding |
| ca. 819 × 900                 | Sekventiel tablet-reader og skuffelayout                                       |
| ca. 391 × 844                 | Portrætgraf, inspector, reader, sources og Usage                               |
| 375 × 711                     | Smal Usage, onboarding, editor og mørk profilvariant                           |

Vigtige rettelser under review:

- Mobilgrafen blev omkomponeret til to kildekolonner i højden. Det fjernede det lille, sammenpressede netværk midt på en ellers tom telefonskærm.
- All skills fik én præcis betydning: hele biblioteket, med nulstillede filtre. Andre visninger viser filtreret antal / total.
- Kamera og screen-space labels animeres sammen. Tastaturfokus kan flyttes mellem navngivne noder.
- Mobil-onboarding lukker kilde-skuffen og ender i en aktiv reader.
- Diffen åbner omkring første ændring. Ugemte drafts forsvinder ikke ved et almindeligt navigationsklik.
- Sekundær tekst blev mørkere i lyst tema. Skjulte kilders labels sænkes ikke længere til lav opacity.
- Mørk graf fik lysere forbindelser. Tekst og hover-overflader blev efterkontrolleret.

14 direkte computed-style-tekstprøver og to ekstra live-tokenpar for hover/well er kontrolleret. Den laveste beregnede kontrast i det sidste sæt er 4,62:1. Dette er et afgrænset solid-color-check, ikke en fuld kontrast- eller WCAG-audit. Diagramkanter, alle opacity-kombinationer, alle disabled states og alle små badges er ikke dækket af det tal.

## Design-, princip- og sprogreview

- **Opgaven:** udkastet bruger vores produkt som baseline og Remi som reference. Profilens ønskede placering, All skills, animationer og onboarding er konkrete dele af resultatet.
- **Genbrug:** vores ikon, lokale fonts, varme palette og produktgrænser er bevaret. Referenceudtræk og vores nye implementation ligger separat.
- **Enkelhed:** ingen ny framework-installation, services, konti eller tracking. Den lokale server er et lille, read-only hjælpemiddel.
- **Troværdighed:** demo-data, ukendt usage, fiktive referencer og manglende eksterne forbindelser er eksplicitte. Der påstås ikke en gemt ændring, login eller PR.
- **Recovery:** de mest relevante lokale fejl- og tomtilstande kan prøves uden at påvirke brugerens repositories.
- **Sprog:** UI følger det eksisterende produkts engelske sprog; owner-rapporten er dansk. Knapper beskriver handlinger. Onboarding forklarer værdien kort og slutter med et konkret næste skridt.
- **Visuel aflevering:** de renderede skærme er gennemgået, ikke kun kildekoden. De vigtigste sammenhænge kan prøves i den faktiske prototype.

Det er grundlaget for at præsentere designretningen som vurderbar. Det er ikke en påstand om, at alle foreslåede features skal bygges.

## Begrænsninger

- Den nuværende produktapplikation blev ikke startet eller ændret. Ingen rigtige OAuth-, permissions-, GitHub-, MCP- eller telemetry-forløb blev testet.
- Clipboard og browser-download er implementeret som lokale eksempelhandlinger, men sideeffekterne blev ikke udført under review.
- Native browser Back/Forward, fysisk touch, fuld skærmlæserdækning og alle support-filformater er ikke end-to-end-verificeret.
- Den lille prototype-renderer demonstrerer sikker, inert Markdown-tekst, men erstatter ikke produktets komplette Markdown-kontrakt.
- Browseradapteren brugte 0,64 sidezoom og en minimumsbredde. Derfor er faktiske CSS-dimensioner læst tilbage. En nominel 320 px-test blev i praksis 375 px; 320 px er ikke godkendt.
- Adapterens `fill("")` tømte ikke textareaet. Tom-validering blev derfor verificeret med rigtige Select all/Backspace-tastetryk. `inert` blev verificeret gennem DOM-attribut og fokusadfærd, da adapteren ikke eksponerede property-værdien.
- En baggrundsfane kunne fastholde overgangsframes i screenshots, selv om computed opacity var 1. De sidste desktop-slutbilleder af graf, inspector, profil og Usage er derfor taget med reduceret bevægelse. Det ændrer ikke slutlayoutet. Normal motion findes i prototypen; emuleringsindstillingen nulstilles før aflevering.
- Øvrige billeder dokumenterer de tilhørende gennemløb. Enkelte er taget før den sidste lille kontrastjustering; der blev ikke ændret mobil-layout efter disse billeder.

## Evidens og integritet

- [Graf](evidence/desktop-graph.jpg), [inspector](evidence/desktop-inspector.jpg), [library](evidence/desktop-library.jpg), [diff](evidence/desktop-edit-diff.jpg), [profil](evidence/desktop-profile.jpg), [Usage](evidence/desktop-usage.jpg).
- [Onboarding: start](evidence/onboarding-welcome.jpg), [kilder](evidence/onboarding-sources.jpg), [klar](evidence/onboarding-ready.jpg).
- [Mobilgraf](evidence/mobile-graph.jpg), [mobilreader](evidence/mobile-reader.jpg), [mobilskuffe](evidence/mobile-sources.jpg), [mobil-onboarding](evidence/mobile-onboarding.jpg), [mobileditor](evidence/mobile-editor.jpg).
- [47 kontroller og kontrastprøver](evidence/checks.json). [Artifact-hashes](evidence/artifact-sha256.txt) binder de centrale leverancefiler til de afsluttende kontroller.

SHA-256 for de seks undersøgte produktfiler — README, docs/design, App, GraphView, PersonalAtlas og styles — matcher værdierne fra før arbejdet. Det eksisterende dirty worktree er ikke ryddet, ændret eller forsøgt normaliseret. Ingen anden task er blevet kontaktet, og der er ikke sendt arbejde til OSAPP.

Næste skridt er Gustavs vurdering af retningen. En senere produktimplementation bør starte med den eksisterende shell/navigation og bevare de nuværende data- og adgangskontrakter.
