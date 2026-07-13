# ADR-000: Project Foundation Decisions

**Project:** PC Hardware Egypt  
**Status:** Accepted  
**Decision Date:** 12 July 2026  
**Scope:** M0 — Repository Foundation  
**Owner:** Nour Eldeen Mahmoud  

---

## 1. Purpose

الملف ده بيثبت القرارات التقنية الأساسية اللي هنبدأ بيها المشروع، علشان التنفيذ مايتعطلش كل شوية بسبب تغيير الأدوات أو إعادة التفكير في نفس الاختيارات.

القرارات هنا تخص مرحلة التأسيس `M0`، وبعضها هيفضل ثابت خلال المشروع كله.

القاعدة الأساسية:

> نستخدم أبسط اختيار يحقق المطلوب بشكل منظم وقابل للتوسع، من غير تعقيد Production مش محتاجينه في الـMVP.

---

## 2. Project Context

المشروع عبارة عن منصة متخصصة في قطع الكمبيوتر داخل السوق المصري، وتبدأ بمتجر Sigma فقط.

المشروع يحتوي على:

- Angular Web Application.
- Express REST API.
- Worker منفصل للـScraping ومعالجة البيانات.
- MongoDB لتخزين البيانات الخام والمنظمة.
- PC Builder.
- Compatibility Engine.
- Search and Filtering.
- Admin Data Operations Dashboard.

### أهم قيد معماري

الـAPI لا يقوم بأي Scraping.

```text
Sigma Website
     ↓
Worker
     ↓
MongoDB
     ↓
Express API
     ↓
Angular Web
```

---

# 3. Accepted Technical Decisions

## ADR-000.1 — Repository Strategy

### Decision

استخدام **Nx Monorepo** لإدارة المشروع.

### Structure

```text
pc-hardware-eg/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── packages/
├── fixtures/
├── docs/
└── scripts/
```

### Why

المشروع يحتوي على ثلاثة Applications ومجموعة Packages مشتركة، وNx يوفر:

- إدارة التطبيقات والحزم من Repository واحدة.
- أوامر Build وTest وLint موحدة.
- Dependency boundaries.
- تشغيل المشاريع المتأثرة فقط لاحقًا.
- تنظيم جيد للمشروع دون الحاجة إلى Microservices.

### Rejected Alternatives

- Repositories منفصلة لكل Application: تعقيد غير ضروري حاليًا.
- npm workspaces بدون Nx: ممكن، لكن Nx أنسب للهيكل الحالي ووجود `project.json`.

### Consequence

لازم نحافظ على حدود واضحة بين التطبيقات والحزم، وما نخليش أي Package تستورد من Package أعلى منها بشكل عشوائي.

---

## ADR-000.2 — Package Manager

### Decision

استخدام **npm**.

### Why

- موجود افتراضيًا مع Node.js.
- أبسط في التعلم والتشغيل.
- مناسب للـNx والـWorkspaces.
- لا يوجد احتياج حقيقي لـpnpm أو Yarn في الـMVP.

### Rule

يتم Commit لملف واحد فقط:

```text
package-lock.json
```

ولا يتم استخدام أكثر من Package Manager داخل المشروع.

---

## ADR-000.3 — Runtime and Language

### Decision

- Node.js Active LTS وقت بدء التنفيذ.
- TypeScript لكل الـBackend والـWorker والـPackages.
- TypeScript Strict Mode.
- ES Modules.

### Why

- توحيد اللغة بين Angular والـAPI والـWorker.
- مشاركة Types بسهولة.
- اكتشاف الأخطاء مبكرًا.
- تحسين قابلية الصيانة.

### Required Compiler Options

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true
}
```

### Rule

لا يتم استخدام `any` إلا في حالات محدودة جدًا ومع تعليق يوضح السبب.

---

## ADR-000.4 — Frontend Framework

### Decision

استخدام **Angular** للـWeb Application.

### Architecture

Feature-based architecture:

```text
apps/web/src/app/
├── core/
├── shared/
└── features/
```

### Why

- مناسب للـMEAN learning target.
- قوي في Reactive Forms.
- مناسب للـCatalog Filters والـPC Builder.
- يوفر Routing وHTTP وDependency Injection بشكل منظم.

### M0 Scope

في مرحلة M0 يتم إنشاء:

- App shell.
- Main routing.
- Basic layout.
- API configuration.
- Placeholder pages فقط.

لا يتم تنفيذ UI نهائي في M0.

---

## ADR-000.5 — Backend Framework

### Decision

استخدام **Express + TypeScript**.

### Why

- بسيط ومباشر.
- مناسب لتعلم MEAN بدون إخفاء التفاصيل.
- يسمح ببناء Modular Monolith واضح.
- لا يوجد احتياج حاليًا لـNestJS.

### API Architecture

```text
apps/api/src/
├── bootstrap/
├── middleware/
├── modules/
└── app.ts
```

كل Module يحتوي على:

```text
controller
service
repository
routes
schemas
mapper
```

### Rule

- Controller يتعامل مع HTTP فقط.
- Service يحتوي Use Cases.
- Repository يتعامل مع MongoDB.
- Mapper يحول Database Documents إلى DTOs.

---

## ADR-000.6 — Database

### Decision

استخدام **MongoDB**.

### Why

مواصفات قطع الكمبيوتر تختلف حسب نوع المنتج:

- CPU له Cores وSocket.
- GPU له VRAM وLength.
- PSU له Wattage وEfficiency.
- Case له Clearances وForm Factor support.

MongoDB مناسب لتخزين Base Product ثابت مع `specs` مختلفة حسب الـCategory.

### Important Rule

MongoDB لن تُستخدم كقاعدة بدون قواعد.

سيتم استخدام:

- Application validation.
- Category-specific schemas.
- Explicit indexes.
- Controlled enums.
- Data quality flags.

---

## ADR-000.7 — MongoDB Access Layer

### Decision

استخدام **Mongoose** للتعامل مع MongoDB.

### Why

- Schemas واضحة.
- Index definitions.
- Middleware عند الحاجة.
- مناسب للمشروع ومستوى التعلم الحالي.
- يسهل بناء Repositories منظمة.

### Additional Validation

استخدام **Zod** في:

- API request validation.
- Environment variables.
- Worker command input.
- Normalization outputs.
- DTO validation عند الحدود المهمة.

### Rule

Mongoose Models تظل داخل:

```text
packages/database
```

ولا يتم إرسالها مباشرة للـFrontend.

---

## ADR-000.8 — Application Separation

### Decision

المشروع يحتوي على ثلاثة Runtime Applications مستقلة:

```text
apps/web
apps/api
apps/worker
```

### Responsibilities

#### Web

- UI only.
- Calls the REST API.
- Does not access MongoDB.
- Does not scrape stores.

#### API

- Serves published data.
- Handles Catalog, Builds, Admin reads/actions.
- Does not contact Sigma.
- Does not parse HTML.

#### Worker

- Discovers store products.
- Fetches pages.
- Saves raw snapshots.
- Runs normalization.
- Runs product matching.
- Publishes catalog products and offers.

### Rule

أي كود خاص بسيجما ممنوع يكون داخل الـAPI أو الـWeb.

---

## ADR-000.9 — Worker Execution Model

### Decision

الـWorker يبدأ بنظام **CLI-first**.

### Example Commands

```bash
npm run worker -- health
npm run worker -- sigma:discover
npm run worker -- sigma:fetch
npm run worker -- normalize
npm run worker -- match
npm run worker -- publish
npm run worker -- sigma:full
```

### Why

- أسهل في التطوير والاختبار.
- لا يحتاج Queue أو Redis.
- يسمح بتشغيل كل مرحلة منفصلة.
- مناسب للـMVP غير الإنتاجي.

### Scheduling

يتم إضافة Schedule بعد نجاح التشغيل اليدوي.

الـScheduler يستدعي نفس Commands ولا يحتوي Business Logic منفصل.

---

## ADR-000.10 — Scraping Strategy

### Decision

استخدام **HTTP-first scraping**.

### Primary Approach

- Crawlee CheerioCrawler أو HTTP fetch مع Cheerio.
- HTML parsing بدون Browser كامل.

### Fallback

استخدام Playwright فقط عندما:

- البيانات غير موجودة في HTML response.
- الصفحة تعتمد على JavaScript execution.
- نحتاج فحص Network requests أثناء Data Discovery.

### Why

- أسرع.
- أخف.
- أسهل في الاختبار باستخدام Fixtures.
- صفحات Sigma الحالية تسمح مبدئيًا بالبدء من HTML.

### Rule

كل Store له Adapter خاص:

```text
packages/sigma-adapter
```

وعند إضافة متجر جديد:

```text
packages/new-store-adapter
```

لا يتم إنشاء Universal Scraper مليء بـ`if` statements.

---

## ADR-000.11 — Raw-First Data Ingestion

### Decision

حفظ البيانات الخام قبل الـNormalization.

### Pipeline

```text
Discover
→ Fetch
→ Save Raw Snapshot
→ Classify
→ Normalize
→ Validate
→ Match
→ Publish
```

### Why

- يمكن تحسين الـNormalizer بدون إعادة Scraping.
- يمكن تتبع مصدر أي خطأ.
- يمكن مقارنة Parser versions.
- يمكن الاحتفاظ بتاريخ ما جاء من المتجر.

### Rule

Raw snapshots لا يتم تعديلها يدويًا.

أي تصحيح يتم باستخدام:

- Normalized data.
- Manual override.
- Mapping.
- Canonical product data.

---

## ADR-000.12 — Logging

### Decision

استخدام **Pino** للـStructured Logging.

### Required Context

Logs الخاصة بالـAPI قد تحتوي على:

```text
requestId
method
path
statusCode
durationMs
```

Logs الخاصة بالـWorker قد تحتوي على:

```text
scrapeRunId
storeCode
command
sourceUrl
externalId
parserVersion
errorCode
```

### Rule

`console.log` غير مسموح في الكود النهائي إلا في CLI output بسيط ومقصود.

---

## ADR-000.13 — Environment Configuration

### Decision

استخدام Environment Variables يتم التحقق منها باستخدام Zod.

### Example

```text
NODE_ENV
MONGO_URI
API_PORT
LOG_LEVEL
SIGMA_REQUEST_DELAY_MS
SIGMA_MAX_CONCURRENCY
```

### Rule

- التطبيق يفشل عند التشغيل إذا كان Config ضروري ناقصًا.
- لا يتم Commit لأي Secrets.
- يتم توفير ملف:

```text
.env.example
```

---

## ADR-000.14 — Testing

### Decision

استخدام **Vitest** كـTest Runner رئيسي.

### Test Types

#### Unit Tests

- Text normalization.
- Unit conversion.
- Product matching scoring.
- Compatibility rules.

#### Fixture Tests

- Sigma category parser.
- Sigma product parser.
- Discounted product.
- Out-of-stock product.
- Bundle product.
- Missing specifications.

#### API Integration Tests

- Express routes.
- Validation.
- Repositories.
- MongoDB integration.

#### E2E Tests

تتم إضافتها لاحقًا للـCritical user flows باستخدام Playwright.

### Additional Tool

استخدام Supertest لاختبار Express API.

---

## ADR-000.15 — Local Infrastructure

### Decision

 ~~使用 Docker Compose لتشغيل **MongoDB فقط** في M0.~~ **Superseded by ADR-001:** MongoDB Atlas is the default development database. Docker is not required.

### Not Included in M0

- Redis.
- Kafka.
- RabbitMQ.
- Elasticsearch.
- Kubernetes.

### Why

لا يوجد احتياج حقيقي لهذه الأدوات في الـMVP.

---

## ADR-000.16 — Search Strategy

### Decision

القرار التفصيلي للـSearch مؤجل حتى نحلل بيانات Sigma، لكن البداية تكون باستخدام MongoDB queries وindexes.

### M0 Decision

لا يتم إضافة Elasticsearch أو Search service منفصلة.

### Later Options

- MongoDB indexes and aggregation.
- MongoDB Atlas Search إذا احتجنا autocomplete وfuzzy search بشكل أفضل.

### Selection Point

يتم حسم الاختيار النهائي خلال مرحلة Catalog Search بعد معرفة:

- عدد المنتجات.
- شكل أسماء المنتجات.
- جودة الـMPN والـModel fields.
- احتياجات الـAutocomplete.

---

## ADR-000.17 — Compatibility Engine

### Decision

قواعد التوافق تكون **Typed Code Rules** وليست Expressions نصية داخل قاعدة البيانات.

### Example

```ts
interface CompatibilityRule {
  code: string;
  evaluate(context: BuildContext): CompatibilityResult[];
}
```

### Why

- Type safety.
- سهولة الاختبار.
- Debugging أوضح.
- منع تنفيذ Expressions غير آمنة.

### Result States

```text
PASS
ERROR
WARNING
UNKNOWN
INFO
```

### Important Rule

غياب البيانات ينتج `UNKNOWN`، وليس `PASS`.

---

## ADR-000.18 — Product Matching

### Decision

المطابقة تعتمد على Identifiers أولًا ثم Fingerprints وManual Review.

### Priority

```text
GTIN
→ Brand + MPN
→ Brand + Exact Model
→ Category Fingerprint
→ Manual Review
```

### Rule

السعر لا يستخدم كهوية للمنتج.

Hard contradictions تمنع الدمج التلقائي، مثل:

- DDR4 مقابل DDR5.
- 16GB مقابل 32GB.
- RTX Ti مقابل non-Ti.
- 650W مقابل 750W.

---

## ADR-000.19 — Bundles

### Decision

Bundles تعامل كمنتج واحد.

```text
productKind = BUNDLE
buildEligibility = NOT_ELIGIBLE
```

### Behavior

- تظهر في الـCatalog.
- تظهر بكل بياناتها.
- يمكن فتح رابطها على Sigma.
- لا تدخل في PC Builder.
- لا يتم تفكيكها تلقائيًا إلى Components.

---

## ADR-000.20 — Payments and Checkout

### Decision

لا يوجد دفع أو Checkout داخل المشروع في الـMVP.

### User Flow

```text
Build Summary
→ Purchase Plan
→ Product Links
→ Sigma Checkout
```

### Terminology

نستخدم:

```text
Purchase Plan
Build Shopping List
```

ولا نستخدم `Real Cart` أو `Checkout` داخل المنصة.

### Reason

المتجر مسؤول عن:

- السعر النهائي.
- المخزون.
- الشحن.
- الدفع.
- الطلب.
- الاسترجاع.

---

## ADR-000.21 — Authentication

### Decision

Authentication الكاملة خارج M0.

### M0

- لا يوجد User authentication.
- لا يوجد Roles system.

### Admin During Early Development

Admin endpoints إما:

- غير منشورة خارج بيئة التطوير.
- أو محمية لاحقًا بـAdmin token بسيط قبل أي Deployment عام.

### Future

يتم تصميم Authentication عندما نحتاج:

- Saved builds مرتبطة بمستخدم.
- Admin access على Deployment عام.

---

## ADR-000.22 — CI

### Decision

استخدام GitHub Actions.

### Pipeline

على كل Pull Request:

```text
Install
→ Lint
→ Test
→ Build
```

### Rule

لا يتم Merge إذا فشلت خطوة أساسية.

---

## ADR-000.23 — Formatting and Code Quality

### Decision

- ESLint.
- Prettier.
- TypeScript strict checks.
- Nx dependency boundaries.

### Naming

- Files: `kebab-case`.
- Classes/Types: `PascalCase`.
- Variables/Functions: `camelCase`.
- Constants: حسب الاستخدام، وتجنب ALL_CAPS إلا للقيم الثابتة العامة.

### Rule

لا يتم وضع Business Logic داخل:

- Express routes.
- Angular templates.
- Mongoose model hooks بشكل يصعب اختباره.

---

# 4. Dependency Boundaries

## Allowed Dependencies

```text
web
├── contracts
├── domain
└── config

api
├── contracts
├── domain
├── database
├── compatibility-engine
├── search
├── observability
└── config

worker
├── domain
├── database
├── scraping-core
├── sigma-adapter
├── normalization
├── product-matching
├── observability
└── config
```

## Forbidden Dependencies

- `web` لا يعتمد على `database`.
- `web` لا يعتمد على `sigma-adapter`.
- `api` لا يعتمد على `sigma-adapter`.
- `api` لا يعتمد على `scraping-core`.
- `domain` لا يعتمد على Express أو Angular أو Mongoose.
- `compatibility-engine` لا يعتمد على Express أو Angular.
- `sigma-adapter` لا يحتوي UI أو API logic.

---

# 5. Packages Created During M0

يتم إنشاء الحزم التالية فقط:

```text
packages/domain
packages/contracts
packages/database
packages/config
packages/observability
packages/test-support
```

## Packages Deferred Until Needed

```text
packages/scraping-core
packages/sigma-adapter
packages/normalization
packages/product-matching
packages/compatibility-engine
packages/search
```

الهدف عدم إنشاء Packages فارغة كثيرة من أول Commit.

---

# 6. M0 Required Deliverables

## Repository

- Git repository initialized.
- Nx workspace initialized.
- npm configured.
- Root scripts available.

## Applications

```text
apps/web
apps/api
apps/worker
```

## Web

- Angular app runs.
- Main routes exist as placeholders:

```text
/catalog
/products/:productId
/builder
/purchase-plan
/admin
```

- Basic layout.
- API base URL configuration.
- Simple health status display.

## API

- Express app runs.
- Global error handler.
- Request ID middleware.
- Request logging.
- Health endpoint:

```http
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## Worker

- Worker CLI runs.
- Health command exists:

```bash
npm run worker -- health
```

The command validates:

- Environment configuration.
- Logger initialization.
- MongoDB connection.
- Graceful connection close.

## Database

- MongoDB Atlas is the development database (ADR-001).
- API connects successfully.
- Worker connects successfully.

## Quality

- Lint command works.
- Test command works.
- Build command works.
- Format command works.
- CI works.

## Documentation

- `README.md`.
- `.env.example`.
- This ADR file.
- Links to PRD and TDD.

---

# 7. Root Commands Required

يجب توفير أوامر شبيهة بالآتي:

```bash
npm run dev
npm run dev:web
npm run dev:api
npm run dev:worker
npm run build
npm run test
npm run lint
npm run format
npm run worker -- health
```

الأسماء النهائية يمكن تعديلها أثناء إنشاء Nx workspace، لكن يجب أن يكون التشغيل واضحًا من Root.

---

# 8. M0 Exit Criteria

لا ننتقل إلى M1 إلا إذا تحقق كل الآتي:

- [ ] Nx monorepo يعمل.
- [ ] `web`, `api`, `worker` تعمل كتطبيقات مستقلة.
- [ ] جميع التطبيقات تستخدم TypeScript strict mode.
- [ ] MongoDB Atlas is configured and accessible.
- [ ] الـAPI متصل بـMongoDB.
- [ ] الـWorker متصل بـMongoDB.
- [ ] `GET /api/health` يعمل.
- [ ] Angular يستطيع استدعاء Health endpoint.
- [ ] Worker health command يعمل.
- [ ] Environment validation تعمل.
- [ ] Structured logging يعمل.
- [ ] Lint يعمل من Root.
- [ ] Tests تعمل من Root.
- [ ] Build يعمل من Root.
- [ ] GitHub Actions pipeline ناجحة.
- [ ] README يشرح طريقة التشغيل.
- [ ] لا يوجد Scraping code في M0.

---

# 9. Decisions Deferred to Later Phases

القرارات التالية لا تعطل M0:

## M1 / M2

- Sigma selectors النهائية.
- Pagination strategy النهائية.
- Rate limit values بعد اختبار الموقع.
- HTML snapshot storage format النهائي.

## M3

- جميع Specification aliases.
- Data quality scoring formula.
- Category confidence thresholds.

## M4 / M5

- MongoDB basic search مقابل Atlas Search.
- Facet implementation details.
- Search ranking weights.

## M6

- Product matching score thresholds النهائية.
- Auto-match confidence threshold.

## M7 / M8

- جميع Compatibility rule thresholds.
- Recommendation ranking weights.
- PSU headroom percentage النهائي.

## Later

- Deployment provider.
- Full authentication.
- User accounts.
- Redis or job queue.
- Additional stores.
- Multi-store optimization.

---

# 10. Non-Technical Product Decisions Already Fixed

القرارات التالية تم تثبيتها بناءً على رؤية المشروع:

- يبدأ المشروع بمتجر Sigma فقط.
- جميع قطع PC Hardware المتاحة يتم جمعها.
- جميع المنتجات الصحيحة تظهر في الـCatalog.
- نقص بيانات التوافق لا يخفي المنتج.
- Bundles تظهر ولكن لا تدخل الـBuilder.
- المستخدم يمكنه اختيار أي قطعة داخل الـBuilder.
- المنتجات غير المتوافقة تظهر مع السبب ولا يتم إخفاؤها بالكامل.
- لا يوجد دفع داخل المشروع.
- المستخدم ينتقل إلى صفحة المنتج على Sigma.
- المشروع Portfolio MVP وليس Production marketplace.

---

# 11. Change Policy

إذا احتجنا تغيير قرار داخل الملف:

1. لا نحذف القرار القديم بصمت.
2. ننشئ ADR جديدًا مثل:

```text
ADR-005-replace-mongoose-with-native-driver.md
```

3. نوضح:

- سبب التغيير.
- البدائل.
- تأثير القرار.
- خطوات الـMigration.

الهدف أن يظل تاريخ القرارات واضحًا.

---

# 12. Next Step After This ADR

الخطوة التالية هي تنفيذ:

```text
M0 — Repository Foundation
```

وبعد اكتمال Exit Criteria ننتقل إلى:

```text
M1 — Sigma Data Discovery
```

في M1 يتم:

- جمع عينة من صفحات Sigma.
- حفظ HTML fixtures.
- حصر Categories.
- تحليل Product page structure.
- إنشاء Data Dictionary أولي.
- تحديد الحقول المتاحة فعليًا قبل كتابة Full Scraper.

---

# 13. Final Decision Summary

```text
Monorepo: Nx
Package Manager: npm
Frontend: Angular
Backend: Express + TypeScript
Database: MongoDB + Mongoose
Validation: Zod
Worker: Separate CLI-first Node application
Scraping: HTTP/Cheerio first, Playwright fallback
Logging: Pino
Testing: Vitest + Supertest
Local Infrastructure: MongoDB Atlas (ADR-001)
CI: GitHub Actions
Architecture: Modular Monolith + Separate Worker
Payment: External store redirect only
Bundles: Catalog only, not build-eligible
```

هذا الملف معتمد كأساس تنفيذ مرحلة M0.
