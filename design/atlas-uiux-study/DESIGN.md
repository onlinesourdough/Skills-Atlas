# Skill Atlas — en klarere vej fra overblik til handling

Status: separat, klikbart designudkast. Ikke en ændring af produktet.
Ejer: Gustav / Online Sourdough. Dato: 13. september 2026.

## Opgaven

Gennemgå hele det tilgængelige [Remi-preview](https://skill-atlas-preview.vercel.app/), udtræk relevante HTML/CSS-mønstre, og brug dem til at forbedre vores eksisterende Atlas. Genbrug gerne præcise løsninger, hvor de passer. Bevar vores identitet og produktets grænser. Profilen skal være nederst til venstre. Medtag All skills, onboarding og de små animationer.

Resultatet skal kunne prøves, ikke kun beskrives. Udkastet demonstrerer Graph, Library, Usage, kilder, profil, søgning, supporting files, et lokalt ændringsforslag og onboarding. Ingen af skærmene etablerer en ekstern forbindelse.

## Accepterede designkilder

1. Gustavs instruktioner i denne task.
2. Vores eksisterende Atlas: `README.md`, `docs/design.md`, relevante komponenter og stilark. Produktets varme identitet, kildeidentiteter, dokumenterede referencer og read-only-grænser har forrang.
3. Remis offentlige preview, observeret gennem den faktiske UI. Det er markeret som preview med fiktive Northstar-data; det er ikke verificeret som live produktion.
4. Egne forbedringer, særligt onboarding, mobil, ændringsreview og tydeligere datadækning.

Det eksisterende produkt har allerede fuldtekstsøgning, en komplet Markdown-læser, mobilskuffe, grafnavigation, en femtrins introduktion og GitHub-baseret konto/adgang. De funktioner skal videreudvikles, ikke fejlagtigt behandles som manglende.

## Retning

Et roligt arbejdsredskab med tre tydelige måder at arbejde på:

- Graph: forstå sammenhængene.
- Library: find og læs den konkrete instruktion.
- Usage: forstå observeret aktivitet og dens begrænsninger.

Kilder er den vedvarende kontekst i venstre side. Profilen er et fast anker nederst til venstre. Alt om en skill følger dens identitet på tværs af visningerne. En reference er ikke en målt agentkørsel.

## Det, vi genbruger tæt

| Mønster                | Observeret i referencen                           | Udkastets valg                                           |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Topbar                 | 52 px                                             | 52 px, med vores logo og farver                          |
| Segmenteret navigation | 9 px ydre / 7 px indre radius, 2 px gap           | Samme formprincip; lidt højere knapper                   |
| Søgning                | 230 × 30 px, pill-form                            | Samme desktopmål; global dialog med fuldtekst            |
| Detaljepanel           | 16 px radius, 20 px padding, fast handlingsfod    | Samme geometri; bredere panel og vores solide overflader |
| Små overgange          | Farveskift omkring 150 ms                         | 150 ms hover; særskilt motion til orientering            |
| Usage                  | Kompakte tal, rangerede linjer, klikbar aktivitet | Samme læselogik; dækning og demo-status er eksplicitte   |

Målene er et selektivt genbrug af mønstre, ikke en pixelidentisk kopi af produktet. Ingen reference-branding, skill-tekster eller applikationskode er indbygget i udkastet.

## Vores tokens

| Rolle           | Lys       | Mørk      |
| --------------- | --------- | --------- |
| Baggrund        | `#fffdf7` | `#25231f` |
| Overflade       | `#fffefa` | `#2e2b25` |
| Sidebar/chrome  | `#f7f3eb` | `#211f1b` |
| Primær tekst    | `#30251e` | `#f2ede2` |
| Brødtekst       | `#60554b` | `#c6beb1` |
| Sekundær tekst  | `#71665b` | `#aea596` |
| Primær handling | `#624535` | `#eadfca` |
| Fokus           | `#2b6f98` | `#92c4e6` |

Geist Sans og Geist Mono er genbrugt fra vores produkt med den medfølgende OFL-licens. Atlas-ikonet er ligeledes vores eksisterende asset. De seks kildefarver bærer identitet; labels og kildeangivelse bærer betydningen uden at kræve farvesyn.

## Komponenter og flowkontrakter

### Sidebar og navigation

- Desktop: 244 px sidebar; 215 px i det mellembrede layout.
- Kildecheckboxes filtrerer Graph, Library og Usage samlet.
- All skills har altid det samlede antal indlæste eksempel-skills. Klik nulstiller kilde- og tekstfiltre og åbner biblioteket.
- Et filtreret bibliotek viser eksempelvis `35 / 44`, ikke et tvetydigt totalantal.
- Possible overlaps er en separat undersøgelse. Ingen automatisk merge eller sletning.
- Profilmenuen åbner over profilen nederst til venstre. Konto, agentadgang, udseende og hjælp er adskilt.

### Graf

- Deterministiske kildegrupper. Ingen konstant bevægelse af klikmål.
- Hover viser en lokal label og relaterede kanter uden at flytte kameraet.
- Valg åbner et panel med beskrivelse, kilde, referencer i begge retninger og næste handling.
- Noder og labels bevæger sig sammen ved kameraskift; labels beholder læsbar skriftstørrelse.
- Fit, zoom, pan, listealternativ, navngivne noder og piletast/Enter-navigation.
- Mobil får to kildekolonner i højden. Valg åbner detaljer som en selvstændig skærm.

### Library og editor

- En kompakt liste giver plads til dokumentet. Valg, kilde og referencescope følger med fra grafen.
- Read / Source / Files gør hele skill-mappen forståelig uden at presse tekniske detaljer ind i listen.
- Frontmatter er metadata, ikke en tilfældig overskrift i brødteksten. Raw source beholder den.
- Prototype-rendereren viser HTML som tekst; den henter ikke eksterne billeder eller dokumenter.
- Read-only-kilder tilbyder ikke en editor. My Skills og Team Skills demonstrerer en fremtidig proposal-UI.
- Markdown → Preview → Review changes → tydeligt afgrænset proposal-trin. Ingen falsk PR eller “saved”-besked.
- Tom/ugyldig kladde blokeres. Ugemte ændringer kræver et aktivt valg, før de forlades.
- Fuld diff starter omkring den første ændring. Kilden forbliver uændret i dette udkast.

### Usage

- Starttilstanden er “Activity is not connected”, ikke en graf med opdigtede nuller.
- Library health kan læses uden telemetry.
- “Explore sample activity” aktiverer eksplicit fiktive tal og perioder.
- Mest brugte skills, dækning og seneste aktivitet leder tilbage til samme skill.
- “Not observed in this sample” medfører ikke en anbefaling om at slette en skill.
- Ingen medarbejder-ranking. Events og identitetsdata kræver en særskilt accepteret tracking-kontrakt.

### Onboarding

Den eksisterende introduktion forklarer problemet i fem trin. Udkastet samler den første brugsrejse i tre:

1. Start: én kort forklaring, en lille grafillustration og en konkret eksempelstart.
2. Choose sources: vælg et lille relevant sæt. Antal opdateres, og nulvalg kan ikke fortsætte.
3. Explore: se, hvad du får, og åbn den første skill eller grafen.

GitHub-adgang forklares separat med en afvist tilstand og recovery. Ingen loginhandling i prototypen. Agentforbindelse er et senere, selvstændigt tilvalg. Guiden kan springes over og genåbnes fra profilen. Mobil afslutter guiden i en brugbar læser uden en efterladt skuffe ovenpå.

## Motion-kontrakt

| Situation        | Udkast                        | Formål                                 |
| ---------------- | ----------------------------- | -------------------------------------- |
| Hover/farver     | 150 ms                        | Vis det mulige klikmål                 |
| Visningsskift    | 180 ms fade                   | Markér skift uden at forskyde indhold  |
| Profilmenu       | 180 ms / 5 px                 | Forbind menuen med dens anker          |
| Dialog           | 200 ms / 5 px                 | Let indgang; ingen stor zoom           |
| Inspector        | 240 ms / 8 px desktop         | Vis sammenhæng med grafvalget          |
| Kamera           | 360 ms ease-out               | Bevar orientering; labels følger noder |
| Onboarding-trin  | 220 ms / 8 px                 | Tydelig fremdrift                      |
| Onboarding-noder | 550 ms med kort stagger       | Forklar samlingen af kilder            |
| Usage-bars       | 360 ms, 22 ms stagger         | Læs en ordnet fordeling én gang        |
| Loader           | Seks kildefarver, 1,8 s omløb | En genkendelig ventetilstand           |

Prototypens loader vises kunstigt i ca. 1,15 s for at kunne bedømme bevægelsen. Det er **ikke** et forslag om kunstig ventetid i produktet. Der skal loader/skeleton følge den faktiske loading-state, og fejl/retry skal afløse ventetilstanden.

`prefers-reduced-motion` slår CSS-animationer og overgange fra. Kameraet går direkte til sin nye position. Der er ingen lyd i udkastet.

## Responsive og tilgængelighed

Ved højst 820 CSS-pixels bliver sidebar til en fokusafgrænset skuffe; liste og læser er sekventielle. Profilen forbliver i skuffens bund. Dialoger kan scrolle og har synlig lukning. Search har Cmd/Ctrl-K, pil op/ned, Enter og Escape; reader-tabs har piletaster; grafen har et listealternativ.

De faktisk verificerede UI-bredder er ca. 1441, 819, 391 og 375 CSS-pixels. Browseradapterens zoom/minimumsbredde påvirkede de nominelle viewport-tal; 320 px blev ikke fysisk verificeret. Ingen samlet WCAG-certificering er påstået. Se `REVIEW.md` for afgrænset evidens.

## Teknisk afgrænsning og fortsættelse

- Selvstændig HTML/CSS/JavaScript, uden framework eller afhængigheder under afvikling.
- 44 oprindeligt skrevne, fiktive skills / 6 eksempelkilder / 40 fiktive referencer.
- Ingen `fetch`, OAuth, telemetry, backend eller persistent lagring i klienten.
- Tema, import og kladder er i hukommelsen. Reload nulstiller eksemplet.
- Prototypekoden erstatter ikke produktets Markdown-parser, rettighedskontrol, kildeidentiteter eller revisionsvalidering.
- Produktrepository, ejersystem og andre tasks er ikke ændret eller kontaktet.

Næste beslutning er, hvilke dele af denne retning Gustav vil tage ind i produktet. Først derefter bør der laves en afgrænset implementation i det eksisterende React-produkt. Prioriteret forslag findes i `AUDIT.md`; selve den nye retning er samlet her, i `DESIGN.md`.
