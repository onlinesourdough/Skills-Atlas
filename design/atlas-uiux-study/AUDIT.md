# Skills Atlas: gennemgang af referencen og forslag til vores produkt

13. september 2026 · [Reference](https://skill-atlas-preview.vercel.app/) · [Klikbart udkast](http://127.0.0.1:49201/) · [Prøv onboarding](http://127.0.0.1:49201/?welcome=1)

## Konklusion

Det mest værdifulde ved Remis Atlas er sammenhængen mellem en kompakt ramme, en indbydende graf, et konkret skill-panel og let adgang til læsning. De små overgange gør produktet mere færdigt. Det bør vi lade os inspirere tæt af.

Vores produkt har allerede flere af de vigtige grundfunktioner: fuldtekstsøgning, komplette skill-tekster, kildeidentiteter, dokumenterede forbindelser, mobilnavigation og en introduktion. Vi behøver ikke genbygge det. Vi kan gøre det tydeligere, lettere at navigere og mere konsekvent.

Den nye prototype viser retningen med vores farver og skrifter, profil nederst til venstre, All skills, en bedre læsebalance, supporting files, motion og en handlingsorienteret onboarding. Editor og Usage er tydeligt markerede designforslag, ikke aktiverede produktfunktioner.

## Hvad gennemgangen faktisk dækker

Referenceatlasset blev gennemgået via dets offentlige UI. Alle 65 unikke skill-læsere blev åbnet; tre eksponerede supporting Markdown-filer blev læst. Graf, søgning, editorens åbning/annullering, Usage, profilmenu, tema, assistent og smalle layouts blev undersøgt. [Den præcise læserinventarliste](reference/coverage.json) er gemt separat.

Vigtigt: siden kalder sig selv “Skill Atlas — Preview”. Den bruger et fiktivt Northstar-team; editoren siger, at den ikke skriver til et rigtigt repository. Jeg har **ikke** verificeret, at dette er Remis live produktionsversion. Aktivitetsdata er demonstrationsdata, ikke dokumentation for en faktisk telemetry-integration.

| Område         | Gennemgået                                                                 | Afgrænsning                                                       |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Loading        | Første load og færdig graf                                                 | Varighed og netværksperformance ikke benchmarkmålt                |
| Navigation     | Graph, Library, Usage, kategorier og All skills                            | Kun eksponerede UI-veje                                           |
| Graf           | Hover, valg, forbindelser, zoom, Fit og pan                                | Ingen fuld stresstest af store datasæt                            |
| Library        | Alle 65 læsere, søgning, kategori/skift og tom søgning                     | Ikke faglig kvalitetssikring af skill-indhold                     |
| Filer          | Tre supporting `.md`-filer                                                 | Ingen image/PDF/script-file eksponeret i de 65 læsere             |
| Edit           | Åbning, initial disabled Save, rå Markdown, Cancel                         | Ingen ændring gemt hos referencen                                 |
| Usage          | Oversigt, rangering, personer, stille skills, aktivitet, footer            | Fiktive tal; ingen connector-test                                 |
| Profil         | Appearance og Sound-menu                                                   | Ingen rigtig kontoadministration eksponeret; lyd ikke lyttetestet |
| Ask Atlas      | Ét foreslået newsletter-spørgsmål, svar, skill-link, minimér               | Ingen private data indsendt; ingen agentkørsel startet            |
| Responsive     | Desktop, telefonbredde og tabletbredde                                     | Browseremulering, ikke fysisk telefon                             |
| Tilgængelighed | Søgetastatur, fokusindikationer, grafsemantik, reduced-motion-indikationer | Ingen fuld skærmlæser- eller WCAG-audit                           |

Vores aktuelle kode og accepterede designdokument er læst som baseline. Skærmbilleder fra den tidligere 9. september-test blev også set, men de er historisk evidens. Produktet blev ikke startet på ny, og denne audit er ikke en ny runtime-godkendelse af produktets backend.

## 1. Den samlede ramme

### Topbar og navigation

Referencens 52 px topbar er en god størrelse. Graph / Library / Usage ligger i én kompakt, segmenteret kontrol. Aktivt valg får en diskret overflade og skygge i stedet for meget farve. Det giver plads til indholdet.

**Vores valg:** tæt genbrug af form og dimensioner. Behold vores varme farver og brand. Tre hovedvisninger er tilstrækkeligt; konto og administration skal ikke konkurrere med dem. Det skal være tydeligt, hvad der er aktivt, med både kontrast og semantik.

### Sidebar og All skills

Remis sidebar bruger tydelige grupper, farver og små antal. All skills gør det let at komme ud af en afgrænset visning. Det er et af de små greb, der fortjener en fast plads hos os.

Der er dog en konkret scope-uoverensstemmelse i previewet: All skills angiver 57, mens biblioteket og assistenten omfatter 65. De ekstra otte ligger i et read-only pack. Et totalantal må ikke skifte betydning uden forklaring.

**Vores valg:** All skills viser hele det indlæste bibliotek og nulstiller source- og tekstfiltre. Kildecheckboxes kan kombineres. Filtrerede visninger viser eksempelvis `35 / 44`. Possible overlaps ligger separat og tælles inden for det aktuelle kildevalg.

### Profilens placering

Referencens avatar er øverst til højre. Menuen indeholder primært Appearance og Sound; den demonstrerer ikke en komplet brugerprofil.

**Vores valg:** Gustavs ønskede placering nederst til venstre. En lille, stabil profilmenu med identitet, konto/adgang, agentforbindelse, udseende og hjælp. Den dybere konto- og rettighedsinformation åbnes, når den er relevant. Det reducerer den store informationsmængde i vores nuværende account-dialog uden at skjule adgangsgrænserne.

### Overflader og detaljer

Referencen bruger systemtypografi, lette skygger, glasagtige paneler, små badges, tynde separators og få stærke accentflader. Det føles roligt, men dele af metadata og forbindelser er meget svage visuelt.

**Vores valg:** samme tilbageholdenhed, ikke samme materialer overalt. Vores papir-, sand- og valnødspalette samt Geist bevares. Solide dokumentflader er mere robuste for læsning end gennemsigtighed over et netværk. Mørk tilstand får særskilt justerede forbindelser.

## 2. Loading og små animationer

### Loading

Den observerede loader består af farvede punkter og en kort besked. Den giver en genkendelig overgang til atlasgrafen. Det er en stærk idé, fordi ventetilstanden bruger samme visuelle sprog som slutresultatet.

**Vores valg:** seks farvede punkter omkring et lille Atlas-center. Farverne svarer til kilderne. I prototypen kan den afspilles igen fra profilen. I produktet skal den følge virkelig indlæsning, ikke lægge en kunstig pause ind. Efter en fejl skal der stå, hvad der fejlede, og hvad brugeren kan prøve.

### Hover, press og panelskift

Farveskift, små press-effekter og ind-/udgange binder referencen sammen. Hover på grafen fremhæver relationer uden at kræve et klik. Editorens korte åbningstilstand giver feedback på handlingen.

**Vores valg:** korte, forskellige overgange til forskellige formål. Hover omkring 150 ms, paneler omkring 180–240 ms og et lidt længere kameraskift. Noder skal ikke flyde rundt, mens brugeren prøver at ramme dem. Kamera og labels skal følges ad. Et færdigt onboarding-trin må gerne få et lille check; hver klikhandling behøver ikke en effekt.

### Reduced motion og lyd

Referencepreviewets fulde reduced-motion-adfærd er ikke verificeret. En observeret kameratransition på omkring 0,7 s var fortsat til stede i det udtrukne DOM/CSS under den afgrænsede undersøgelse. Det er et opfølgningspunkt, ikke en komplet compliance-dom. Sound On/Off var eksponeret, men lyden er ikke bedømt.

**Vores valg:** reduced motion er en del af samme komponentkontrakt som normal motion. Ingen lyd tilføjes nu. Præcise forslag til varigheder ligger i [DESIGN.md](DESIGN.md).

## 3. Grafen

### Overblik og grupper

Kategorifarver og grupper gør det hurtigt at forstå referencens univers. Størrelse bruges som et signal om antal forbindelser, ikke antal agentkørsler. Kategorivalg fremhæver/fokuserer et område og dæmper resten.

**Vores valg:** behold repository/kilde som vores primære gruppering. Gør forskellen mellem kilde, kategori, reference og mulig overlap eksplicit. En større node må ikke fejltolkes som “mere brugt”. Detaljepanelet skal forklare, hvad tallet betyder.

### Hover og valg

Hover giver hurtig information. Et valgt element får et kompakt panel med beskrivelse, metadata, relaterede skills og handlinger. Det er en god bro fra et abstrakt netværk til noget brugbart.

**Vores valg:** behold begge niveauer: hover til orientering, klik til et fastholdt valg. Inspector skal have en fast fod med Read skill og eventuelt Propose edit. Panelets relationsliste scroller; handlingen forsvinder ikke nederst i listen.

### Forbindelser og formuleringer

Referencen bruger bl.a. “Orchestrates” og “Orchestrated by”. Det lyder stærkere end en almindelig filreference. Hvis der ikke ligger dokumentation for reel orkestrering bag, kan formuleringen skabe en forkert mental model.

**Vores valg:** References og Referenced by, med kilde og file/line-evidens. Runtime-brug er en anden datatype. Mulige overlaps vises aldrig som sikre referencekanter. I prototypen er referenceeksempler og linjenumre markeret som fiktive.

### Kamera, labels og skærmplads

Referencens labels kan støde sammen i tætte områder, og relaterede noder kan havne uden for skærmen eller bag panelet. Fit og zoom er vigtige recovery-kontroller, men de erstatter ikke en god default-komposition.

**Vores valg:** panelet får sin egen plads på desktop. Valgt skill og nærmeste dokumenterede forbindelser får prioritet. Labels beholder skriftstørrelsen, selv om grafen zoomer. På mobil er graf og inspector separate skærme; overview-kilderne fordeles i to kolonner i højden.

### Tastatur og listealternativ

Søgningen kan betjenes med tastatur i referencen. En tilsvarende tastaturadgang til hver grafnode blev ikke etableret i gennemgangen.

**Vores valg:** navngivne grafnoder, piletaster til fokus, Enter/Space til valg og en tydelig List-knap. Grafen må ikke være den eneste vej til indholdet.

## 4. Søgning og sammenhæng mellem visninger

Referencens søgefelt er placeret, hvor man forventer det, med Cmd-K som genvej. Resultater forbinder navn med kontekst. Down/Enter og Escape fungerede i testen.

I den observerede “campaign”-søgning kom campaign-launch og campaign-brief frem, mens andre beskrivelser med ordet ikke gjorde. Det er ikke belæg for at beskrive referencen som fuldtekstsøgning. En søgning uden resultater viser en forståelig tomtilstand, men den tidligere reader kan forblive synlig ved siden af.

**Vores valg:** bevar vores eksisterende fuldtekstsøgning. Gør søgningens scope, matchende uddrag og kilde synlige. Søg både titel, beskrivelse, path og filindhold. Global søgning skal kunne åbnes fra alle hovedvisninger og på mobil. Tomme resultater skal foreslå en recovery uden at se ud som en fejl.

Referencen har gode krydslinks: Read skill fra grafen, skill-navne i Usage og skill-links fra assistenten. Der var også inkonsistens: et observeret graf→library-skift nulstillede kategorien til All, mens aktivitet→library kunne anvende en kategori.

**Vores valg:** normal navigation bevarer selection og source-scope. Kun en eksplicit handling som All skills nulstiller filtrene. Browser-URL og delbare skill-identiteter må ikke afhænge af, hvilken vej man kom ind. Vores eksisterende stabile identiteter skal bevares ved en rigtig implementation.

## 5. Library, læsning og filer

### Liste/læser-balance

Referencens liste indeholder navn, kategori, beskrivelse og brugstal og er mærket “Most used first”. Der blev ikke fundet en eksponeret sorteringskontrol. På den undersøgte desktopvisning bruger listen meget plads, mens dokumentet bliver relativt smalt.

**Vores valg:** en kompakt liste med beskrivelse og kilde; større plads til selve instruktionen. A–Z som troværdig standard, da vores produkt ikke har usage-data. Most connected og By source kan være alternative sorteringer. Dublerede navne skilles ad gennem repository/shelf, ikke tilfældige labels.

### Reader og frontmatter

Reference-læseren har en god dokumentfølelse. Men nogle læsere, eksempelvis Weekly Issue og Campaign Brief, gengav metadata/frontmatter som en mærkelig overskrift, mens andre blev vist korrekt.

**Vores valg:** behold vores safe Markdown-rendering og eksplicit metadatahåndtering. Read viser dokumentet; Source viser præcis filtekst. Kilde, path, revision og access er tilgængelige uden at dominere læsningen. En udvidet læsetilstand er nyttig til længere skills.

### Supporting files

Dette er et særligt godt referencegreb: skill-mappen er synlig, og små støttefiler kan læses samme sted. De tre faktiske flerfils-eksempler var:

- Brand Voice → `references/examples.md` (318 B).
- Campaign Brief → `references/template.md` (145 B).
- Visual System → `references/palette.md` (155 B).

Alle tre blev åbnet. Download blev eksponeret, men ikke udført. På trods af bredere introduktionstekst blev scripts, billeder og PDF'er ikke fundet blandt de eksponerede filer i de 65 læsere.

**Vores valg:** tilføj en Files-fane med path, størrelse, filvalg og læsevisning. Bevar referencer tæt på skillen. I første implementation bør det være en afgrænset, sikker Markdown-/tekstvisning. Billeder, PDF og andre filtyper kræver deres egen load-, permission- og renderkontrakt; de er ikke automatisk dækket af denne prototype.

### Read-only-tilstande

Det eksterne Field Notes-pack er read only i referencen. Der er ikke samme redigerbare body som i company-skills, og noget generisk hjælpetekst er mindre præcist i denne tilstand.

**Vores valg:** adgang påvirker både knappen, hjælpeteksten og næste handling. En read-only-skill tilbyder læsning, kopiering af det tilladte indhold og kildeinformation — ikke en editor, som først afviser brugeren efter et langt forløb.

## 6. Edit og ændringsforslag

I referencen åbner Edit rå Markdown med Cancel og Save. Save er deaktiveret, før der er ændringer. Cmd-S er forklaret i foden, og en tydelig note siger, at dette kun er preview og ikke et rigtigt repository. Det er en enkel, behagelig redigeringsflade. Gemning og valideringsfejl blev ikke afprøvet på reference-sitet.

**Vores valg:** genbrug den direkte adgang og den enkle editor, men tilpas forløbet til vores produktgrænse:

1. Åbn en lokal kladde med tydelig kilde og revision.
2. Redigér Markdown og skift til Preview uden at miste kladden.
3. Valider minimumskontrakten og beskyt ugemte ændringer.
4. Vis en diff omkring den faktiske ændring.
5. Gå først videre til en proposal efter ny kontrol af adgang og revision.

Det nuværende produkt har en aktiv read-only-grænse. Den må ikke ophæves som en bivirkning af en visuel redesignopgave. Prototypen viser derfor “No pull request was created” i sidste trin. Den skriver ikke engang ændringen tilbage til den fiktive kilde. En faktisk PR-funktion kræver særskilt godkendelse og test af stale source, mistet adgang, retry og recovery.

## 7. Usage

Referencepreviewet viser bl.a. 1.776 runs, syv personer, 49 skills i brug, otte “quiet” skills, en “Most used”-rangering, personopdeling, manglende tracking og 12 nylige aktiviteter. Det sidste afsnit angiver en tracking-startdato. Skill-links kan åbnes direkte i Library.

Det er en stærk informationsrækkefølge: oversigt først, konkrete eksempler bagefter. Det er også godt, at en person uden tracking og en ældre klient/session bliver forklaret. Men taldene er fiktive, og en stille skill er ikke nødvendigvis overflødig. Referencens opfordring til oprydning kan ikke overføres uden at kende dækning og kontekst.

**Vores valg:**

- Bevar nuværende produkts ærlige “ikke forbundet”-tilstand.
- Vis repository health uden at lade den ligne agentaktivitet.
- Når tracking engang findes: tidsvindue, indsamlingens start, seneste event og dækkede kilder skal følge tallene.
- “Mest brugte” og seneste aktivitet bør være klikbare og bevare skill-identitet.
- Skeln mellem nul observerede events, ukendt brug og frakoblet tracking.
- Ingen automatisk konklusion om at slette en skill.
- Personstatistik er ikke et default-designkrav. Vi kan skabe værdi på skill-/kildeflowet uden at bygge et medarbejder-leaderboard.

Prototype-skærmen har en eksplicit sample-knap og 7/30/90-dages eksempelperioder. Der er ingen reel telemetry-integration bag tallene.

## 8. Ask Atlas og agentforbindelse

Referencen har en grafbaseret assistent, der oplyser at kende alle 65 skills. Ét af dens foreslåede spørgsmål om newsletter-flow blev prøvet. Svaret viste ventestatus/streaming, beskrev et forløb og linkede til konkrete skills. Et skill-link valgte den tilsvarende grafnode; assistenten kunne minimeres.

**Det værdifulde mønster:** et svar kan lede til verificerbart indhold og et fælles valg i UI'en. Små prompts gør en ukendt mulighed lettere at afprøve.

**Vores valg:** kopier ikke automatisk en indbygget chat. Vores produkt har en read-only MCP-retning, hvor samtalen bliver i brugerens agent. Gør agentforbindelsen forståelig, forklar samtykket, og lad links lande på den rigtige skill. UI-udkastet viser dette tilvalg; det opretter ingen forbindelse og opfinder ingen endpoint-URL.

## 9. Onboarding og første brug

Der blev ikke fundet et gennemløbbart onboarding-/loginflow i den offentlige reference. CSS-variabler med “login” i navnet er ikke bevis for en testet loginskærm.

Vores eksisterende onboarding har fem fortællende trin: spredte skills, isolerede ændringer, fælles Git-bibliotek, inspektion og reviewed distribution. Der er allerede Skip, frem/tilbage, progress, replay og slutvalg mellem Explore Atlas og Import repository. De nyttige principper skal bevares.

**Forbedringen:** kortere afstand fra forklaring til faktisk værdi. Lad første brugsrejse være Start → Choose sources → Explore, med et eksempel som lavrisiko-start. Vis antal og kildevalg før import. Slut ved en konkret skill, ikke kun en generisk “Done”-skærm. Den mere omfattende forklaring kan være hjælp, ikke fem obligatoriske sider før første resultat.

GitHub-sign-in skal forklare, hvad brugeren giver adgang til, og hvad der ikke gives adgang til. Afvist adgang skal have recovery. Agentforbindelse og tracking er særskilte valg, ikke skjulte konsekvenser af login. Replay ligger i profilmenuen.

## 10. Mobil, tomtilstande og robusthed

### Hvad der blev observeret hos referencen

Ved telefonbredde optager den faste sidebar fortsat en stor del af skærmen. Library-reader bliver klemt/skjult til højre, og søgning/avatar er ikke let tilgængelige. I Usage bliver navne stærkt afkortede, mens barer og tal tager pladsen. Ved tabletbredde kan beskrivelser blive meget høje i den smalle liste. Dette er lokal clipping i layoutet, ikke nødvendigvis horisontal scroll på dokumentet.

### Vores valg

Bevar og videreudvikl vores eksisterende mobile skuffe og sekventielle læseflow. Det nye udkast går videre med en portrættilpasset graf, mobil-inspector, tydelig tilbagevej, læsbar Usage-navnekolonne og fuldbredde-editor. Kontoen forbliver nederst i kilde-skuffen.

Tom søgning, ingen kilder, read-only, manglende usage, ugyldigt input, dublet og afvist login har hver sin konkrete besked og recovery. Ved fejl skal brugerens kontekst eller kladde ikke bare forsvinde. En loading-animation er kun én af disse tilstande.

## Hvad bør overføres først?

Dette er et prioriteringsforslag, ikke en ordre om at ændre produktrepositoryet.

| Trin                 | Arbejde                                                           | Hvad skal bevises?                                                         |
| -------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 — ramme            | Kompakt navigation, bundprofil, All skills, tydeligt filteromfang | Samme source-scope i alle views; ingen ændret auth/adgang                  |
| 2 — finde og læse    | Søgeindgang, matchuddrag, liste/læser-balance, tilbageveje        | Bevar den eksisterende fuldtekst og stabile selection/URL                  |
| 3 — grafens detaljer | Inspector, relationshierarki, læsbare labels, roligt kamera       | Evidens og retning er korrekte; hover flytter ikke kameraet                |
| 4 — første brug      | Kortere onboarding med source-preview og første skill             | Nulvalg, afvisning, cancellation, replay og mobilafslutning                |
| 5 — filkontekst      | Supporting files i samme reader                                   | Tilladt source/revision, sikre filer og tydelige unsupported states        |
| På tværs             | Loading, hover, paneler, fokus og reduced motion                  | Ingen kunstig ventetid; tastatur og mobil fungerer efter samme ændring     |
| Senere, særskilt     | Reelle edit-proposals                                             | Accepteret write-grænse, permissions, revision/diff, retry/recovery        |
| Senere, særskilt     | Reelle usage-events                                               | Aftalt indsamling, dækning, privatliv, retention og bekræftet første event |

Onboarding og motion må gerne udvikles sammen med rammen, men en visuelt flot editor må ikke få PR-skrivning “med i købet”. Usage-UI må heller ikke blive til fiktive production-metrics.

## Bevar / genbrug / tilpas / fravælg

| Bevar fra vores            | Genbrug tæt fra referencen      | Tilpas                                      | Fravælg indtil videre              |
| -------------------------- | ------------------------------- | ------------------------------------------- | ---------------------------------- |
| Varme farver og Geist      | 52 px topbar og segmenter       | Profil til nederst venstre                  | Reference-branding og teamdata     |
| Repository-identiteter     | Kompakt search-pill             | Bredere læser og supporting files           | Indbygget chat som automatisk krav |
| Safe full Markdown         | Inspector med fast handlingsfod | References frem for ubekræftet orkestrering | Usage-tal uden tracking            |
| Read-only/adgangsgrænse    | Klik fra data til konkret skill | Tre handlingsorienterede onboarding-trin    | Person-leaderboard som default     |
| Mobilskuffe og tilbageveje | Små farve-/panelovergange       | Portrætgraf og læsbare mobilrækker          | Fast desktoplayout på telefon      |

## Tekniske udtræk og grænser

[observed-design.json](reference/observed-design.json) indeholder udvalgte faktiske DOM-snippets og computed CSS fra referencepreviewet, herunder navigation, søgning, avatar, kategori, panel og dele af readeren. [coverage.json](reference/coverage.json) dokumenterer de 65 reader-navne og tre støttefiler. `extracted-controls.html` og `observed.css` gør de udvalgte HTML-/CSS-mønstre lettere at bruge som teknisk reference.

Udtrækket er ikke Remis originale kildekode eller et komplet stylesheet. Det dokumenterer, hvad browseren viste. En reuselicens er ikke udledt af, at siden er offentligt tilgængelig. Vores prototype bruger egne komponenter og egne eksempeltekster; ingen minificerede bundles, logoer eller bagvedliggende services er kopieret.

Den samlede designretning står i [DESIGN.md](DESIGN.md). Den faktiske verificering og dens begrænsninger står i [REVIEW.md](REVIEW.md). Produktrepositoryet er holdt uændret.
