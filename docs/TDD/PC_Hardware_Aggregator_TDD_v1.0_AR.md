# وثيقة التصميم التقني (TDD)

**منصة تجميع قطع الكمبيوتر ومحرك التوافق للسوق المصري**  
PC Hardware Aggregator & Compatibility Engine - Sigma First

| الحقل | القيمة |
| --- | --- |
| نوع الوثيقة | Technical Design Document (TDD) |
| الإصدار | 1.0 |
| الحالة | Baseline تنفيذي |
| مالك الوثيقة | Nour Eldeen Mahmoud |
| التاريخ | 12 يوليو 2026 |
| وثيقة المنتج المرجعية | `PC_Hardware_Aggregator_PRD_v1.0_AR` |
| نطاق التنفيذ | MVP بمتجر Sigma فقط، مع بنية تسمح بإضافة متاجر مستقلة لاحقًا |


# محتويات الوثيقة

- 0. التحكم في الوثيقة
- 1. ملخص التصميم
- 2. أهداف التصميم وغير الأهداف
- 3. القرارات التقنية الأساسية
- 4. بنية الـRepository
- 5. Runtime Architecture
- 6. Configuration and Environments
- 7. End-to-End Data Flow
- 8. Scraping Subsystem
- 9. Raw, Staging, Canonical, Published Models
- 10. Taxonomy and Classification
- 11. Normalization Pipeline
- 12. Product Identity and Matching
- 13. Publishing Pipeline
- 14. Search and Filtering Design
- 15. Compatibility Engine
- 16. PC Builder Design
- 17. Bundles and Prebuilts
- 18. Purchase Plan and Commerce Boundary
- 19. REST API Design
- 20. API Module Design
- 21. Angular Application Design
- 22. Admin and Data Quality UI
- 23. Reference Data
- 24. Database Design and Index Management
- 25. Concurrency and Idempotency
- 26. Observability
- 27. Security
- 28. Testing Strategy
- 29. CI/CD
- 30. Deployment Topology
- 31. Performance and Capacity Assumptions
- 32. Failure Scenarios and Recovery
- 33. Implementation Phases
- 34. Recommended First Issues
- 35. Coding Standards
- 36. ADR Backlog
- 37. Definition of Done
- 38. Final MVP Acceptance Scenario
- 39. Open Technical Decisions - غير مانعة للبدء
- 40. Official Technical References
- Appendix A - Core Enums
- Appendix B - Initial Index Checklist
- Appendix C - Root Scripts
- Appendix D - Pull Request Checklist
- Appendix E - Data Discovery Checklist


# 0. التحكم في الوثيقة

## 0.1 الهدف من الوثيقة

تحدد هذه الوثيقة **كيف سيتم تنفيذ** المتطلبات الواردة في الـPRD. وهي المرجع الأساسي أثناء كتابة الكود، إنشاء الـIssues، مراجعة Pull Requests، اتخاذ القرارات المعمارية، وقياس اكتمال كل مرحلة.

الـPRD يحدد ما الذي يجب أن يقدمه المنتج، بينما هذه الوثيقة تحدد:

- حدود التطبيقات والحزم البرمجية.
- طريقة انتقال البيانات من Sigma إلى الكتالوج.
- نماذج البيانات والـIndexes.
- عقود الـAPI.
- تصميم الـScraper والـNormalization والـProduct Matching.
- تصميم محرك التوافق والـPC Builder.
- استراتيجية البحث والفلترة.
- الاختبارات والمراقبة وحالات الفشل.
- ترتيب مراحل التنفيذ وشروط الخروج من كل مرحلة.

## 0.2 قواعد استخدام الوثيقة

1. أي تنفيذ يخالف قرارًا أساسيًا هنا يحتاج إلى ADR جديد وتحديث الوثيقة.
2. لا تُنشأ Collection أو Endpoint أو Package جديدة دون تحديد مالكها ومسؤوليتها.
3. كل Phase لها Entry Criteria وExit Criteria ولا تبدأ المرحلة التابعة قبل اكتمال الحد الأدنى من المرحلة السابقة.
4. الـRaw data لا تُعدل بعد حفظها؛ أي إعادة معالجة تتم من Snapshot محفوظ.
5. غياب المعلومة لا يتحول إلى توافق إيجابي.
6. لا يتم تشغيل Scraping من داخل HTTP request في الـAPI.
7. أي Store جديد يحصل على Adapter مستقل ولا يضيف شروطًا خاصة به داخل الـCanonical domain.

## 0.3 سجل الإصدارات

| الإصدار | التاريخ       | الملخص                                                   |
| ------- | ------------- | -------------------------------------------------------- |
| 1.0     | 12 يوليو 2026 | أول Baseline كامل مبني على PRD v1.0 وقرارات Sigma-first. |

## 0.4 رموز الأولوية

| الرمز | المعنى                                      |
| ----- | ------------------------------------------- |
| P0    | مطلوب لإكمال الـMVP.                        |
| P1    | مهم بعد ثبات الـMVP ولا يمنع أول Demo كامل. |
| P2    | تحسين مستقبلي أو متعلق بإضافة متاجر.        |


# 1. ملخص التصميم

سيتم تنفيذ النظام كـ**Modular Monorepo** يحتوي ثلاث عمليات Runtime مستقلة:

1. **Angular Web Application**: واجهة الكتالوج والبحث والـPC Builder والإدارة البسيطة.
2. **Express API**: قراءة الكتالوج، إدارة Builds، تشغيل التوافق، وتقديم Endpoints الإدارة. لا ينفذ Scraping.
3. **Worker CLI/Scheduler**: اكتشاف صفحات Sigma، تحميلها، حفظ Raw snapshots، Normalization، Product identity resolution، ونشر البيانات.

تستخدم العمليات الثلاث MongoDB واحدة، مع فصل المسؤوليات على مستوى الـCollections والـRepository interfaces. لا نستخدم Microservices أو Kafka أو Redis أو Distributed queues في P0.

```text
Sigma Website
     |
     v
Sigma Worker
  Discovery -> Fetch -> Raw Snapshot -> Parse -> Normalize -> Match -> Publish
     |                                                        |
     +---------------------------- MongoDB --------------------+
                                      |
                                Express REST API
                                      |
                                  Angular Web
```

## 1.1 الخصائص الجوهرية للتصميم

- **HTTP-first Scraping** باستخدام Crawlee `CheerioCrawler`.
- **Playwright fallback** فقط عندما تثبت الحاجة في صفحة أو Route محددة.
- **Raw-first ingestion**: الاحتفاظ بما جاء من المصدر قبل التعديل.
- **Versioned processing**: تسجيل `parserVersion`, `normalizerVersion`, `taxonomyVersion`.
- **Canonical product model** مستقل عن Sigma.
- **Offer model** منفصل حتى مع وجود متجر واحد.
- **Typed Compatibility Rules** داخل الكود بدل Expressions نصية قابلة للتنفيذ.
- **Search terms precomputation** لتقديم Search جيد محليًا دون خدمة خارجية في البداية.
- **All products visible**؛ المنتجات ذات البيانات الناقصة تظهر مع Data Quality status.
- **Bundles catalog-only** ولا تدخل الـBuilder.
- **Redirect commerce**؛ لا توجد Cart أو Payment داخلية.


# 2. أهداف التصميم وغير الأهداف

## 2.1 أهداف التصميم

- إكمال Vertical Slice كامل لسيجما من الاكتشاف حتى واجهة الشراء.
- جعل كل خطوة في الـdata pipeline قابلة لإعادة التشغيل بصورة مستقلة.
- جعل فشل خطوة لا يؤدي إلى فقدان البيانات الخام أو إخفاء الكتالوج السابق.
- تمكين إضافة متجر جديد عبر Adapter وحزمة Mapping، دون تعديل الـAPI والـBuilder.
- جعل قرارات Product Matching والتوافق قابلة للتفسير والاختبار.
- تقديم بنية مفهومة لمطور واحد، وليست بنية فريق Enterprise مصطنعة.
- الاحتفاظ بمسار ترقية واضح لـAtlas Search وBackground queue عند الحاجة.

## 2.2 غير الأهداف

- لا نحتاج Availability لحظية.
- لا نحتاج Event-driven distributed architecture.
- لا نحتاج ضمان Exactly-once على مستوى نظام موزع؛ نحتاج Jobs قابلة للإعادة وUpserts idempotent.
- لا نحتاج Rule DSL عامة.
- لا نحتاج توصية أداء مبنية على Benchmarks في P0.
- لا نحتاج تفكيك Bundles.
- لا نحتاج Authentication كاملة للمستخدم النهائي.
- لا نحتاج إدارة Orders أو Payments أو Shipping.


# 3. القرارات التقنية الأساسية

## 3.1 Technology Baseline

| الطبقة            | الاختيار            | القرار                                                              |
| ----------------- | ------------------- | ------------------------------------------------------------------- |
| Frontend          | Angular 22          | Standalone components، Signals، Reactive Forms، Router، HttpClient. |
| Runtime           | Node.js 24 LTS      | نفس Runtime للـAPI والـWorker، ومتوافق مع Angular 22.               |
| Language          | TypeScript 6.x      | Strict mode وتوحيد الأنواع بين التطبيقات.                           |
| API               | Express 5.x         | REST API بسيطة ومألوفة، مع Middleware صريح.                         |
| Database          | MongoDB 8.x         | Local Docker في التطوير، وAtlas اختياري للنشر.                      |
| DB access         | MongoDB Node Driver | Repository layer صريحة + Zod، بدون ODM في P0.                       |
| Validation        | Zod                 | DTOs وEnvironment وDomain parsing وWorker outputs.                  |
| Scraping          | Crawlee 3.17+       | `CheerioCrawler` أساسي و`PlaywrightCrawler` fallback.               |
| HTML parsing      | Cheerio عبر Crawlee | تحميل سريع دون Browser.                                             |
| Logging           | Pino                | Structured JSON logs وchild loggers.                                |
| Unit tests        | Vitest              | سرعة ودعم TypeScript.                                               |
| API tests         | Supertest           | Integration tests للـExpress.                                       |
| Web E2E           | Playwright Test     | اختبارات User flows للواجهة، وليس Scraping فقط.                     |
| Package manager   | npm workspaces      | أقل تعقيدًا من Nx في أول نسخة.                                      |
| Local environment | Docker Compose      | MongoDB وخدمات الاختبار فقط.                                        |

### لماذا MongoDB Driver بدل Mongoose؟

- منع تكرار الـSchemas بين Zod وMongoose.
- الاحتفاظ بتحكم واضح في الـIndexes وAggregation pipelines.
- نماذج Specs مختلفة حسب الفئة يسهل تمثيلها بأنواع TypeScript وZod discriminated unions.
- المشروع يحتوي Data pipeline وBulk upserts، وهي حالات مباشرة مع الـDriver.

**ملاحظة:** استخدام Mongoose ممكن، لكنه ليس شرطًا لتحقيق MEAN. القرار الحالي يقلل الـmagic ويجعل الـdata access واضحًا. إذا أدى ذلك إلى Boilerplate زائد بشكل مؤلم، يمكن فتح ADR لمراجعته.

## 3.2 Version Pinning

- يتم تثبيت Major وMinor داخل `package.json`، ويُسمح بتحديث Patch عبر Dependabot أو npm update بعد نجاح الاختبارات.
- Node version تُثبت في `.nvmrc` و`package.json#engines`.
- Docker image لـMongoDB تُثبت على Minor/patch تم اختباره، ولا تستخدم `latest`.
- كل Scrape Snapshot يحمل نسخة الـParser المستخدمة.

## 3.3 مبادئ Dependency Direction

```text
apps/web ------> packages/contracts
      \--------> packages/domain-read-models

apps/api ------> packages/domain
      \--------> packages/contracts
      \--------> packages/database
      \--------> packages/compatibility-engine
      \--------> packages/search

apps/worker ---> packages/domain
         \-----> packages/database
         \-----> packages/scraping-core
         \-----> packages/sigma-adapter
         \-----> packages/normalization
         \-----> packages/product-matching
```

ممنوع:

- `apps/api` يستورد من `apps/worker`.
- `apps/web` يستورد Database models.
- `packages/domain` يعتمد على Express أو MongoDB أو Angular.
- Store-specific code يدخل `packages/domain`.


# 4. بنية الـRepository

```text
pc-hardware-eg/
├── apps/
│   ├── web/
│   │   ├── src/app/
│   │   │   ├── core/
│   │   │   ├── shared/
│   │   │   ├── features/catalog/
│   │   │   ├── features/product-details/
│   │   │   ├── features/builder/
│   │   │   ├── features/purchase-plan/
│   │   │   └── features/admin/
│   │   └── project.json
│   ├── api/
│   │   └── src/
│   │       ├── bootstrap/
│   │       ├── middleware/
│   │       ├── modules/catalog/
│   │       ├── modules/builds/
│   │       ├── modules/admin/
│   │       ├── modules/health/
│   │       └── app.ts
│   └── worker/
│       └── src/
│           ├── cli/
│           ├── commands/
│           ├── scheduler/
│           └── bootstrap/
├── packages/
│   ├── contracts/
│   ├── domain/
│   ├── database/
│   ├── scraping-core/
│   ├── sigma-adapter/
│   ├── normalization/
│   ├── product-matching/
│   ├── compatibility-engine/
│   ├── search/
│   ├── observability/
│   ├── config/
│   └── test-support/
├── fixtures/
│   └── sigma/
│       ├── category-pages/
│       └── product-pages/
├── docs/
│   ├── PRD/
│   ├── TDD/
│   ├── ADR/
│   ├── data-dictionary/
│   └── runbooks/
├── scripts/
│   ├── seed-reference-data.ts
│   ├── create-indexes.ts
│   ├── reprocess-snapshots.ts
│   └── export-quality-report.ts
├── docker-compose.yml
├── package.json
├── tsconfig.base.json
├── eslint.config.js
├── .nvmrc
└── README.md
```

## 4.1 مسؤولية الحزم

| الحزمة | المسؤولية |
| --- | --- |
| `contracts` | Request/Response DTOs، enums العامة، API error contract. |
| `domain` | Product taxonomy، Specs types، Build models، invariants بلا Infrastructure. |
| `database` | Mongo client، repositories، migrations/indexes، transaction helpers. |
| `scraping-core` | Run orchestration، retry، request labels، snapshots، adapter interfaces. |
| `sigma-adapter` | Sigma URLs، selectors، discovery، parser، stock/price interpretation. |
| `normalization` | Labels mapping، unit parsers، classification، field quality. |
| `product-matching` | Identity extraction، candidate blocking، scoring، contradictions، decisions. |
| `compatibility-engine` | Rule registry، evaluation، overall status، candidate ranking inputs. |
| `search` | Query normalization، filters، facets، Mongo search implementation. |
| `observability` | Logger factory، correlation IDs، metric names. |
| `config` | Zod environment schemas لكل Runtime. |
| `test-support` | Builders، test DB helpers، fixtures loader، fake clock. |


# 5. Runtime Architecture

## 5.1 Web Process

- Single Page Application.
- لا تصل MongoDB مباشرة.
- كل البيانات من `/api/v1`.
- تحتفظ فقط بحالة UI وBuild ID محليًا.
- تُحمّل Features بالـlazy routes.

## 5.2 API Process

مسؤول عن:

- Catalog reads.
- Search and filters.
- Product details and offers.
- Build CRUD.
- Compatibility evaluation.
- Purchase plan generation.
- Admin review reads/writes.
- Health/readiness.

غير مسؤول عن:

- HTTP requests إلى Sigma.
- Parsing HTML.
- Scheduled crawling.
- تعديل Raw snapshots.

## 5.3 Worker Process

يعمل بثلاث طرق:

1. CLI manual command.
2. Scheduled process عبر Cron داخل الـWorker process أو OS scheduler.
3. One-off maintenance commands مثل reprocess أو publish.

أوامر مستهدفة:

```bash
npm run worker -- sigma discover --run-id auto
npm run worker -- sigma fetch --run-id <id>
npm run worker -- sigma full
npm run worker -- normalize --store SIGMA --run-id <id>
npm run worker -- match --store SIGMA --run-id <id>
npm run worker -- publish --store SIGMA --run-id <id>
npm run worker -- reprocess --snapshot-query <file>
npm run worker -- inspect-url <sigma-url>
```

## 5.4 Database Ownership

| Collection | API | Worker |
| --- | --- | --- |
| `stores` | Read | Seed/Update health |
| `scrape_runs` | Read | Write |
| `discovered_products` | No | Read/Write |
| `raw_product_snapshots` | Admin read only | Insert only |
| `store_listings` | Read admin | Upsert |
| `catalog_products` | Read | Publish/Update |
| `offers` | Read | Upsert |
| `price_events` | Read | Insert |
| `product_identity_aliases` | Admin read/write | Read/Write suggestions |
| `match_reviews` | Admin read/write | Create |
| `data_quality_issues` | Admin read/write | Create/Resolve automatic |
| `builds` | Read/Write | No |
| `reference_data` | Read | Seed/maintenance |


# 6. Configuration and Environments

## 6.1 Environments

- `development`: Local web/api/worker + Docker MongoDB.
- `test`: isolated database name لكل test worker أو Mongo test container.
- `staging`: hosted API/web + Atlas cluster + manual/scheduled worker.
- `production-demo`: اختياري للـPortfolio، نفس staging تقريبًا بدون SLA.

## 6.2 Environment Variables

### Shared

```text
NODE_ENV
APP_VERSION
LOG_LEVEL
MONGODB_URI
MONGODB_DB_NAME
```

### API

```text
API_PORT
API_PUBLIC_ORIGIN
WEB_ORIGIN
ADMIN_API_TOKEN
MAX_PAGE_SIZE
BUILD_EXPIRY_DAYS
```

### Worker

```text
SIGMA_BASE_URL
SIGMA_REQUESTS_PER_MINUTE
SIGMA_MAX_CONCURRENCY
SIGMA_REQUEST_TIMEOUT_MS
SIGMA_MAX_RETRIES
SIGMA_USER_AGENT
SCRAPER_STORE_HTML
SCRAPER_SNAPSHOT_DIR
WORKER_SCHEDULE_ENABLED
WORKER_CRON_EXPRESSION
```

### Web

```text
API_BASE_URL
APP_ENV_LABEL
```

## 6.3 Config Validation

كل Runtime له Zod schema مستقلة. يفشل التطبيق عند الإقلاع إذا:

- Mongo URI مفقودة.
- Port غير صالح.
- `ADMIN_API_TOKEN` قصير في staging.
- `SIGMA_MAX_CONCURRENCY` خارج 1-5.
- Schedule مفعّل بدون Cron expression.

لا تُقرأ `process.env` خارج `packages/config`.


# 7. End-to-End Data Flow

```text
[Category Seeds]
      |
      v
1. Discovery
      |
      v
[discovered_products]
      |
      v
2. Fetch & Raw Parse
      |
      +--> [raw_product_snapshots - immutable]
      |
      v
3. Staging Parse
      |
      v
[store_listings]
      |
      v
4. Classification & Normalization
      |
      +--> [data_quality_issues]
      |
      v
5. Identity Resolution
      |
      +--> exact alias -> catalog product
      +--> auto match -> catalog product
      +--> review -> match_reviews
      +--> new product -> catalog product
      |
      v
6. Publish Offer and Product Read Model
      |
      +--> [catalog_products]
      +--> [offers]
      +--> [price_events]
      |
      v
7. API Search / Product Details / Builder
```

## 7.1 Processing Guarantees

- كل Job قابلة للإعادة.
- `raw_product_snapshots` append-only.
- `store_listings` تمثل آخر Processing نتيجة لكل `storeCode + externalId`.
- `offers` تمثل آخر حالة تجارية منشورة.
- عدم ظهور المنتج في Run فاشل لا يغير حالته.
- Publish لا يحدث إلا إذا اكتملت Validation المطلوبة للعرض.
- المنتج ذو Specs ناقصة يمكن نشره؛ المنتج ذو اسم أو رابط مفقود لا يُنشر.


# 8. Scraping Subsystem

## 8.1 Store Adapter Contract

```ts
export interface StoreScraperAdapter {
  readonly storeCode: StoreCode;
  readonly parserVersion: string;

  getSeedRequests(): CrawlerRequest[];

  parseCategoryPage(
    context: CategoryPageContext
  ): Promise<CategoryParseResult>;

  parseProductPage(
    context: ProductPageContext
  ): Promise<ParsedRawProduct>;

  extractExternalId(url: URL, html?: string): string | null;

  classifyHttpFailure(input: HttpFailureInput): ScrapeFailureKind;
}
```

الـAdapter لا يحفظ في MongoDB مباشرة. يعيد Results إلى Orchestrator، والـOrchestrator يستخدم Repositories. هذا يمنع خلط Parsing مع Persistence.

## 8.2 Request Types

```ts
type SigmaRequestLabel =
  | 'CATEGORY_PAGE'
  | 'PRODUCT_PAGE'
  | 'ROBOTS_CHECK'
  | 'HEALTH_SAMPLE';
```

`userData` لكل Request:

```ts
interface SigmaRequestData {
  label: SigmaRequestLabel;
  categoryHint?: ProductCategory;
  pageNumber?: number;
  discoverySourceUrl?: string;
  scrapeRunId: string;
}
```

## 8.3 Discovery

### Inputs

- قائمة Category Seeds في كود Sigma adapter.
- كل Seed يحمل `categoryHint`, `url`, `enabled`.

### Algorithm

1. Enqueue seed category page.
2. Parse product cards and product URLs.
3. Canonicalize URL وإزالة tracking query parameters.
4. Extract Sigma external ID عند الإمكان.
5. Upsert `discovered_products` by `(storeCode, canonicalUrl)`.
6. Enqueue next pagination page.
7. Stop عند غياب next page أو تكرار page fingerprint.
8. Emit discovery stats per category.

### Pagination Loop Protection

- Hash للـsorted product URLs في كل صفحة.
- إذا تكرر نفس hash مرتين، يتوقف الـpagination ويُسجل issue.
- حد أمان `maxPagesPerCategory` قابل للضبط، مثل 200.
- لا يعتمد التوقف على عدد صفحات مكتوب فقط.

## 8.4 Fetch Strategy

الافتراضي:

```text
Crawler: CheerioCrawler
maxConcurrency: 3
minConcurrency: 1
maxRequestRetries: 2
requestHandlerTimeout: 15s
sameDomainOnly: true
```

الحدود أرقام بداية وتُعدل بعد Data Discovery، وليست هدف سرعة.

### Headers

- User-Agent واضح باسم المشروع ورابط GitHub إن أصبح عامًا.
- Accept-Language ثابت `en` للحصول على Labels متناسقة.
- Accept HTML.
- لا يتم تزوير Sessions أو تجاوز حماية.

## 8.5 Playwright Fallback

لا يُفعّل تلقائيًا لكل Request. يتم تعريف Route rule:

```ts
interface BrowserFallbackRule {
  urlPattern: RegExp;
  reason: 'MISSING_REQUIRED_HTML' | 'JS_ONLY_VARIANT' | 'MANUAL_OVERRIDE';
  enabled: boolean;
}
```

يُستخدم إذا أثبت Fixture أن:

- الاسم أو السعر لا يظهر في HTML response.
- الـvariants تُحمّل عبر JavaScript ولا يمكن تمثيلها بدون Browser.
- صفحة معينة تعيد shell فارغة.

## 8.6 Robots and Responsible Crawling

قبل Full Run:

- تحميل `robots.txt` وتخزين نتيجة الفحص مع الـRun.
- منع أي Path غير مسموح به.
- لا يتم حل CAPTCHA.
- لا يتم تجاوز Login.
- لا يتم استخدام Proxies في P0.
- الصور لا تُحمّل؛ تحفظ URLs فقط.
- Schedule افتراضي مرة يوميًا أو يدوي، وليس كل دقائق.

## 8.7 Raw HTML Storage

يوجد وضعان:

1. **Database metadata + filesystem HTML** في local development.
2. **Compressed raw HTML field/object storage reference** في staging.

P0 المحلي:

```text
fixtures/runs/<runId>/<externalId>.html.gz
```

Mongo document يحتفظ:

- `contentStorage: FILE`
- `contentPath`
- `contentSha256`
- parsed raw fields.

لا نخزن HTML ضخم داخل Mongo إذا كان سيزيد الحجم بلا قيمة. Fixtures المهمة تُنسخ إلى `fixtures/sigma` وتدخل Git بعد إزالة البيانات غير الضرورية.

## 8.8 Scrape Run State Machine

```text
CREATED
  -> DISCOVERING
  -> DISCOVERED
  -> FETCHING
  -> FETCHED
  -> NORMALIZING
  -> MATCHING
  -> PUBLISHING
  -> SUCCEEDED

Any active state -> PARTIALLY_FAILED
Any active state -> FAILED
CREATED/active -> CANCELLED
```

### Run Status Rules

- `SUCCEEDED`: كل stages المطلوبة اكتملت، وعدد failures تحت threshold.
- `PARTIALLY_FAILED`: بعض المنتجات فشلت لكن الكتالوج يمكن تحديثه بأمان.
- `FAILED`: discovery أو health gate يمنع اعتبار الـRun كاملًا.
- `CANCELLED`: إيقاف يدوي بدون تغيير missing offers.

## 8.9 Health Gates

| Gate | شرط الفشل الافتراضي |
| --- | --- |
| Discovery count | أقل من 40% من آخر Full successful run لنفس الفئات. |
| Empty category | فئة كانت غير فارغة وأصبحت صفرًا. |
| Missing title | أكثر من 10% من fetched pages. |
| Missing price | زيادة غير طبيعية تتجاوز 30% مع مقارنة تاريخية. |
| Duplicate page loop | تكرار fingerprint دون نهاية واضحة. |
| HTTP blocks | نسبة 403/429 أعلى من 10%. |
| Parser critical | فشل استخراج external ID وURL معًا. |

عند فشل Gate:

- لا يتم Mark missing offers كـstale.
- يمكن نشر المنتجات الناجحة فقط إذا كانت Stage مصنفة partial-safe.
- يُحفظ sample HTML للفشل.


# 9. Raw, Staging, Canonical, Published Models

## 9.1 لماذا أربع طبقات؟

| الطبقة | الهدف |
| --- | --- |
| Raw Snapshot | حفظ حقيقة ما جاء من المصدر والنسخة المستخدمة. |
| Store Listing | تمثيل منظم خاص بالمتجر بعد Parsing أساسي. |
| Canonical Product | هوية ومواصفات القطعة المستقلة عن المتجر. |
| Offer | السعر والمخزون والرابط الخاص بمتجر معين. |

هذا يمنع ربط هوية المنتج بالسعر أو بالـHTML الخاص بسيجما.

## 9.2 `raw_product_snapshots`

```ts
interface RawProductSnapshotDocument {
  _id: ObjectId;
  storeCode: 'SIGMA';
  externalId: string | null;
  canonicalUrl: string;
  sourceUrl: string;
  scrapeRunId: ObjectId;

  fetchedAt: Date;
  httpStatus: number;
  responseContentType: string | null;
  contentSha256: string;
  contentStorage: 'FILE' | 'INLINE' | 'OBJECT_STORAGE';
  contentPath?: string;

  parserVersion: string;
  raw: {
    title: string | null;
    priceText: string | null;
    oldPriceText: string | null;
    availabilityText: string | null;
    skuText: string | null;
    brandText: string | null;
    modelText: string | null;
    partNumberText: string | null;
    breadcrumbs: string[];
    specifications: Array<{ label: string; value: string }>;
    imageUrls: string[];
    descriptionText: string | null;
  };

  parseWarnings: string[];
  createdAt: Date;
}
```

### Indexes

```js
{ storeCode: 1, externalId: 1, fetchedAt: -1 }
{ scrapeRunId: 1 }
{ contentSha256: 1 }
{ canonicalUrl: 1, fetchedAt: -1 }
```

Snapshots ليست Unique لأننا نريد التاريخ، لكن يمكن Skip insert لو نفس `contentSha256` ظهر داخل نفس Run لنفس المنتج مع تسجيل heartbeat.

## 9.3 `store_listings`

```ts
interface StoreListingDocument {
  _id: ObjectId;
  storeCode: 'SIGMA';
  externalId: string;
  sourceUrl: string;
  latestSnapshotId: ObjectId;

  displayTitle: string;
  normalizedTitle: string;
  categoryHint: ProductCategory | null;
  classifiedCategory: ProductCategory;
  productKind: ProductKind;

  commerce: {
    priceType: 'FIXED' | 'FROM' | 'RANGE' | 'UNAVAILABLE';
    price: number | null;
    maxPrice: number | null;
    oldPrice: number | null;
    currency: 'EGP';
    availability: AvailabilityStatus;
  };

  identityCandidate: {
    brand: string | null;
    model: string | null;
    mpn: string | null;
    gtin: string | null;
    sku: string | null;
    fingerprint: string | null;
  };

  normalizedSpecs: ProductSpecs;
  rawSpecifications: RawSpecification[];
  imageUrls: string[];

  quality: DataQualitySummary;
  processing: {
    parserVersion: string;
    normalizerVersion: string;
    taxonomyVersion: string;
    processedAt: Date;
    state: 'NORMALIZED' | 'REVIEW_REQUIRED' | 'REJECTED';
  };

  catalogProductId: ObjectId | null;
  updatedAt: Date;
}
```

### Unique Index

```js
{ storeCode: 1, externalId: 1 } unique
```

## 9.4 `catalog_products`

```ts
interface CatalogProductDocument {
  _id: ObjectId;
  category: ProductCategory;
  productKind: ProductKind;
  buildEligibility: BuildEligibility;

  identity: {
    brand: string | null;
    model: string | null;
    mpn: string | null;
    gtin: string | null;
    canonicalKey: string;
  };

  display: {
    name: string;
    primaryImageUrl: string | null;
    imageUrls: string[];
    shortSummary: string | null;
  };

  specs: ProductSpecs;
  rawSpecifications: RawSpecification[];

  search: {
    normalizedName: string;
    tokens: string[];
    aliases: string[];
    compactTerms: string[];
    prefixes: string[];
  };

  pricing: {
    minCurrentPrice: number | null;
    maxCurrentPrice: number | null;
    inStockOfferCount: number;
    totalOfferCount: number;
    lastOfferUpdateAt: Date | null;
  };

  quality: DataQualitySummary;
  sourceSummary: {
    storeCodes: StoreCode[];
    sourceListingCount: number;
  };

  status: 'ACTIVE' | 'UNAVAILABLE' | 'ARCHIVED' | 'REVIEW';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## 9.5 `offers`

```ts
interface OfferDocument {
  _id: ObjectId;
  productId: ObjectId;
  storeCode: StoreCode;
  externalId: string;
  sourceUrl: string;

  priceType: PriceType;
  price: number | null;
  maxPrice: number | null;
  oldPrice: number | null;
  currency: 'EGP';
  availability: AvailabilityStatus;

  firstSeenAt: Date;
  lastSeenAt: Date;
  lastChangedAt: Date;
  lastSuccessfulRunId: ObjectId;
  missedSuccessfulRuns: number;
  isStale: boolean;
  status: 'ACTIVE' | 'UNAVAILABLE' | 'REMOVED';
  updatedAt: Date;
}
```

### Unique Index

```js
{ storeCode: 1, externalId: 1 } unique
```

## 9.6 `price_events`

ينشأ Event فقط عند تغير:

- السعر.
- السعر القديم.
- Price type.
- Availability.

```ts
interface PriceEventDocument {
  offerId: ObjectId;
  productId: ObjectId;
  storeCode: StoreCode;
  previous: OfferCommercialState | null;
  current: OfferCommercialState;
  detectedAt: Date;
  scrapeRunId: ObjectId;
}
```


# 10. Taxonomy and Classification

## 10.1 Categories

```ts
type ProductCategory =
  | 'CPU'
  | 'MOTHERBOARD'
  | 'GPU'
  | 'RAM'
  | 'STORAGE'
  | 'PSU'
  | 'CASE'
  | 'CPU_COOLER'
  | 'CASE_FAN'
  | 'BUNDLE'
  | 'PREBUILT'
  | 'ACCESSORY'
  | 'OTHER';
```

## 10.2 Product Kinds

```ts
type ProductKind =
  | 'SINGLE_COMPONENT'
  | 'BUNDLE'
  | 'PREBUILT'
  | 'ACCESSORY';
```

## 10.3 Classification Inputs

بالترتيب:

1. Manual override by `(storeCode, externalId)`.
2. Sigma category seed hint.
3. Breadcrumb mapping.
4. Specification labels signature.
5. Title keyword rules.
6. Bundle/prebuilt detection.
7. Fallback `OTHER` + review.

## 10.4 Classification Result

```ts
interface ClassificationResult {
  category: ProductCategory;
  productKind: ProductKind;
  confidence: number; // 0..1
  evidence: Array<{
    source: 'OVERRIDE' | 'CATEGORY' | 'BREADCRUMB' | 'SPEC_LABEL' | 'TITLE';
    value: string;
    weight: number;
  }>;
  warnings: string[];
}
```

## 10.5 Bundle Detection

Bundle إذا تحقق واحد من:

- المصدر من Sigma bundle category.
- العنوان يحتوي أكثر من component marker قوي مثل CPU + Motherboard + RAM.
- الصفحة تعرض جدول components بدل Specs لقطعة واحدة.
- Manual override.

Bundles:

```text
category = BUNDLE
productKind = BUNDLE
buildEligibility = NOT_ELIGIBLE
```

لا يتم تفكيكها ولا مطابقتها بقطعة واحدة.


# 11. Normalization Pipeline

## 11.1 Pipeline Steps

```text
A. Sanitize raw strings
B. Parse commerce fields
C. Classify product
D. Normalize brand and identity fields
E. Map specification labels
F. Parse values and units
G. Apply category schema
H. Detect conflicts and missing fields
I. Generate search terms
J. Compute data quality
K. Persist store listing
```

كل Step تعيد Result ولا ترمي Exception بسبب field واحدة. Exceptions محجوزة لأخطاء النظام أو input غير قابل للقراءة بالكامل.

## 11.2 Text Sanitization

- Unicode NFKC normalization.
- Trim.
- Collapse whitespace.
- تحويل non-breaking spaces.
- إزالة control characters.
- الحفاظ على الرموز التي تغير الموديل: `-`, `+`, `/`, `.`.
- عدم إزالة `Ti`, `SUPER`, `XT`, `XTX`, `OC`, `BOX`, `TRAY`.

يوجد شكلان:

- `displayText`: قريب من المصدر.
- `identityText`: lowercase/normalized للمطابقة والبحث.

## 11.3 Price Parsing

يدعم:

```text
EGP 7,999
7,999 EGP
LE 7999
7.999,00 EGP (إن ظهر)
From 7,999
Out of stock
```

Result:

```ts
interface ParsedPrice {
  type: PriceType;
  price: number | null;
  maxPrice: number | null;
  oldPrice: number | null;
  currency: 'EGP';
  warnings: string[];
}
```

قواعد:

- لا يتم تخزين parse failure كصفر.
- السعر السلبي أو أكبر من guardrail منطقي يذهب Review.
- `oldPrice < price` يُسجل Conflict ولا يُفترض أنه discount.

## 11.4 Availability Parsing

```ts
type AvailabilityStatus =
  | 'IN_STOCK'
  | 'OUT_OF_STOCK'
  | 'PREORDER'
  | 'UNKNOWN';
```

Aliases per store توجد داخل Sigma adapter، لا داخل الـDomain العام.

## 11.5 Label Mapping

يتم الاحتفاظ بملف Data Dictionary versioned:

```ts
interface SpecLabelMapping {
  category: ProductCategory | 'ALL';
  rawLabels: string[];
  canonicalField: string;
  parser: ValueParserName;
  priority: number;
}
```

مثال:

```ts
{
  category: 'MOTHERBOARD',
  rawLabels: ['CPU Socket', 'Socket', 'Processor Socket'],
  canonicalField: 'socket',
  parser: 'CPU_SOCKET',
  priority: 100
}
```

## 11.6 Controlled Vocabularies

أمثلة:

```ts
type CpuSocket =
  | 'AM4'
  | 'AM5'
  | 'LGA1700'
  | 'LGA1851'
  | 'OTHER'
  | 'UNKNOWN';

type FormFactor =
  | 'E_ATX'
  | 'ATX'
  | 'MICRO_ATX'
  | 'MINI_ITX'
  | 'OTHER'
  | 'UNKNOWN';

type MemoryGeneration =
  | 'DDR3'
  | 'DDR4'
  | 'DDR5'
  | 'UNKNOWN';
```

## 11.7 Unit Parsers

كل Parser يعيد value + confidence + raw evidence:

```ts
interface ParsedField<T> {
  value: T | null;
  quality: 'EXACT' | 'NORMALIZED' | 'INFERRED' | 'MISSING' | 'CONFLICTING';
  confidence: number;
  sourceLabels: string[];
  rawValues: string[];
  warnings: string[];
}
```

Parsers المطلوبة:

- Watts.
- Millimeters/Inches -> mm.
- GB/TB -> GB.
- MHz/MT/s.
- GHz.
- Core/thread counts.
- Module kits: `2x16GB`.
- PCIe generation.
- Fan/radiator sizes.
- Power connectors.
- Boolean capability fields.

## 11.8 Field Precedence

إذا ظهرت نفس المعلومة من أكثر من مكان:

1. Exact structured spec with known label.
2. MPN/model table.
3. Product title extraction.
4. Description inference.

إذا structured spec والعنوان يتعارضان:

- field quality = `CONFLICTING`.
- لا يُختار أحدهما بصمت.
- تُنشأ Data Quality issue.
- يمكن عرض raw value مع استبعاد field من hard compatibility.

## 11.9 Category Schemas

كل Category لها Zod schema منفصلة. الحقول غير الموجودة `null` وليست omitted في الـCanonical specs المهمة، لتسهيل معنى Missing.

### CPU

```ts
interface CpuSpecs {
  manufacturer: 'AMD' | 'INTEL' | 'OTHER' | null;
  socket: CpuSocket | null;
  family: string | null;
  cores: number | null;
  threads: number | null;
  baseClockGhz: number | null;
  boostClockGhz: number | null;
  tdpW: number | null;
  integratedGraphics: boolean | null;
  packageType: 'BOX' | 'TRAY' | 'UNKNOWN';
  coolerIncluded: boolean | null;
}
```

### Motherboard

```ts
interface MotherboardSpecs {
  socket: CpuSocket | null;
  chipset: string | null;
  supportedCpuFamilies: string[];
  formFactor: FormFactor | null;
  memoryGeneration: MemoryGeneration | null;
  dimmSlots: number | null;
  maxMemoryGb: number | null;
  maxMemorySpeedMt: number | null;
  m2Slots: number | null;
  sataPorts: number | null;
  wifi: boolean | null;
  bluetooth: boolean | null;
  biosFlashback: boolean | null;
}
```

### RAM

```ts
interface RamSpecs {
  memoryGeneration: MemoryGeneration | null;
  totalCapacityGb: number | null;
  moduleCount: number | null;
  capacityPerModuleGb: number | null;
  speedMt: number | null;
  casLatency: number | null;
  moduleType: 'DIMM' | 'SODIMM' | 'UNKNOWN';
  ecc: boolean | null;
}
```

### GPU

```ts
interface GpuSpecs {
  gpuFamily: string | null;
  boardPartner: string | null;
  variant: string | null;
  vramGb: number | null;
  memoryType: string | null;
  lengthMm: number | null;
  slotWidth: number | null;
  boardPowerW: number | null;
  recommendedPsuW: number | null;
  requiredPowerConnectors: PowerConnectorRequirement[];
  interface: string | null;
}
```

### Storage

```ts
interface StorageSpecs {
  storageType: 'SSD' | 'HDD' | 'UNKNOWN';
  capacityGb: number | null;
  formFactor: 'M2_2230' | 'M2_2242' | 'M2_2260' | 'M2_2280' | 'M2_22110' | 'SATA_2_5' | 'SATA_3_5' | 'OTHER' | 'UNKNOWN';
  protocol: 'NVME' | 'SATA' | 'OTHER' | 'UNKNOWN';
  interface: string | null;
  pcieGeneration: number | null;
  readSpeedMb: number | null;
  writeSpeedMb: number | null;
}
```

### PSU

```ts
interface PsuSpecs {
  wattageW: number | null;
  efficiencyRating: EfficiencyRating;
  modularity: 'NON_MODULAR' | 'SEMI_MODULAR' | 'FULLY_MODULAR' | 'UNKNOWN';
  formFactor: 'ATX' | 'SFX' | 'SFX_L' | 'OTHER' | 'UNKNOWN';
  atxVersion: string | null;
  connectors: PowerConnectorInventory[];
}
```

### Case

```ts
interface CaseSpecs {
  supportedMotherboardFormFactors: FormFactor[];
  maxGpuLengthMm: number | null;
  maxCpuCoolerHeightMm: number | null;
  supportedRadiators: RadiatorSupport[];
  expansionSlots: number | null;
  psuFormFactors: string[];
  includedPsuW: number | null;
  includedFans: number | null;
}
```

### CPU Cooler

```ts
interface CpuCoolerSpecs {
  coolerType: 'AIR' | 'AIO' | 'UNKNOWN';
  supportedSockets: CpuSocket[];
  heightMm: number | null;
  radiatorSizeMm: number | null;
  fanCount: number | null;
  ratedTdpW: number | null;
}
```

### Case Fan

```ts
interface CaseFanSpecs {
  fanSizeMm: number | null;
  fanCount: number | null;
  connectorType: string | null;
  rgbType: string | null;
}
```

## 11.10 Data Quality Score

الـScore ليس إثبات صحة؛ هو مؤشر اكتمال وثقة.

### Base weights

| المجال | الوزن |
| --- | ---: |
| اسم صالح + URL | 15 |
| Category/Product kind | 10 |
| Brand/model/MPN | 20 |
| Price/availability | 10 |
| Critical compatibility fields | 35 |
| Images/raw specs | 10 |

`compatibilityCompleteness` يُحسب منفصلًا حسب الفئة.

مثال Motherboard critical fields:

- socket.
- formFactor.
- memoryGeneration.
- dimmSlots.

لا يمنع النشر انخفاض Score، لكنه يؤثر على Suggestion ranking ويظهر Badge في Admin.


# 12. Product Identity and Matching

## 12.1 هدف النظام في Store واحد

في Sigma-first نحتاج:

- تثبيت نفس المنتج بين Runs حتى لو تغير URL أو Title.
- اكتشاف duplicate listings داخل Sigma.
- إنشاء Canonical identity تسمح بإضافة متجر ثانٍ لاحقًا.

## 12.2 Identity Keys

بالأولوية:

1. GTIN/EAN/UPC exact.
2. Brand + MPN exact.
3. Brand + exact model.
4. Category-specific fingerprint.
5. Manual mapping.

لا يستخدم السعر أو المخزون كهوية.

## 12.3 Canonical Key

```ts
function buildCanonicalKey(candidate: IdentityCandidate): string {
  if (candidate.gtin) return `gtin:${normalizeGtin(candidate.gtin)}`;
  if (candidate.brand && candidate.mpn) {
    return `mpn:${slug(candidate.brand)}:${slug(candidate.mpn)}`;
  }
  if (candidate.brand && candidate.model) {
    return `model:${slug(candidate.brand)}:${slug(candidate.model)}`;
  }
  return `fingerprint:${candidate.category}:${candidate.fingerprintHash}`;
}
```

`canonicalKey` unique جزئيًا عندما تكون الثقة عالية. Fingerprint لا يُجعل unique تلقائيًا حتى لا يدمج منتجات خطأ.

## 12.4 Matching Stages

```text
1. Existing store alias by externalId
2. Exact GTIN
3. Exact Brand + MPN
4. Exact normalized Brand + Model
5. Candidate blocking
6. Category scoring
7. Hard contradiction checks
8. Decision
```

## 12.5 Candidate Blocking

- same category.
- same normalized brand إذا متاح.
- same product family/model tokens.
- active/review products فقط.

يُحدد حد أقصى 50 candidate للحفاظ على predictability.

## 12.6 Scoring

| الإشارة | النقاط |
| --- | ---: |
| Exact GTIN | 120 |
| Exact Brand + MPN | 100 |
| Existing external alias | 100 |
| Exact Brand + model | 75 |
| Same category | 10 |
| Same brand | 15 |
| Same major model tokens | 25 |
| Matching critical specs | حتى 30 |
| Strong title similarity | حتى 15 |

Thresholds الأولية:

- Exact identifier: `EXACT_MATCH`.
- Score >= 90 بلا contradiction: `PROBABLE_MATCH` قابل للـauto-link.
- 70-89: `NEEDS_REVIEW`.
- أقل من 70: `NEW_PRODUCT`.

## 12.7 Hard Contradictions

### General

- Category مختلفة.
- Brand مختلفة عند وجود brand مؤكدة.
- GTIN مختلفان.
- MPN مختلفان بوضوح.

### RAM

- DDR generation مختلفة.
- total capacity مختلفة.
- module count مختلفة.
- CAS/Speed مختلفة مع MPN غير مطابق.

### GPU

- Ti/Super/XT/XTX اختلاف.
- VRAM مختلفة.
- board partner/variant مختلف.

### Storage

- capacity مختلفة.
- protocol مختلف.
- form factor مختلف.

### PSU

- wattage مختلفة.
- efficiency tier مختلفة.
- model line مختلفة.

### CPU

- model مختلف.
- Box/Tray فرق يُحفظ كvariant مستقل في P0.

## 12.8 Match Review

```ts
interface MatchReviewDocument {
  storeListingId: ObjectId;
  candidates: Array<{
    productId: ObjectId;
    score: number;
    signals: MatchSignal[];
    contradictions: MatchContradiction[];
  }>;
  status: 'OPEN' | 'RESOLVED_LINK' | 'RESOLVED_NEW' | 'IGNORED';
  resolution?: {
    productId?: ObjectId;
    note?: string;
    resolvedAt: Date;
  };
}
```

عند Manual resolution يُنشأ `product_identity_alias` حتى لا تتكرر المراجعة.

## 12.9 Merge/Split Safety

لا يتم حذف Product عند الدمج. العملية:

1. نقل offers والaliases إلى target.
2. تسجيل `mergedIntoProductId` في المصدر.
3. إخفاء المصدر من الكتالوج.
4. الاحتفاظ بتاريخ القرار.

Split عملية Admin maintenance وتحتاج script مخصص واختبارات، وليست UI في P0.


# 13. Publishing Pipeline

## 13.1 Publish Eligibility

يُنشر Store Listing إذا:

- `externalId` صالح.
- `sourceUrl` صالح ومسموح domain.
- `displayTitle` غير فارغ.
- Category ليست `OTHER` غير مراجعة، إلا إذا قررنا عرض Other catalog.
- Product identity تم حلها إلى Product.
- لا يوجد `REJECTED` reason.

المواصفات الناقصة لا تمنع النشر.

## 13.2 Product Upsert

- إذا Product جديد: إنشاء canonical product من أفضل Store listing.
- إذا موجود: تحديث display/specs بحذر.
- لا تستبدل field `EXACT` بقيمة `INFERRED`.
- عند تعارض مصادر مستقبلًا، تحتفظ Evidence وتفتح issue بدل overwrite.

## 13.3 Offer Upsert

Atomic operation على `(storeCode, externalId)`:

1. قراءة previous commercial state.
2. `findOneAndUpdate` مع upsert.
3. إذا تغير state، إدخال PriceEvent.
4. تحديث pricing summary على product.

P0 يمكن تنفيذ الخطوتين 2 و3 داخل Transaction إذا كانت Mongo replica set متاحة محليًا. إن لم تكن، تعتمد على idempotent event key:

```text
offerId + stateHash + scrapeRunId
```

## 13.4 Missing Offers

بعد Full successful run:

- Seen: `missedSuccessfulRuns = 0`, `isStale = false`.
- Not seen once: `missedSuccessfulRuns += 1`, `isStale = true`.
- Not seen 3 مرات: `status = UNAVAILABLE`.
- لا حذف تلقائي.

Category partial run لا يغير offers خارج الفئة.


# 14. Search and Filtering Design

## 14.1 Search Goals

- Exact MPN/model يجب أن يتصدر.
- دعم أسماء مثل `rtx 5070`, `rtx5070`, `prime-b650m-k`.
- Filters server-side.
- Facet counts بعد تطبيق query والـfilters ذات الصلة.
- URL قابلة للمشاركة.

## 14.2 P0 Search Strategy

لمنع اعتماد الـMVP على Atlas Search، سننشئ Search fields مسبقًا:

```ts
search: {
  normalizedName: string;
  tokens: string[];
  aliases: string[];
  compactTerms: string[];
  prefixes: string[];
}
```

### Generation

لـ`MSI GeForce RTX 5070 Ventus 2X OC 12GB`:

```text
tokens:
msi, geforce, rtx, 5070, ventus, 2x, oc, 12gb

compactTerms:
rtx5070, ventus2x, 12gb, msirtx5070ventus2x

prefixes (selected tokens only):
rt, rtx, 50, 507, 5070, ven, vent, ventu, ventus
```

لا ننشئ كل Prefix لكل كلمة قصيرة لتجنب انفجار حجم الوثيقة.

## 14.3 Ranking

Application-level rank:

1. Exact normalized MPN.
2. Exact normalized model.
3. Exact compact term.
4. All query tokens present.
5. Prefix match.
6. Title token coverage.
7. In-stock boost صغير.

يتم جلب candidate set من Mongo ثم حساب score محدود داخل API. الحد الأقصى 300 candidate قبل pagination.

## 14.4 Query Normalization

- NFKC.
- lowercase.
- whitespace collapse.
- split alphanumeric boundaries عند الحاجة.
- generate compact version.
- alias normalizations: `m.2` -> `m2`, `wi-fi` -> `wifi`.

## 14.5 Filters

### General

- category.
- brand.
- price min/max.
- availability.
- product kind.
- build eligibility.
- data quality threshold.

### Category-specific

تُحدد في `CategoryFilterDefinition` داخل domain config:

```ts
interface CategoryFilterDefinition {
  key: string;
  label: string;
  fieldPath: string;
  type: 'ENUM' | 'NUMBER_RANGE' | 'BOOLEAN' | 'MULTI_SELECT';
  units?: string;
  sortable?: boolean;
}
```

## 14.6 Facets

Mongo aggregation:

```text
$match base query
$facet:
  items: sort + skip + limit
  total: count
  brands: group brand
  sockets: group specs.socket
  priceRange: min/max pricing.minCurrentPrice
```

عند حساب facet لقيمة معينة، يمكن استبعاد filter نفسها للحصول على multi-select UX صحيح؛ هذا P1 إن زاد تعقيد الـpipeline في P0.

## 14.7 Indexes

```js
{ category: 1, status: 1, 'pricing.minCurrentPrice': 1 }
{ category: 1, 'identity.brand': 1 }
{ category: 1, 'specs.socket': 1 }
{ category: 1, 'specs.memoryGeneration': 1 }
{ category: 1, 'specs.formFactor': 1 }
{ 'identity.mpn': 1 }
{ 'identity.model': 1 }
{ 'search.compactTerms': 1 }
{ 'search.tokens': 1 }
{ 'search.prefixes': 1 }
```

لا ننشئ كل Category index من اليوم الأول؛ نقيس `explain()` ونضيف ما تحتاجه queries الفعلية.

## 14.8 Atlas Search Upgrade Path

`SearchService` interface تمنع ربط الـController بالـMongo implementation:

```ts
interface CatalogSearchService {
  search(input: ProductSearchInput): Promise<ProductSearchResult>;
  suggest(input: SuggestInput): Promise<Suggestion[]>;
}
```

P1 يمكن استبدال implementation بـAtlas Search للـautocomplete والفuzzy دون تغيير API contract.


# 15. Compatibility Engine

## 15.1 Design Goals

- Typed and testable.
- Explainable.
- Missing data produces `UNKNOWN`.
- Incremental evaluation.
- Rules مستقلة عن Angular وMongoDB.
- لا توجد Expressions قادمة من DB يتم تنفيذها.

## 15.2 Statuses

```ts
type RuleStatus = 'PASS' | 'ERROR' | 'WARNING' | 'UNKNOWN' | 'INFO';
```

### Overall Build Status

```ts
type BuildCompatibilityStatus =
  | 'VALID'
  | 'VALID_WITH_WARNINGS'
  | 'INCOMPATIBLE'
  | 'INCOMPLETE'
  | 'UNKNOWN';
```

Rules:

- أي `ERROR` -> `INCOMPATIBLE`.
- لا Error + Warning -> `VALID_WITH_WARNINGS` إذا كل slots المطلوبة موجودة.
- slots أساسية ناقصة -> `INCOMPLETE`.
- لا Error ولا Warning لكن critical UNKNOWN -> `UNKNOWN`.
- otherwise -> `VALID`.

## 15.3 Build Slots

```ts
type BuildSlot =
  | 'CPU'
  | 'MOTHERBOARD'
  | 'GPU'
  | 'RAM'
  | 'STORAGE'
  | 'PSU'
  | 'CASE'
  | 'CPU_COOLER'
  | 'CASE_FAN';
```

Cardinality:

| Slot | الحد |
| --- | --- |
| CPU | 0..1 |
| Motherboard | 0..1 |
| GPU | 0..1 |
| RAM | 0..N kits، مع quantity |
| Storage | 0..N |
| PSU | 0..1 |
| Case | 0..1 |
| CPU Cooler | 0..1 |
| Case Fan | 0..N products/quantities |

## 15.4 Rule Contract

```ts
interface CompatibilityRule {
  readonly code: string;
  readonly version: number;
  readonly severityClass: 'HARD' | 'SOFT' | 'INFORMATIONAL';
  readonly dependsOnSlots: BuildSlot[];

  evaluate(context: CompatibilityContext): RuleResult[];
}
```

```ts
interface RuleResult {
  ruleCode: string;
  ruleVersion: number;
  status: RuleStatus;
  title: string;
  message: string;
  affectedItems: BuildItemReference[];
  evidence: RuleEvidence[];
  missingFields: string[];
  suggestions: RuleSuggestion[];
}
```

## 15.5 Rule Registry

```ts
const rules: CompatibilityRule[] = [
  new CpuMotherboardSocketRule(),
  new CpuMotherboardSupportRule(),
  new MotherboardRamGenerationRule(),
  new MotherboardRamSlotCountRule(),
  new MotherboardRamCapacityRule(),
  new MotherboardCaseFormFactorRule(),
  new GpuCaseLengthRule(),
  new GpuCaseSlotRule(),
  new CoolerCpuSocketRule(),
  new AirCoolerCaseHeightRule(),
  new AioCaseRadiatorRule(),
  new PsuWattageRule(),
  new PsuGpuConnectorRule(),
  new StorageMotherboardInterfaceRule(),
  new IntegratedGraphicsRule(),
];
```

## 15.6 Rule Evaluation

Full evaluation عند:

- فتح build summary.
- طلب `/validate`.

Incremental evaluation عند تغيير Slot:

```ts
const affectedRules = registry.getRulesForSlots(changedSlots);
```

النتائج تُحفظ Snapshot داخل Build لسرعة العرض، لكن المصدر الحقيقي هو إعادة التقييم الحالية.

## 15.7 Rule Catalog - P0

### CMP-CPU-MB-001 Socket

Inputs:

- `CPU.specs.socket`
- `MOTHERBOARD.specs.socket`

Results:

- equal -> PASS.
- different -> ERROR.
- missing/conflicting -> UNKNOWN.

### CMP-CPU-MB-002 Explicit CPU support / BIOS

Inputs:

- CPU family/model.
- Motherboard supported families/reference data.
- BIOS requirement إذا متاح.

Results:

- explicit support -> PASS.
- unsupported -> ERROR.
- support after BIOS update -> WARNING.
- no support data -> UNKNOWN.

P0 قد يعتمد على family/chipset reference data وليس scraping manufacturer lists كاملة.

### CMP-MB-RAM-001 Memory Generation

- DDR generation mismatch -> ERROR.
- matching -> PASS.
- missing -> UNKNOWN.

### CMP-MB-RAM-002 Module Type

- SODIMM مع desktop motherboard -> ERROR.
- DIMM -> PASS.
- unknown -> UNKNOWN.

### CMP-MB-RAM-003 Slot Count

- مجموع modules > dimmSlots -> ERROR.
- equal/less -> PASS.
- missing slot/module count -> UNKNOWN.

### CMP-MB-RAM-004 Capacity

- total capacity > max memory -> ERROR.
- otherwise PASS.
- missing -> UNKNOWN.

### CMP-MB-RAM-005 Speed

- RAM speed أعلى من board max -> WARNING: ستعمل بسرعة أقل أو تحتاج profile/OC.
- within max -> INFO/PASS.
- missing -> UNKNOWN informational.

### CMP-MB-CASE-001 Form Factor

- Case list contains board form factor -> PASS.
- not contained -> ERROR.
- missing -> UNKNOWN.

### CMP-GPU-CASE-001 Length

- gpu.length > case.max -> ERROR.
- clearance 0-9mm -> WARNING.
- clearance >=10mm -> PASS.
- missing -> UNKNOWN.

### CMP-GPU-CASE-002 Expansion Slots

- required slot width > case available slots -> ERROR.
- close fit -> WARNING.
- missing -> UNKNOWN.

### CMP-COOLER-CPU-001 Socket Support

- supportedSockets contains CPU socket -> PASS.
- absent -> ERROR.
- missing -> UNKNOWN.

### CMP-AIR-CASE-001 Cooler Height

- height > max -> ERROR.
- clearance <5mm -> WARNING.
- otherwise PASS.
- missing -> UNKNOWN.

### CMP-AIO-CASE-001 Radiator Support

- exact size and position available -> PASS.
- size unavailable -> ERROR.
- size available but position/clearance unknown -> WARNING/UNKNOWN.

### CMP-PSU-001 Wattage

Power estimate:

```text
estimatedLoad =
  cpuPower
+ gpuBoardPower
+ motherboardAllowance
+ ramAllowance
+ storageAllowance
+ fanAllowance
+ fixedMiscAllowance
```

Defaults عند غياب field تُستخدم كـconservative estimate مع Evidence `INFERRED_ESTIMATE`، لا كحقيقة المنتج.

```text
calculatedRequired = roundUpTo50(estimatedLoad * 1.25)
requiredPsu = max(calculatedRequired, gpuRecommendedPsu)
```

- PSU < required by meaningful margin -> ERROR.
- PSU قريب أو recommendation inferred -> WARNING.
- PSU >= required -> PASS.
- data insufficient جدًا -> UNKNOWN.

### CMP-PSU-GPU-001 Connectors

- inventory satisfies requirements -> PASS.
- missing connector -> ERROR.
- adapter needed/unknown inventory -> WARNING أو UNKNOWN.

### CMP-STORAGE-MB-001 Interface

- SATA drive requires SATA availability.
- NVMe M.2 requires compatible M.2 slot.
- higher PCIe generation on lower slot -> WARNING، ليس Error.
- no compatible slot -> ERROR.

### CMP-GRAPHICS-001 Display Capability

- GPU selected -> PASS.
- no GPU + CPU iGPU true -> PASS.
- no GPU + CPU iGPU false -> WARNING حتى إكمال Build؛ يصبح ERROR في final validation إذا المستخدم أعلن Build كاملة.
- unknown -> UNKNOWN.

## 15.8 Candidate Classification

عند عرض منتجات Slot:

```ts
type CandidateCompatibilityGroup =
  | 'COMPATIBLE'
  | 'COMPATIBLE_WITH_WARNINGS'
  | 'UNKNOWN'
  | 'INCOMPATIBLE';
```

- كل المنتجات تظهر.
- Default sort: compatible ثم warnings ثم unknown ثم incompatible.
- يمكن للمستخدم اختيار incompatible بعد Confirmation.
- تظهر أول 1-3 أسباب مباشرة على card، وباقي التفاصيل في drawer.

## 15.9 Suggestion Score

```text
compatibilityGroupWeight  0..100
availabilityWeight        0..20
qualityWeight             0..15
budgetFitWeight           0..15
priceWeight               0..10
```

لا يتم استخدام Performance score في P0.


# 16. PC Builder Design

## 16.1 Build Model

```ts
interface BuildDocument {
  _id: ObjectId;
  publicId: string;
  name: string | null;
  status: 'DRAFT' | 'COMPLETE' | 'ARCHIVED';

  items: BuildItem[];
  constraints: {
    budgetEgp: number | null;
    preferredBrands: string[];
  };

  compatibilitySnapshot: {
    rulesVersion: string;
    evaluatedAt: Date | null;
    overallStatus: BuildCompatibilityStatus;
    results: RuleResult[];
  };

  pricingSnapshot: {
    totalObservedPrice: number | null;
    pricedItems: number;
    unpricedItems: number;
    calculatedAt: Date | null;
  };

  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}
```

```ts
interface BuildItem {
  id: string;
  slot: BuildSlot;
  productId: ObjectId;
  quantity: number;
  selectedOfferId: ObjectId | null;
  addedAt: Date;
}
```

## 16.2 Guest Builds

- API ينشئ `publicId` عشوائي عالي entropy.
- Web يخزنه في localStorage.
- لا توجد بيانات شخصية.
- Builds غير المستخدمة يمكن حذفها بعد مدة Configurable.
- لا يُسمح بتخمين IDs متسلسلة.

## 16.3 Add/Replace Flow

1. Validate product exists and active.
2. Validate build eligibility.
3. Validate slot matches category.
4. Apply cardinality: replace single slot أو add multi slot.
5. Save item atomically.
6. Evaluate affected rules.
7. Recalculate price.
8. Return full updated Build DTO.

## 16.4 Optimistic Concurrency

Build تحمل `version` number.

Request update:

```http
If-Match: "<version>"
```

أو body `expectedVersion`.

Mongo update:

```js
{ _id, version: expectedVersion }
$set: ...
$inc: { version: 1 }
```

إذا لم يحدث update -> `409 BUILD_VERSION_CONFLICT`.

هذا يمنع ضياع تعديل إذا فتح المستخدم نفس Build في Tabين.

## 16.5 Build Completeness

الـBuild تعتبر Complete عندما يوجد على الأقل:

- CPU.
- Motherboard.
- RAM.
- Storage.
- PSU.
- Case.
- CPU cooler أو coolerIncluded=true.
- GPU أو iGPU مؤكدة.

Case fans اختيارية.


# 17. Bundles and Prebuilts

## 17.1 Rules

- تظهر في Catalog.
- لها Product Details.
- لها Offer ورابط شراء.
- لا تظهر كCandidate لأي slot.
- `buildEligibility = NOT_ELIGIBLE`.
- لا تدخل Compatibility Engine.
- لا تُفكك إلى components.

## 17.2 Bundle Data

```ts
interface BundleSpecs {
  includedComponentsText: string[];
  declaredComponentCount: number | null;
}
```

هذا للعرض فقط، وليس مصدر Product Matching أو compatibility.


# 18. Purchase Plan and Commerce Boundary

## 18.1 P0 Model

المنصة تنشئ **Build Shopping List** وليس Order:

```ts
interface PurchasePlanDto {
  buildId: string;
  currency: 'EGP';
  observedTotal: number | null;
  calculatedAt: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    store: 'Sigma Computer';
    observedUnitPrice: number | null;
    availability: AvailabilityStatus;
    sourceUrl: string;
    lastSeenAt: string;
  }>;
  disclaimer: string;
}
```

## 18.2 User Flow

- زر لكل منتج: `Open at Sigma`.
- زر `Open available items` اختياري لكن لا يعتمد عليه بسبب popup blocking.
- Checklist توضح ما تم فتحه يدويًا في الواجهة فقط.
- لا يتم إرسال Cart data إلى Sigma بدون Integration رسمي.

## 18.3 Future Multi-store

عند إضافة متجر آخر:

- كل item يختار Offer.
- Group by store.
- Checkout منفصل لكل متجر.
- Strategies مستقبلية: cheapest overall, single store, max N stores.
- لا يوجد split payment.


# 19. REST API Design

## 19.1 Conventions

- Base path: `/api/v1`.
- JSON فقط.
- Dates ISO 8601 UTC.
- IDs strings.
- Field names camelCase.
- Pagination page-based في P0.
- Max page size 100.
- Errors وفق Problem Details مبسط.

## 19.2 Error Contract

```json
{
  "type": "https://example.dev/problems/build-version-conflict",
  "title": "Build version conflict",
  "status": 409,
  "code": "BUILD_VERSION_CONFLICT",
  "detail": "The build was modified by another request.",
  "instance": "/api/v1/builds/abc/items/cpu",
  "correlationId": "01J...",
  "errors": []
}
```

## 19.3 Middleware Order

1. correlation ID.
2. request logger.
3. security headers.
4. CORS.
5. JSON size limit.
6. route-specific rate limiting إن لزم.
7. routers.
8. not found.
9. centralized error mapper.

## 19.4 Catalog Endpoints

```http
GET /api/v1/categories
GET /api/v1/categories/:category/filter-definitions
GET /api/v1/products
GET /api/v1/products/:productId
GET /api/v1/products/:productId/offers
GET /api/v1/products/:productId/price-history
GET /api/v1/search/suggestions?q=&category=
```

### `GET /products`

Parameters:

```text
q
category
brand
availability
minPrice
maxPrice
sort
page
pageSize
<category filters>
```

Response:

```ts
interface ProductSearchResponse {
  items: ProductCardDto[];
  pagination: PageDto;
  facets: Record<string, FacetDto>;
  appliedFilters: Record<string, unknown>;
  query: string | null;
}
```

## 19.5 Build Endpoints

```http
POST   /api/v1/builds
GET    /api/v1/builds/:publicId
PATCH  /api/v1/builds/:publicId
PUT    /api/v1/builds/:publicId/items/:slot
POST   /api/v1/builds/:publicId/items/:slot
DELETE /api/v1/builds/:publicId/items/:itemId
POST   /api/v1/builds/:publicId/validate
GET    /api/v1/builds/:publicId/candidates/:slot
GET    /api/v1/builds/:publicId/purchase-plan
```

### Candidate endpoint

```text
GET /builds/{id}/candidates/MOTHERBOARD
?q=
&includeIncompatible=true
&page=1
```

Response groups أو items مع `compatibilityGroup` و`topReasons`.

## 19.6 Admin Endpoints

Protected with `X-Admin-Token` in P0:

```http
GET  /api/v1/admin/scrape-runs
GET  /api/v1/admin/scrape-runs/:id
GET  /api/v1/admin/match-reviews
GET  /api/v1/admin/match-reviews/:id
POST /api/v1/admin/match-reviews/:id/link
POST /api/v1/admin/match-reviews/:id/create-product
POST /api/v1/admin/match-reviews/:id/ignore
GET  /api/v1/admin/data-quality-issues
POST /api/v1/admin/data-quality-issues/:id/resolve
GET  /api/v1/admin/store-listings/:id
```

لا يوجد Endpoint يبدأ Scraper في P0. التشغيل CLI أو Scheduler فقط، حفاظًا على فصل الـAPI.

## 19.7 Health Endpoints

```http
GET /health/live
GET /health/ready
```

`ready` يفحص Mongo ping ووجود indexes الأساسية/config seed.


# 20. API Module Design

كل Module:

```text
module/
├── controller.ts
├── service.ts
├── repository.ts (interface or import from database)
├── routes.ts
├── schemas.ts
├── mappers.ts
└── tests/
```

Rules:

- Controller لا يحتوي business logic.
- Service لا يعتمد على Express types.
- Repository لا يعيد Mongo documents مباشرة إلى Controller.
- Mapping إلى DTO في module mapper.
- Zod validation عند حدود HTTP.


# 21. Angular Application Design

## 21.1 Architecture

- Standalone components.
- Lazy-loaded routes.
- Signals للـfeature state.
- RxJS للـHTTP streams والبحث debouncing.
- لا NgRx في P0.
- Smart page components + presentational components.

## 21.2 Routes

```text
/                       Home/entry
/products               Catalog
/products/:id           Product details
/builder                 New/resume builder
/builder/:publicId       Build editor
/builder/:publicId/summary
/bundles                 Bundle catalog view
/admin/scrape-runs
/admin/match-reviews
/admin/data-quality
```

## 21.3 Feature Structure

```text
features/catalog/
├── data-access/
│   ├── catalog-api.service.ts
│   ├── catalog.store.ts
│   └── catalog.models.ts
├── pages/
│   └── catalog-page.component.ts
├── components/
│   ├── search-box/
│   ├── filter-sidebar/
│   ├── product-grid/
│   ├── product-card/
│   └── facets/
└── catalog.routes.ts
```

## 21.4 Catalog State

```ts
interface CatalogState {
  query: ProductQueryState;
  result: ProductSearchResponse | null;
  loading: boolean;
  error: ApiProblem | null;
}
```

- URL query params هي source of truth للفلاتر.
- Form changes -> debounce 300ms -> update URL.
- Router change -> fetch.
- `switchMap` يلغي request السابق.

## 21.5 Builder State

- API Build هي source of truth.
- Local signal store يحتفظ بالعرض الحالي.
- كل mutation يعيد Build DTO كاملًا.
- Optimistic UI محدود؛ يفضل pending state حتى نجاح server mutation بسبب التوافق والversioning.
- عند 409 يعاد تحميل build وتظهر رسالة conflict.

## 21.6 Compatibility UI

على Product candidate card:

- Badge status.
- top reason.
- زر details.

داخل Build summary:

- Overall status.
- Errors أولًا.
- Warnings.
- Unknowns.
- Passed checks collapsed.
- Evidence fields.

## 21.7 Product Details

Sections:

- title, image, current offer.
- price, old price, availability, last checked.
- canonical specs grouped.
- all raw Sigma specifications.
- data quality note إن كانت critical fields ناقصة.
- `Open at Sigma`.
- `Add to Build` إن eligible.

## 21.8 Accessibility

- Keyboard navigation للفلاتر والBuilder slots.
- Status لا يعتمد على اللون فقط.
- `aria-live` لتغير نتائج البحث والتوافق.
- Buttons descriptive.
- Focus management بعد dialog confirmation.
- Responsive from mobile width لكن Desktop-first للBuilder.


# 22. Admin and Data Quality UI

## 22.1 Scrape Runs

تعرض:

- status timeline.
- counts لكل Stage.
- category counts.
- failure samples.
- parser version.
- health gates.
- links إلى affected listings.

## 22.2 Match Review

- listing source title/specs.
- candidate products.
- match score signals.
- contradictions.
- actions: link, create new, ignore.

## 22.3 Data Quality

Filters:

- category.
- issue code.
- severity.
- unresolved.
- missing field.

Actions:

- add normalization override.
- classify manually.
- mark false positive.
- reprocess listing (CLI action instruction في P0، أو DB flag P1).


# 23. Reference Data

## 23.1 Purpose

بعض التوافق لا يمكن استنتاجه من Sigma وحدها، مثل:

- CPU family to socket.
- chipset family.
- known motherboard/CPU generation support.
- standard connector aliases.

## 23.2 Storage

P0 يمكن حفظ reference data كـversioned JSON داخل package:

```text
packages/domain/reference-data/
├── cpu-families.json
├── chipset-support.json
├── sockets.json
├── form-factors.json
└── power-connectors.json
```

Seed إلى `reference_data` اختياري للـAdmin visibility.

## 23.3 Change Control

- كل file يحمل `version` و`sourceNotes`.
- تحديث Reference data يحتاج tests لقواعد متأثرة.
- لا يتم Scrape manufacturers آليًا في P0.


# 24. Database Design and Index Management

## 24.1 Mongo Client

- Singleton client لكل process.
- Connection pool defaults مع config محدود.
- Graceful shutdown.
- Retry writes مفعّل.
- API لا يبدأ إذا readiness غير متاحة بعد timeout واضح.

## 24.2 Index Migrations

لا تعتمد على auto-create عند كل startup. يوجد command:

```bash
npm run db:indexes
```

يحمل definitions versioned وينشئ/يقارن indexes.

```ts
interface IndexMigration {
  id: string;
  collection: string;
  keys: IndexSpecification;
  options: CreateIndexesOptions;
}
```

## 24.3 Collection Validation

Mongo JSON Schema للحقول الأساسية فقط، مع Zod validation في التطبيق. لا نجعل Mongo schema معقدة جدًا لدرجة تعطل reprocessing.

## 24.4 Transactions

تستخدم عند:

- Move offer during manual merge.
- Resolve match + create alias + link listing.
- Build mutation + version update في document واحد لا تحتاج transaction.

Local Docker يفضل Replica Set single-node إذا اختبرنا Transactions.


# 25. Concurrency and Idempotency

## 25.1 Worker Lock

Collection `worker_locks`:

```ts
{
  key: 'SIGMA_FULL_RUN',
  ownerId: string,
  acquiredAt: Date,
  expiresAt: Date
}
```

Atomic `findOneAndUpdate` بشرط expired أو absent.

- يمنع Full Run متزامن.
- TTL index ينظف locks المنتهية.
- Lock heartbeat للRuns الطويلة.

لا نحتاج Redis distributed lock.

## 25.2 Idempotency Keys

- listing: `storeCode + externalId`.
- offer: `storeCode + externalId`.
- alias: `storeCode + externalId`.
- price event: `offerId + stateHash + runId`.
- raw snapshot: append، مع duplicate content detection.

## 25.3 Bulk Writes

Normalization/publish تستخدم `bulkWrite` batches، مثل 100 document، مع ordered=false. Errors تُسجل per item ولا توقف الـbatch كله.


# 26. Observability

## 26.1 Structured Logs

كل log يحتوي ما يناسب السياق:

```json
{
  "level": "info",
  "service": "worker",
  "storeCode": "SIGMA",
  "scrapeRunId": "...",
  "externalId": "...",
  "stage": "NORMALIZE",
  "event": "listing.normalized",
  "durationMs": 42
}
```

لا تسجل HTML كامل أو tokens.

## 26.2 Correlation

- API: `correlationId` لكل request.
- Worker: `scrapeRunId` + `jobId`.
- DB issues تربط بالـsnapshot والـrun.

## 26.3 Metrics P0

تُستخرج من scrape run documents/logs، دون Prometheus إلزامي:

- discovered count.
- fetch success/failure.
- parse missing rates.
- normalization review rate.
- auto match/review/new counts.
- publish counts.
- run duration.
- catalog active count per category.
- compatibility UNKNOWN rate per rule/category.

## 26.4 Runbooks

داخل `docs/runbooks`:

- Sigma returned zero products.
- Selector broken.
- Prices parsed incorrectly.
- Duplicate products increased.
- Run stuck/lock expired.
- Reprocess snapshots after normalizer update.
- Restore catalog after bad publish.


# 27. Security

## 27.1 API

- Helmet/security headers.
- Strict CORS to web origin.
- Request body size limit.
- Zod validation.
- No raw Mongo query from client.
- Escape/encode output naturally via Angular.
- Admin token hashed comparison أو constant-time comparison.
- Rate limit admin endpoints and build creation if public.

## 27.2 SSRF Protection

- Worker adapter يسمح فقط Sigma allowlisted hosts.
- API لا يقبل URL ليقوم بتحميله.
- Admin inspect URL CLI يتحقق من allowlist.
- redirects خارج domain تُرفض.

## 27.3 Data Privacy

- لا بيانات شخصية في P0.
- لا Accounts.
- Guest build IDs غير متسلسلة.
- Logs لا تخزن IP إلا إذا احتجنا تشغيلًا فعليًا؛ افتراضيًا لا.

## 27.4 Dependency Security

- `npm audit` كإشارة لا كحكم آلي.
- Dependabot/Renovate للpatches.
- Lockfile committed.
- تحديث major عبر PR واختبارات.


# 28. Testing Strategy

## 28.1 Test Pyramid

```text
Many unit tests
Moderate integration tests
Few high-value E2E tests
Very few live-site smoke tests
```

## 28.2 Scraper Tests

### Fixture parser tests

- category pagination.
- product URLs.
- title.
- fixed price.
- old price.
- unavailable.
- specs table.
- image links.
- bundle detection.
- missing fields.

### Snapshot regression

Parser output JSON snapshot for each representative HTML. تغييرات مقصودة تُراجع يدويًا.

### Live smoke

اختبار يدوي أو scheduled محدود على 1-3 URLs، لا يعمل في كل CI run.

## 28.3 Normalization Tests

Table-driven tests:

```text
"Micro-ATX" -> MICRO_ATX
"mATX" -> MICRO_ATX
"2 x 16 GB" -> total 32, modules 2
"750 Watts" -> 750
"PCIe Gen4 x4" -> generation 4
```

كل Quality/Conflict path له اختبار.

## 28.4 Matching Tests

- exact alias.
- exact MPN.
- reordered title.
- same family different VRAM.
- same RAM name different capacity.
- bundle never matches component.
- hard contradiction overrides score.

## 28.5 Compatibility Tests

لكل Rule على الأقل:

- PASS.
- ERROR إن applicable.
- WARNING إن applicable.
- UNKNOWN.
- null safety.
- conflicting field behavior.

Property-style tests لبعض القواعد العددية، مثل أن زيادة PSU wattage لا تجعل نتيجة PASS تتحول Error.

## 28.6 Repository Integration Tests

- unique indexes.
- upsert idempotency.
- build optimistic concurrency.
- missing offer transitions.
- manual match transaction.
- facet aggregation.

## 28.7 API Tests

- validation errors.
- pagination.
- filters.
- not found.
- build mutation and conflict.
- admin auth.
- problem details shape.

## 28.8 Angular Tests

- component tests للـfilters/status badges.
- store tests للURL synchronization.
- E2E flows:
  1. search product -> details -> open store link.
  2. create build -> select CPU -> choose compatible board -> see result.
  3. deliberately select incompatible RAM -> error appears.
  4. bundle cannot be added.
  5. reload and resume build.


# 29. CI/CD

## 29.1 Pull Request Pipeline

```text
install
-> lint
-> typecheck
-> unit tests
-> integration tests
-> build web/api/worker
-> optional E2E on main
```

## 29.2 Quality Gates

- no TypeScript errors.
- lint pass.
- tests pass.
- migrations/index definitions valid.
- no accidental fixture larger than configured limit.
- no `.env` committed.

لا نضع Coverage percentage عالي مصطنع. Gate أولي:

- compatibility/normalization critical packages >= 85% branch coverage.
- باقي المشروع monitored وليس blocking في البداية.

## 29.3 Deployment Artifacts

- Web static build.
- API container.
- Worker container أو same image بcommand مختلف.
- migration/index command.


# 30. Deployment Topology

## 30.1 Local

```text
Host:
  Angular dev server
  API process
  Worker CLI
Docker:
  MongoDB single node/replica set
```

## 30.2 Portfolio Hosting

خيار بسيط:

- Angular: static hosting.
- API: container hosting.
- Worker: scheduled container/job أو manually invoked.
- MongoDB Atlas.

لا يلزم تشغيل Worker 24/7؛ يمكن تشغيل scheduled job ثم إغلاقه.

## 30.3 Release Order

1. Apply indexes/migrations.
2. Deploy API compatible backward with current data.
3. Deploy Web.
4. Deploy/run Worker.
5. Verify health and sample product.


# 31. Performance and Capacity Assumptions

## 31.1 Expected Scale P0

تصميم مريح لـ:

- بضعة آلاف catalog products.
- آلاف/عشرات آلاف snapshots تاريخية.
- متجر واحد.
- عدد محدود من users للـPortfolio demo.

لا نحتاج sharding.

## 31.2 API Targets (Development Targets)

- Product list/search cached DB path: p95 أقل من 500ms على dataset المتوقع.
- Product details: p95 أقل من 300ms.
- Build mutation + compatibility: p95 أقل من 500ms.
- Candidate evaluation: page of 24 products أقل من 800ms.

هذه أهداف قياس وليست SLA تجارية.

## 31.3 Compatibility Candidate Optimization

- Query basic hard-compatible fields في Mongo عند الإمكان، لكن لا نخفي incompatible.
- Fetch page groups by likely compatibility.
- Evaluate full rule set على page candidates فقط.
- Cache normalized product facts داخل request scope.


# 32. Failure Scenarios and Recovery

## 32.1 Sigma HTML changed

Symptoms:

- missing title/price spike.
- discovery count drop.

Action:

- fail health gate.
- preserve current catalog.
- inspect failed HTML.
- update parser version.
- reprocess stored raw snapshots إن HTML data ما زالت موجودة.

## 32.2 Bad Normalizer Version

- Stop publish.
- mark normalizer version disabled في config.
- reprocess latest snapshots with previous/new fixed version.
- product versions allow audit.

## 32.3 Accidental Wrong Product Merge

- use merge audit.
- split via maintenance script.
- restore offer/alias ownership.
- add contradiction/override test.

## 32.4 Mongo unavailable أثناء Scraping

- Crawlee request results لا تعتبر complete دون persistence.
- fail run safely.
- lock expires.
- rerun because jobs idempotent.

## 32.5 Partial Publish

- Publish batch records progress.
- rerun remaining listings.
- unique indexes prevent duplicates.
- missing offer lifecycle only after publish finalization.

## 32.6 Stale price shown

- display `lastSeenAt` and stale badge.
- disclaimer.
- do not claim stock reservation.


# 33. Implementation Phases

> كل Phase أدناه تُحول إلى Epic. البنود الداخلية Issues صغيرة. لا تبدأ Feature UI كاملة قبل أن يكون Data contract الخاص بها مستقرًا.

## Phase M0 - Foundation

### الهدف

إنشاء Repository قابلة للبناء والاختبار، وتشغيل web/api/worker ومMongoDB.

### Tasks

- إنشاء Git repository وbranch rules.
- npm workspaces.
- Angular app.
- Express TypeScript app.
- Worker CLI skeleton.
- shared tsconfig/eslint/prettier.
- config package وenvironment validation.
- Mongo client package.
- Docker Compose.
- Pino logging.
- `/health/live`, `/health/ready`.
- Vitest + Supertest setup.
- CI workflow.
- ADR-001 modular monorepo.

### Deliverables

- `npm run dev` يشغل Web/API.
- `npm run worker -- health` يتصل Mongo.
- `npm test` من root.
- README setup.

### Exit Criteria

- Clean clone يعمل بخطوات موثقة.
- API/Worker يشتركان في config/database packages.
- لا توجد imports مخالفة للحدود.
- CI green.


## Phase M1 - Sigma Data Discovery

### الهدف

فهم HTML الحقيقي قبل بناء Full crawler وتثبيت Data Dictionary الأولي.

### Tasks

- فحص robots/terms يدويًا وتسجيل القرار.
- حصر Category seed URLs.
- اختيار 30-50 صفحة تغطي كل الأنواع والحالات.
- حفظ HTML fixtures.
- تسجيل selectors المحتملة.
- تسجيل pagination behavior.
- استخراج جميع raw spec labels.
- بناء Data Dictionary v0.1.
- تحديد Bundle/prebuilt examples.
- تحديد حالات السعر والمخزون.
- ADR-002 HTTP-first scraping.

### Deliverables

- `fixtures/sigma` منظمة.
- Discovery report.
- Category seed config.
- Spec label inventory CSV/Markdown.

### Exit Criteria

- Fixture واحدة على الأقل لكل Category وحالة edge رئيسية.
- قرار واضح هل Playwright مطلوب لأي Route.
- لا يبدأ Full scraper قبل نجاح parser tests على العينة.


## Phase M2 - Raw Scraper

### الهدف

تنفيذ Discovery + Fetch + Raw snapshots بطريقة idempotent ومراقبة.

### Tasks

- Store adapter contract.
- Sigma adapter category parser.
- pagination loop protection.
- product parser basic fields.
- request rate/concurrency config.
- scrape run repository/state machine.
- worker lock.
- raw snapshot persistence.
- HTML gzip storage.
- retries/failure classifications.
- health gates.
- CLI commands full/category/url.
- fixture tests + live sample command.

### Deliverables

- Full run يكتشف ويحمل صفحات Sigma.
- Run report counts.
- Raw snapshots قابلة لإعادة الاستخدام.

### Exit Criteria

- إعادة نفس run/process لا تنشئ duplicates غير مقصودة.
- failure لا يحذف بيانات سابقة.
- >=95% من sample fixtures تُحلل حقولها الأساسية.
- Full run result قابل للتدقيق.


## Phase M3 - Classification and Normalization

### الهدف

تحويل Raw data إلى Store listings consistent لكل الفئات.

### Tasks

- taxonomy types.
- text/price/availability parsers.
- brand aliases.
- label mapping engine.
- unit parsers.
- category schemas.
- conflict detection.
- data quality score.
- search term generation.
- normalizer versioning.
- reprocess command.
- data quality issue repository.
- extensive table-driven tests.

### Deliverables

- `store_listings` لكل snapshot حديث.
- Quality report per category.
- Data Dictionary v1.0.

### Exit Criteria

- كل discovered listing إما normalized أو لها rejection/review reason.
- لا توجد قيم افتراضية مخترعة للحقول الحرجة.
- parser/normalizer tests تغطي edge cases المعروفة.


## Phase M4 - Product Identity and Publishing

### الهدف

إنشاء Canonical products وOffers مستقرة.

### Tasks

- identity extractors.
- canonical key.
- aliases collection.
- exact matching.
- candidate blocking/scoring.
- hard contradictions.
- match review creation.
- catalog product upsert.
- offer upsert.
- price events.
- missing offer lifecycle.
- pricing summary updates.
- admin CLI/report للمراجعات.

### Deliverables

- Active catalog_products.
- Sigma offers linked.
- Match review queue.

### Exit Criteria

- same external product stays linked across runs.
- bundles never match single components.
- no unresolved listing published تحت product خاطئ تلقائيًا.
- price changes generate one event only.


## Phase M5 - Catalog API and Search

### الهدف

تقديم Catalog searchable/filterable عبر API مستقرة.

### Tasks

- categories/filter definitions.
- product list/detail repositories.
- search normalization/ranking.
- facets aggregation.
- pagination/sorting.
- offers and price history endpoints.
- problem details/error middleware.
- indexes and explain review.
- API integration tests.

### Deliverables

- `/api/v1/products` كامل.
- Postman/Bruno collection أو OpenAPI document.

### Exit Criteria

- exact model/MPN يظهر ضمن أول النتائج.
- filters لكل الفئات الأساسية تعمل على canonical fields.
- details تعرض raw + canonical specs.
- query performance مقبولة على full Sigma dataset.


## Phase M6 - Catalog Web UI

### الهدف

واجهة مستخدم كاملة للكتالوج قبل Builder.

### Tasks

- app shell/routes.
- catalog page.
- search/autocomplete.
- filter sidebar/drawer.
- product cards.
- facets/results/pagination.
- product details.
- bundle badge.
- Sigma outbound link.
- loading/error/empty states.
- URL synchronization.
- responsive/a11y baseline.
- E2E catalog flow.

### Deliverables

- المستخدم يبحث ويفلتر ويفتح Product ثم Sigma.

### Exit Criteria

- كل Category يمكن الوصول إليها.
- كل valid product يظهر.
- لا يتم إخفاء missing-spec products.
- Bundle لا يظهر Add to Build.


## Phase M7 - Match Review and Data Quality Admin

### الهدف

جعل أخطاء البيانات قابلة للإدارة بدل إصلاحها يدويًا في DB.

### Tasks

- admin token middleware.
- scrape run pages.
- match review endpoints/UI.
- data quality list/details.
- manual classification/mapping overrides.
- audit note.
- admin tests.

### Exit Criteria

- يمكن حل match review من الواجهة.
- القرار ينشئ alias دائمًا.
- Admin لا يستطيع تعديل raw snapshot.


## Phase M8 - Compatibility Engine

### الهدف

تنفيذ Rule engine المستقل وقواعد P0 كاملة.

### Tasks

- Build context/facts.
- rule contract/registry.
- result/evidence model.
- rules per catalog.
- overall status reducer.
- power estimate service.
- candidate classification.
- suggestion score.
- unit/property tests.
- rules versioning.

### Deliverables

- package مستقلة يمكن تشغيلها دون API.
- Rule matrix documentation.

### Exit Criteria

- كل Rule لها PASS/ERROR/UNKNOWN tests.
- no missing field yields false PASS.
- results explain evidence.
- overall state deterministic.


## Phase M9 - Build API and UI

### الهدف

إكمال رحلة بناء PC واختبار التوافق والاقتراحات.

### Tasks

- builds collection/repository.
- guest public IDs.
- optimistic concurrency.
- item cardinality.
- mutation endpoints.
- validate/candidates endpoints.
- builder slots UI.
- candidate drawer/catalog.
- compatibility result UI.
- incompatible selection confirmation.
- resume build.
- completion rules.
- E2E builder flows.

### Exit Criteria

- Build كاملة قابلة للحفظ والاسترجاع.
- كل المنتجات مرئية ومصنفة حسب compatibility.
- conflicts تظهر فورًا.
- reload لا يفقد build.


## Phase M10 - Purchase Plan, Scheduling, Hardening

### الهدف

إكمال الـMVP القابل للعرض وتشغيل تحديثات دورية آمنة.

### Tasks

- purchase plan API/UI.
- last checked/stale messages.
- scheduled worker mode.
- lock heartbeat.
- operational metrics/report.
- runbooks.
- deployment containers.
- staging deployment.
- full regression.
- README architecture/demo.
- seed/demo data fallback.

### Exit Criteria

- رحلة end-to-end تعمل من scrape إلى Sigma link.
- scheduler failure لا يفسد catalog.
- staging يمكن إعادة نشرها من الصفر.
- documentation كافية لمطور جديد.


## Phase M11 - Second Store (P1/P2)

لا تبدأ قبل M10.

### Tasks

- new adapter package.
- source-specific label mappings.
- cross-store matching review.
- multiple offers UI.
- price comparison.
- purchase plan grouping.

### Exit Criteria

- لا شروط store-specific في domain/API.
- نفس product يعرض offers متعددة.
- checkout remains separate.


# 34. Recommended First Issues

1. `M0-001` Initialize npm workspace and root scripts.
2. `M0-002` Create Angular standalone app.
3. `M0-003` Create Express API and health endpoints.
4. `M0-004` Create Worker CLI skeleton.
5. `M0-005` Add Mongo client and Docker Compose.
6. `M0-006` Add Pino and correlation IDs.
7. `M0-007` Add CI lint/typecheck/test/build.
8. `M1-001` Document Sigma category seeds.
9. `M1-002` Capture representative HTML fixtures.
10. `M1-003` Build raw spec label inventory.
11. `M1-004` Write Sigma product-page parser spike.
12. `M1-005` Decide Playwright fallback routes.

كل Issue تحتوي:

- PRD requirement IDs.
- TDD section.
- acceptance criteria.
- tests required.
- out-of-scope note.


# 35. Coding Standards

## 35.1 TypeScript

- `strict: true`.
- no implicit any.
- prefer `unknown` over `any`.
- parse external data at boundary.
- exhaustive switch with `never`.
- domain enums as string unions أو const objects.
- no direct `process.env` outside config.

## 35.2 Error Handling

- Domain errors typed.
- Infrastructure errors wrapped with cause.
- no empty catch.
- expected parsing failures return Result، لا throw per field.
- logs once at boundary، لا duplicate logging عبر layers.

## 35.3 Functions

- parsers pure قدر الإمكان.
- rules pure.
- repositories side-effect boundary.
- clock injectable في time-sensitive tests.

## 35.4 Commits and Branches

- small commits.
- Conventional Commits optional but recommended.
- issue ID in PR.
- no generated raw crawl dumps in Git.


# 36. ADR Backlog

| ADR | القرار |
| --- | --- |
| ADR-001 | Modular monorepo بدل microservices/Nx. |
| ADR-002 | HTTP-first Crawlee + Playwright fallback. |
| ADR-003 | Raw snapshots immutable وفصل listing/product/offer. |
| ADR-004 | MongoDB Node Driver + Zod بدل ODM. |
| ADR-005 | Typed compatibility rules بدل dynamic DSL. |
| ADR-006 | Local precomputed search terms قبل Atlas Search. |
| ADR-007 | Redirect commerce وعدم تنفيذ checkout. |
| ADR-008 | Bundles catalog-only. |
| ADR-009 | Guest build optimistic concurrency. |
| ADR-010 | CLI/scheduler Worker وعدم trigger scraping من API. |

كل ADR تحتوي Context, Decision, Alternatives, Consequences.


# 37. Definition of Done

Feature لا تعتبر Done إلا إذا:

- Requirement/Issue acceptance criteria تحققت.
- types/contracts updated.
- unit tests موجودة للأعمال المنطقية.
- integration test إذا تغير persistence/API.
- error/empty/loading paths معالجة.
- logs مناسبة دون بيانات حساسة.
- documentation/ADR updated إن تغير design.
- no new lint/type errors.
- PR reviewed أو self-review checklist مكتملة.
- screenshots/demo evidence للـUI عند الحاجة.

Phase لا تعتبر Done إلا عند تحقق Exit Criteria الخاصة بها.


# 38. Final MVP Acceptance Scenario

يجب أن ينجح السيناريو التالي من البداية للنهاية:

1. المشغل يشغل Sigma Full Worker.
2. الـWorker يكتشف كل صفحات الفئات والمنتجات.
3. Raw snapshots تُحفظ مع Run report.
4. البيانات تُصنف وتُطبع Normalization report.
5. المنتجات تُطابق أو تدخل Review.
6. Catalog وOffers تُنشر دون حذف البيانات السابقة عند failure.
7. المستخدم يفتح الواجهة ويبحث عن موديل محدد.
8. يستخدم filters ويرى كل المنتجات، ومنها الناقص والBundles.
9. يفتح صفحة منتج ويرى canonical + raw specs والسعر والتحديث.
10. ينشئ Build ويختار CPU.
11. يرى Motherboards مصنفة Compatible/Warning/Unknown/Incompatible.
12. يختار RAM غير متوافقة فيظهر Error واضح مع Evidence.
13. يصحح الاختيار ويكمل PSU/Case/Cooler/Storage/GPU.
14. تظهر نتيجة Build النهائية وتحذيراتها.
15. تظهر Shopping List وإجمالي السعر المرصود وروابط Sigma.
16. المستخدم ينتقل إلى Sigma لإتمام الشراء خارج المنصة.


# 39. Open Technical Decisions - غير مانعة للبدء

هذه الأسئلة لا تمنع M0/M1، وتُحسم بالبيانات:

1. هل Sigma يحتاج Playwright لأي Variant pages؟
2. هل نخزن raw HTML في filesystem فقط أم object storage عند النشر؟
3. هل Basic search يحقق الجودة المطلوبة أم نضيف Atlas Search في P1؟
4. ما critical fields الفعلية المتاحة بنسبة جيدة لكل Category؟
5. هل CPU support reference data تحتاج Admin maintenance مبكرًا؟
6. هل build expiry مطلوب في Demo أم نحتفظ بها بلا حذف؟
7. هل نفس Sigma product يظهر external IDs مختلفة في اللغتين؟

تُسجل الإجابات في ADR أو Data Discovery report.


# 40. Official Technical References

- Angular releases and supported versions: `https://angular.dev/reference/releases`
- Angular version compatibility: `https://angular.dev/reference/versions`
- Node.js release status: `https://nodejs.org/en/about/previous-releases`
- MongoDB documentation and release notes: `https://www.mongodb.com/docs/manual/release-notes/`
- Crawlee JavaScript documentation: `https://crawlee.dev/js/docs/`
- Crawlee crawler selection: `https://crawlee.dev/js/docs/quick-start`
- MongoDB atomicity: `https://www.mongodb.com/docs/manual/core/write-operations-atomicity/`
- MongoDB schema validation: `https://www.mongodb.com/docs/manual/core/schema-validation/`


# Appendix A - Core Enums

```ts
export type StoreCode = 'SIGMA';

export type AvailabilityStatus =
  | 'IN_STOCK'
  | 'OUT_OF_STOCK'
  | 'PREORDER'
  | 'UNKNOWN';

export type PriceType =
  | 'FIXED'
  | 'FROM'
  | 'RANGE'
  | 'UNAVAILABLE';

export type BuildEligibility =
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'CONDITIONAL';

export type DataFieldQuality =
  | 'EXACT'
  | 'NORMALIZED'
  | 'INFERRED'
  | 'MISSING'
  | 'CONFLICTING';
```

# Appendix B - Initial Index Checklist

```text
stores:
  code unique

scrape_runs:
  storeCode + startedAt desc
  status + startedAt desc

raw_product_snapshots:
  storeCode + externalId + fetchedAt desc
  scrapeRunId
  contentSha256

store_listings:
  storeCode + externalId unique
  classifiedCategory + processing.state
  catalogProductId

catalog_products:
  identity.canonicalKey
  identity.mpn
  category + status + pricing.minCurrentPrice
  category + identity.brand
  search.tokens
  search.compactTerms
  search.prefixes

offers:
  storeCode + externalId unique
  productId + status
  status + lastSeenAt

price_events:
  offerId + detectedAt desc
  productId + detectedAt desc

product_identity_aliases:
  storeCode + externalId unique
  productId

match_reviews:
  status + createdAt

builds:
  publicId unique
  expiresAt TTL optional

worker_locks:
  key unique
  expiresAt TTL
```

# Appendix C - Root Scripts

```json
{
  "scripts": {
    "dev": "run-p dev:api dev:web",
    "dev:web": "npm --workspace apps/web run start",
    "dev:api": "npm --workspace apps/api run dev",
    "worker": "npm --workspace apps/worker run cli --",
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "db:indexes": "tsx scripts/create-indexes.ts",
    "db:seed-reference": "tsx scripts/seed-reference-data.ts"
  }
}
```

# Appendix D - Pull Request Checklist

```text
[ ] Linked issue and requirement IDs
[ ] No scope outside current phase
[ ] Types and validation updated
[ ] Unit tests added/updated
[ ] Integration/E2E test where required
[ ] Error and empty states handled
[ ] No direct app-to-app dependency
[ ] No store-specific logic in canonical domain
[ ] No scraping in API
[ ] Index/query impact reviewed
[ ] Logs do not expose raw HTML/secrets
[ ] Documentation/ADR updated
```

# Appendix E - Data Discovery Checklist

```text
For each Sigma category:
[ ] Seed URL
[ ] Pagination style
[ ] Product card selector
[ ] Product URL shape
[ ] External ID source
[ ] Price states
[ ] Availability states
[ ] Breadcrumbs
[ ] Specification layout
[ ] Image layout
[ ] Missing specification example
[ ] Discount example
[ ] Out-of-stock example
[ ] Bundle/prebuilt confusion risk
[ ] Fixture saved
[ ] Parser test written
```
