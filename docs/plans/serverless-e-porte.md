# Piano — porte verso l'infrastruttura e deploy serverless

- **Stato:** in corso (vedi [Avanzamento](#avanzamento))
- **Data:** 2026-10-21
- **Repo di lavoro:** fork `Lestat86/software-engineering-foundation`, branch
  `feat/serverless-and-ports`
- **Progetto pilota:** AntiPhishing-Bot, che migra da una VPS a GCP serverless
  (`docs/features/migrazione-serverless/` di quel repo, decisioni D-01…D-41).
  Le modifiche si fanno insieme qui e nella copia del progetto, così il
  progetto non ha bisogno di un retrofit (D-11 del pilota)

## Obiettivo

Due aggiunte, nate dalla migrazione del pilota ma valide per ogni progetto:

1. **Un requisito di struttura**: ogni infrastruttura (database e ORM,
   autenticazione, coda, pianificatore, storage, email, log, pagamenti, SDK del
   cloud) si raggiunge solo da una porta del progetto, con tipi del dominio
   nella firma. Cambiare fornitore o ORM deve toccare solo il suo adattatore.
   Oggi la foundation ha solo `STRUCT-BOUNDARY-001` (superficie pubblica dei
   moduli) e il «typed adapter» per l'interop insicura (`TS-*`), nessuno dei due
   lo impone.
2. **Il deploy serverless come asse del progetto**, accanto a stack e CI: le
   regole che valgono per qualunque piattaforma serverless e quelle di Cloud
   Run, come requisiti verificabili, in modo che la foundation aiuti invece di
   remare contro (oggi `FASTIFY-SECURITY-001` e il template danno per scontato
   un processo unico, con il limite di frequenza in memoria).

## Decisioni

| Tema | Decisione |
| --- | --- |
| Come si modella il serverless | **Un asse nuovo, `--deploy <nome>`**, sul modello di `--ci`: campo `deploy` nel record (`none` se manca), reference propria, nessun file del profilo base riscritto. Non un overlay: un overlay non può sostituire file del profilo base (`profile conflict`) e nel monorepo si applica alla root, non al workspace del server. ADR 0024, che rivede l'esclusione del deploy dell'ADR 0009 |
| Reference | **Due**: `references/deploy/serverless.md` con le regole di qualunque piattaforma serverless, `references/deploy/cloud-run.md` con quelle di Cloud Run. `--deploy cloud-run` rende applicabili tutte e due |
| Asset | Nessuno nella prima versione: Dockerfile, infrastruttura come codice e codice dell'outbox restano del progetto. Si rivaluta dopo il pilota |
| Porte | **`STRUCT-PORT-001`, MUST per tutti i progetti**, in `references/standards/project-structure.md`. ADR 0023 |
| Verifica delle porte | Una regola di dependency-cruiser nel file della foundation: i pacchetti dei fornitori in un elenco della foundation si importano solo da cartelle per convenzione (`src/infrastructure/`, `src/db/`, `src/adapters/`), anche per i soli tipi; il progetto estende elenco e cartelle in `.dependency-cruiser.local.mjs`. Il framework (Fastify, Nest, React) non è una porta |
| Supabase | La reference `supabase.md` va corretta: il client non si crea più direttamente nel codice delle feature, ma in un adattatore |
| Versione | Dentro il **3.0.0** già previsto dal piano `enforcement-and-retrofit.md`: un MUST nuovo può far fallire il lint di progetti esistenti |
| Issue #1 | Si corregge qui: gli script attesi si rendono con le sostituzioni del generatore; per una root retrofittata si controlla solo la presenza degli script della foundation |
| Bug di `lint:deps` nei retrofit | La guida al retrofit fa girare `lint:deps` dentro ogni workspace, dove le regole `no-client-to-server`, `no-server-to-client` e `no-package-to-app` (percorsi dalla root) non scattano mai. Si corregge la guida: `lint:deps` dalla root, come nei monorepo generati |

## Requisiti proposti

Testo definitivo nelle reference; qui l'elenco per la revisione.

**`references/standards/project-structure.md`**

- `STRUCT-PORT-001` (MUST): infrastruttura dietro porte del progetto, tipi del
  dominio nella firma, un adattatore di produzione più uno locale o in memoria,
  niente seconde implementazioni per ipotesi; il framework non è una porta;
  transazioni dietro una porta «unità di lavoro».

**`references/deploy/serverless.md`**

- `SERVERLESS-RESPONSE-001` (MUST): nessun lavoro dopo la risposta (niente
  promesse non attese, niente lavoro in `onResponse`); ciò che non sta prima
  della risposta va in coda.
- `SERVERLESS-STATE-001` (MUST): nessuno stato nella memoria del processo da
  cui dipenda la correttezza (limiti di frequenza, deduplica, sessioni); in
  memoria solo ottimizzazioni.
- `SERVERLESS-OUTBOX-001` (MUST): un lavoro che nasce da una modifica dei dati
  si accoda con un outbox nella stessa transazione, si invia dopo il commit e
  prima della risposta, con un recupero periodico che salta le righe recenti e
  le prende con `SKIP LOCKED`; il nome del task è l'id della riga.
- `SERVERLESS-IDEMPOTENT-001` (MUST): ogni gestore di task e di job è
  idempotente e controlla lo stato sotto lock prima di agire.
- `SERVERLESS-SCHEDULE-001` (MUST): pianificazioni dichiarate una volta nel
  codice; lock contro le esecuzioni sovrapposte; **battito d'assenza**: ogni
  job pianificato segnala il completamento e un allarme scatta se il segnale
  manca oltre la soglia.
- `SERVERLESS-ALERT-001` (MUST): righe di allarme, battiti mancati e coda ferma
  arrivano a un destinatario configurabile per ambiente (una lista, non una
  persona).
- `SERVERLESS-MIGRATION-001` (MUST): migrazioni come passo a sé prima del
  deploy, compatibili all'indietro (prima si aggiunge, poi si toglie).

**`references/deploy/cloud-run.md`**

- `CLOUDRUN-SIZING-001` (MUST): memoria, CPU, concorrenza e tetto di istanze
  fissati a mano, mai i valori predefiniti (sotto 1 vCPU la concorrenza è 1).
- `CLOUDRUN-PRIVATE-001` (MUST): i servizi interni (worker, job) senza accesso
  anonimo, invocabili solo dall'account di servizio di coda e pianificatore;
  l'app verifica anche il token OIDC.
- `CLOUDRUN-SECRETS-001` (MUST): segreti in Secret Manager a versione fissata,
  un account di servizio per servizio con i soli segreti suoi.
- `CLOUDRUN-ORIGIN-001` (MUST, se davanti c'è un edge esterno): il servizio
  rifiuta le richieste senza il segreto dell'edge, e l'IP del client si legge
  dall'intestazione dell'edge solo per quelle.
- `CLOUDRUN-IMAGE-001` (SHOULD): l'immagine di base si aggiorna e si ripubblica
  nei tempi del triage delle vulnerabilità.
- `CLOUDRUN-PROJECT-001` (SHOULD): un progetto GCP per ambiente.

`FASTIFY-RUNTIME-001` resta valido su Cloud Run: `SIGTERM` arriva con dieci
secondi di margine. `FASTIFY-SECURITY-001` si aggiorna: con `deploy` diverso da
`none` il limite di frequenza in memoria vale solo come freno, quelli contro la
forza bruta seguono `SERVERLESS-STATE-001`.

## Avanzamento

| Fase | Che cosa | Stato | ADR |
| --- | --- | --- | --- |
| 0 | Questo piano | fatta il 2026-10-21 | — |
| 1 | `STRUCT-PORT-001`, la regola di dependency-cruiser, `supabase.md`, `tooling.md`, manuale, test | fatta il 2026-10-21 | 0023 |
| 2 | Asse `--deploy`: generatore, record, `check-foundation`, `sync-foundation`, indice delle reference, `SKILL.md`, le due reference, manuale, test | fatta il 2026-10-21 | 0024 |
| 3 | Issue #1 e guida al retrofit su `lint:deps` dalla root, con i test | fatta il 2026-10-21 | — |
| 4 | Versione 3.0.0, insieme al resto del piano `enforcement-and-retrofit.md` | da decidere con Alberto | — |
| 5 | Pilota: AntiPhishing-Bot riceve reference, asset e hash, `deploy: "cloud-run"` nel record, `.dependency-cruiser.local.mjs`, `lint:deps` dalla root | fasi 1 e 2 applicate il 2026-10-21; il resto dopo ogni fase | — |

## Decisioni prese durante il lavoro

- **2026-10-21, pilota.** La regola delle porte sul pilota trova 38 violazioni
  nel server: 26 del client Prisma generato (`src/generated/`), 7 di Better
  Auth (`features/auth/`), 5 di pg-boss e pino. Le prime due diventano
  cartelle d'adattatore dichiarate in `.dependency-cruiser.local.mjs`, le
  altre una baseline (`.dependency-cruiser-known-violations.json`, passata con
  `--ignore-known`) che il retrofit del pilota svuota. Da valutare per la
  foundation: mettere le cartelle di codice generato fra quelle predefinite.
- **2026-10-21, fase 3.** `lint:deps` dalla root non basta copiarlo dai
  monorepo generati: nel pilota il client usa l'alias `@/` e dalla root non si
  risolve senza il suo tsconfig. La guida al retrofit deve dire come passare
  le configurazioni TypeScript dei workspace (o togliere gli alias).
- **2026-10-21, fase 3.** Il generatore esporta `substitute` e un nuovo
  `describeManifestValues` (nome, scope, Node, Yarn), che usa lui stesso:
  `sync-foundation` li importa da lì come già fa con le altre funzioni, senza
  un modulo condiviso nuovo, e rende l'intero `package.json` del template.
- **2026-10-21, fase 3.** Il generatore non scrive `root` nel record: il
  campo serve solo ai retrofit, e mancante vale `generated` per
  `check-foundation` e `sync-foundation`. A differenza di `deploy` non è
  un'opzione del generatore, che scriverebbe sempre lo stesso valore.
- **2026-10-21, fase 3.** `lint:foundation` rifiuta un `lint:deps` con
  `--ignore-known` seguito da ` .` o da nulla: dependency-cruiser legge `.`
  come nome del file, stampa l'aiuto ed esce con 0 (trovato sul pilota).
- **2026-10-21, fase 3.** Oltre al piano: con `lint:deps` dalla root, il
  layout dell'esempio della guida (`frontend/`, `server/`, `shared/`) perdeva
  `not-to-dev-dep` e la regola delle porte, che cercavano il codice solo in
  `src/`, `apps/*/src/` e `packages/*/src/`. Il file della foundation ora
  riconosce anche `<cartella>/src/` ed esclude `<cartella>/dist/` e
  `<cartella>/coverage/`; l'esempio ridefinisce le tre regole di confine con
  le sue cartelle e rinomina l'alias del server, perché un solo
  `tsconfig.depcruise.json` non mappa lo stesso alias su due cartelle.
- **2026-10-21, fase 2.** Il generatore scrive sempre `deploy` nel record,
  anche `deploy: "none"`; `check-foundation` e `sync-foundation` trattano un
  record senza `deploy` come `none`, così i progetti esistenti passano senza
  modifiche e la fase non è un cambiamento incompatibile.
- **2026-10-21, fase 2.** L'elenco dei target sta fisso nel generatore
  (`DEPLOY_TARGETS`) e in `check-foundation`, non si ricava da una cartella di
  asset come per la CI: il target non porta file.
- **2026-10-21, fase 2.** Le reference stanno in
  `skills/bootstrap-web-project/references/deploy/`, accanto alle altre: la
  copia nei progetti e l'hash le coprono già, senza codice nuovo.
- **2026-10-21, fase 2.** Oltre al piano: `CLOUDRUN-IMAGE-001` chiede anche
  l'immagine fissata per digest; `CLOUDRUN-ORIGIN-001` ammette come eccezione
  il bilanciatore di Google con ingresso interno; `SERVERLESS-IDEMPOTENT-001`
  chiede che l'ultimo tentativo fallito scriva l'esito e un allarme (D-18 del
  pilota); l'esempio del record nella guida al retrofit riceve
  `deploy: "none"`.

## Note

- Le fonti nuove (Cloud Run, Cloud Tasks, Cloud Scheduler, il pattern
  transactional outbox) vanno in `docs/source-register.md`.
- Ogni dipendenza che entra in `versions.json` va anche nel `package.json` di
  questo repo (`tests/structure.test.mjs`); la prima versione non ne aggiunge.
