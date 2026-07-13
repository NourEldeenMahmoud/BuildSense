# وثيقة متطلبات المنتج (PRD)

**منصة تجميع قطع الكمبيوتر ومحرك التوافق للسوق المصري**  
PC Hardware Aggregator & Compatibility Engine — Sigma First

| الحقل        | القيمة                                                 |
| ------------ | ------------------------------------------------------ |
| الإصدار      | 1.0                                                    |
| الحالة       | Baseline معتمد للتنفيذ                                 |
| مالك الوثيقة | Nour Eldeen Mahmoud                                    |
| التاريخ      | 12 يوليو 2026                                          |
| النطاق       | ا MVP بمتجر Sigma فقط، مع تصميم قابل لإضافة متاجر أخرى |

## 0. التحكم في الوثيقة وطريقة استخدامها

### 0.1 سجل الإصدارات

| الإصدار | التاريخ | النوع | ملخص التغيير |
| --- | --- | --- | --- |
| 1.0 | 12 يوليو 2026 | Baseline أول كامل | تثبيت نطاق Sigma-first، وكتابة متطلبات المنتج والبيانات والتوافق والـAPI والاختبارات. |

### 0.2 جمهور الوثيقة

- مالك المنتج والمطور الرئيسي.
- أي مطور Frontend أو Backend أو Data/Scraping ينضم لاحقًا.
- المراجع التقني أو الـInterviewer الذي يريد فهم القرارات الهندسية.
- الشخص المسؤول عن مراجعة جودة البيانات أو قواعد التوافق.

### 0.3 كيف تُستخدم الوثيقة

- **مرجع للنطاق: **أي Feature غير موجودة في قسم نطاق الـMVP لا تُنفذ قبل تحديث الوثيقة.
- **مرجع للـBacklog: **كل Requirement يحمل ID ثابتًا يمكن استخدامه في Issues وCommits والاختبارات.
- **مرجع للبيانات: **الـCanonical schemas وقواعد الـNormalization هي المصدر الأساسي لأسماء الحقول والقيم.
- **مرجع للتوافق: **Rule Catalog يحدد متى تكون النتيجة PASS أو ERROR أو WARNING أو UNKNOWN أو INFO.
- **مرجع للقبول: **لا تعتبر أي Epic مكتملة قبل تحقيق Acceptance Criteria وDefinition of Done.

> **قاعدة تغيير النطاق:** أي تعديل جوهري في مصادر البيانات، طريقة الدفع، معنى التوافق، أو المنتجات المؤهلة للـBuilder يجب أن يُسجل في Decision Log ويصدر كتحديث للـPRD.

### 0.4 محتويات الوثيقة

- 1. الملخص التنفيذي
- 2. الرؤية ومشكلة المنتج
- 3. الأهداف والمبادئ
- 4. المستخدمون وأصحاب المصلحة
- 5. نطاق الـMVP وما هو خارج النطاق
- 6. تصنيف المنتجات
- 7. رحلات المستخدم
- 8. المتطلبات الوظيفية
- 9. نظام الـScraping وجمع البيانات
- 10. الـNormalization وجودة البيانات
- 11. Product Matching والهوية
- 12. PC Builder
- 13. Compatibility Engine
- 14. البحث والفلترة
- 15. الشراء والدفع والتوجيه للمتجر
- 16. التعامل مع Bundles
- 17. نموذج البيانات
- 18. تصميم الـAPI
- 19. تطبيق Angular
- 20. المعمارية والتنظيم البرمجي
- 21. الحالات ودورات الحياة
- 22. المتطلبات غير الوظيفية
- 23. الأمان والاستخدام المسؤول
- 24. الاختبارات وضمان الجودة
- 25. الرصد وعمليات التشغيل
- 26. القياسات ومعايير النجاح
- 27. معايير القبول
- 28. خطة التنفيذ
- 29. المخاطر والمعالجات
- 30. القرارات والأسئلة المؤجلة
- 31. الملحقات والمراجع

## 1. الملخص التنفيذي

المنتج منصة متخصصة في قطع الكمبيوتر داخل السوق المصري. تجمع بيانات جميع منتجات الهاردوير المتاحة في متجر Sigma Computer، تنظفها وتوحّدها، ثم تعرضها في كتالوج قابل للبحث والفلترة. يستطيع المستخدم فتح صفحة كل منتج على المتجر الأصلي، أو تكوين تجميعة PC ومراجعة التوافق والمشكلات والمعلومات الناقصة قبل الشراء.

الـMVP ليس متجرًا إلكترونيًا ولا Marketplace، ولا ينفذ الدفع أو الشحن أو حجز المخزون. المنصة تعمل كطبقة اكتشاف وفهم واتخاذ قرار، بينما تتم عملية الشراء النهائية داخل المتاجر الاخري.

القيمة التقنية الأساسية ليست في عرض المنتجات فقط، بل في الـdata pipeline: جمع كل البيانات، الاحتفاظ بالنسخة الخام، تصنيف المنتجات، Normalization للمواصفات والوحدات، حل هوية المنتج، البحث بالـfacets، ثم تشغيل Compatibility Engine قابل للتفسير.

يبدأ التنفيذ بمتجر واحد حتى يكتمل الـvertical slice بالكامل. عند إضافة متجر جديد لاحقًا، يحصل كل متجر على Scraper Adapter مستقل، بينما تظل الـCanonical Product Model والـAPI والـBuilder وقواعد التوافق مشتركة.

> **قرار المنتج الأساسي:** تغطية كاملة لمنتجات PC Hardware في Sigma، بيانات قابلة للبحث والتوافق، وتجربة شراء تنتهي دائمًا في المتجر الأصلي.

## 2. الرؤية ومشكلة المنتج

### 2.1 الرؤية

أن تكون المنصة مرجعًا ذكيًا يساعد المستخدم المصري على فهم قطع الكمبيوتر المتاحة، الوصول إلى تفاصيل موحدة، وبناء تجميعة قابلة للتنفيذ مع تفسير واضح للتوافق وعدم التوافق، بدل الاعتماد على أسماء منتجات غير ثابتة ومواصفات موزعة داخل صفحات المتاجر.

### 2.2 بيان المشكلة

- صفحات المتاجر تعرض مواصفات مفيدة، لكنها غير متناسقة بين الفئات والمنتجات.
- المستخدم يحتاج إلى فتح صفحات عديدة لفهم السعر والمخزون والمواصفات.
- المستخدم المبتدئ قد يختار قطعًا غير متوافقة بسبب الـSocket أو نوع RAM أو أبعاد Case أو قدرة PSU.
- التوافق ليس Boolean بسيطًا؛ أحيانًا توجد بيانات ناقصة، BIOS requirement، أو تشغيل ممكن مع أداء أقل.
- أسماء المنتجات قد تتغير أو تتكرر، بينما الـPart Number أو الـMPN هو الأقرب للهوية الحقيقية.
- تحويل المشروع مباشرة إلى Aggregator متعدد المتاجر سيجعل مشكلة جمع البيانات تمنع اكتمال القيمة الأساسية.

### 2.3 عرض القيمة

| المستفيد | القيمة |
| --- | --- |
| للمستخدم | كتالوج كامل، فلاتر حسب المواصفات، تفاصيل موحدة، وتجميعة مع تفسير التوافق. |
| للمطور | مشروع Portfolio يحتوي Crawling وData Quality وEntity Resolution وSearch وRule Engine. |
| لإضافة المتاجر | كل Store Adapter مستقل، بينما الـCanonical Catalog يستوعب عروضًا متعددة لاحقًا. |

## 3. الأهداف والمبادئ

### 3.1 أهداف الـMVP

- جمع كل منتجات PC Hardware ضمن نطاق Sigma المحدد، وليس عينة منتقاة.
- حفظ البيانات الخام المستخرجة قبل تنظيفها، حتى يمكن إعادة المعالجة دون إعادة الـScraping.
- تحويل المواصفات المهمة إلى Canonical fields ثابتة وقابلة للفلترة.
- عرض كل المنتجات الصالحة في الكتالوج، بما فيها المنتجات ذات البيانات الناقصة.
- توفير Search سريع مع Facets وفلاتر مختلفة لكل Category.
- تمكين المستخدم من تكوين PC Build متعدد المكونات والكميات عند الحاجة.
- تشغيل قواعد توافق قابلة للتفسير، وتجنب إعطاء PASS عندما تكون البيانات غير كافية.
- توجيه المستخدم إلى صفحة المنتج الأصلية لإتمام الشراء.
- إنشاء بنية تسمح بإضافة Store Scraper جديد دون إعادة بناء بقية النظام.

### 3.2 مبادئ التصميم

- **Raw first: **لا يتم التخلص من المصدر الخام بعد الـNormalization.
- **Truthful uncertainty: **غياب البيانات ينتج UNKNOWN، لا PASS.
- **Store-specific extraction: **كل متجر له Parser وDiscovery logic خاصان به.
- **Shared canonical domain: **كل المتاجر تتحول إلى نفس Product وOffer وSpecs models.
- **Simple before clever: **HTTP-first scraping وTyped rules قبل Browser automation أو DSL عام.
- **Explain every decision: **البحث والتوافق والمطابقة يجب أن تعرض سبب النتيجة عند الحاجة.
- **No fake commerce: **الـBuild Shopping List ليست Cart حقيقية ولا وعدًا بالمخزون أو السعر.
- **No silent data loss: **فشل الـNormalization أو التصنيف يذهب إلى Review Queue بدل حذف المنتج.

### 3.3 مؤشرات النجاح

| المؤشر | معيار النجاح |
| --- | --- |
| تغطية الاكتشاف | اكتشاف 100% من روابط المنتجات الموجودة في Seed categories وقت الـFull Run، مع تقرير بالعدد لكل فئة. |
| نجاح التحليل | تحليل 95% على الأقل من الصفحات المكتشفة دون Critical parsing error. |
| ظهور الكتالوج | كل Store Listing صالحة تظهر أو تحمل Review/Exclusion reason واضحًا. |
| جودة المواصفات | الحقول المطلوبة للتوافق متاحة أو مصنفة MISSING/UNKNOWN، دون قيم مخترعة. |
| التوافق | كل Build يعيد Summary ونتائج Rules بالأسباب والأدلة والحقول الناقصة. |
| البحث | بحث الاسم/الموديل/MPN يعيد النتيجة المتوقعة ضمن النتائج الأولى. |

## 4. المستخدمون وأصحاب المصلحة

| الشخصية | الوصف | الاحتياجات الرئيسية |
| --- | --- | --- |
| P1 — مشتري مبتدئ | يريد معرفة القطع المتاحة وبناء تجميعة دون الوقوع في تعارضات واضحة. | تفسير بسيط، تحذيرات، اقتراحات، روابط شراء. |
| P2 — مستخدم خبير | يعرف الموديلات ويريد فلاتر دقيقة ومقارنة مواصفات وسعر. | MPN search، facets، raw specs، تفاصيل كاملة. |
| P3 — مستكشف أسعار | يريد الوصول السريع لمنتج معين ومعرفة سعره وحالته. | Search سريع، freshness، outbound link. |
| P4 — Data Curator/Admin | يراجع المنتجات غير المصنفة والمطابقات والحقول المتعارضة. | Queues، diff، overrides، scrape runs. |
| P5 — Developer/Operator | يشغل الـWorker ويشخص كسر الـParser. | Logs، metrics، fixtures، failed samples. |

### 4.2 أصحاب المصلحة

- **مالك المنتج/المطور: **يحدد النطاق ويراجع الـdata quality ويقبل الـmilestones.
- **Sigma Computer: **مصدر البيانات وصفحات الشراء، وليس شريكًا تجاريًا في الـMVP.
- **المستخدم النهائي: **يستخدم البيانات كأداة مساعدة ويؤكد السعر والمخزون داخل المتجر.
- **مزود MongoDB: **قاعدة البيانات والبحث إذا تم استخدام MongoDB Search/Atlas.

## 5. نطاق الـMVP وما هو خارج النطاق

### 5.1 داخل النطاق — P0

- Sigma Computer كمصدر وحيد للـMVP.
- جمع جميع منتجات PC hardware من الفئات المعتمدة، مع Pagination كاملة.
- Product catalog، categories، product details، price، availability، images كروابط مصدر، raw specifications.
- Canonical specifications للفلاتر والتوافق.
- Search، autocomplete، sorting، pagination، category-specific facets.
- PC Builder بقطع فردية فقط.
- Compatibility rules وحالات PASS/ERROR/WARNING/UNKNOWN/INFO.
- Suggestions مبنية على التوافق والمخزون والسعر واكتمال البيانات.
- Bundles كمنتج واحد catalog-only مع رابط شراء.
- Build Shopping List وروابط منفصلة إلى Sigma.
- Manual scrape، scheduled scrape بسيط، scrape runs، health checks، retry.
- Admin screens أساسية للمراجعة والتشغيل، دون نظام صلاحيات مؤسسي.

### 5.2 داخل النطاق — P1 بعد اكتمال P0

- Price history UI مع الاحتفاظ بأحداث تغير السعر والمخزون.
- Shareable builds أو حفظ builds بدون حسابات مع IDs عشوائية.
- مقارنة منتجين أو أكثر داخل نفس الفئة.
- تشغيل Playwright fallback لصفحات محددة إذا أثبتت الحاجة.
- إضافة Compumarts كمتجر ثانٍ بعد اكتمال Sigma vertical slice.
- استراتيجية Cheapest overall وSingle store عند وجود أكثر من متجر.

### 5.3 خارج النطاق

- الدفع داخل المنصة أو استقبال أموال.
- Cart متزامنة مع Sigma أو إضافة المنتجات تلقائيًا إلى Cart المتجر دون API رسمي.
- حجز المخزون أو ضمان السعر.
- إدارة الشحن والمرتجعات والضمان والفواتير.
- Marketplace onboarding أو split payments بين المتاجر.
- AI/ML recommendations أو ادعاءات أداء Gaming غير مدعومة ببيانات benchmarks.
- تفكيك Bundles إلى منتجات فردية أو إدخالها في PC Builder.
- Microservices، Kubernetes، Kafka، Redis أو Distributed queues في P0.
- حسابات مستخدمين وOAuth وإدارة أدوار معقدة.
- Mobile application.
- تغطية اللابتوبات أو الموبايلات أو الشاشات أو الـperipherals إلا إذا أضيفت لاحقًا كنطاق مستقل.

### 5.4 الافتراضات والقيود

- **لغة المصدر: **Scraping من صفحات Sigma الإنجليزية لتوحيد Labels؛ يمكن إضافة العربية لاحقًا.
- **لغة الواجهة: **English-first للـMVP مع تصميم قابل للـlocalization؛ الوثيقة عربية.
- **العملة: **EGP فقط في الـMVP.
- **الزمن الحقيقي: **الأسعار ليست real-time؛ يتم عرض last checked time.
- **المنتج غير الإنتاجي: **لا توجد SLA تجارية، لكن تُطبق قواعد سليمة للفشل والبيانات.
- **الصور: **تُعرض من source URLs مع fallback، ولا يعاد استضافتها في P0.
- **مصادر التوافق: **قواعد عامة وReference data تتم إدارتها داخل النظام؛ لا يتم Scrape لكل manufacturer في P0.

## 6. تصنيف المنتجات ونطاق القطع

### 6.1 Taxonomy الأساسية

| Category | النوع | مؤهل للـBuilder | Cardinality |
| --- | --- | --- | --- |
| CPU | قطعة بناء | نعم | واحدة |
| MOTHERBOARD | قطعة بناء | نعم | واحدة |
| GPU | قطعة بناء | نعم | صفر أو واحدة |
| RAM | قطعة بناء | نعم | واحد أو أكثر مع quantity |
| STORAGE | قطعة بناء | نعم | صفر أو أكثر |
| PSU | قطعة بناء | نعم | واحدة |
| CASE | قطعة بناء | نعم | واحدة |
| CPU_COOLER | قطعة بناء | نعم | صفر أو واحدة |
| CASE_FAN | قطعة بناء | نعم | صفر أو أكثر |
| THERMAL_COMPOUND | ملحق بناء | لا في P0 | Catalog only |
| CONTROLLER_HUB | ملحق بناء | لا في P0 | Catalog only |
| PCIE_ADDON_CARD | ملحق بناء | لا في P0 | Catalog only |
| CABLE_ADAPTER | ملحق بناء | لا في P0 | Catalog only |
| BUNDLE | حزمة | لا | يُشترى كمنتج واحد |
| PREBUILT | جهاز مكتمل | لا | Catalog only |
| OTHER_PC_COMPONENT | غير مصنف بعد | لا حتى المراجعة | Catalog/Review |

### 6.2 قواعد التصنيف

- Category seed وBreadcrumb هما أعلى إشارتين للتصنيف الأولي.
- Title وSpecification labels تستخدم لتأكيد أو تصحيح التصنيف.
- أي منتج يحتوي عدة مكونات رئيسية في Listing واحدة يصنف BUNDLE أو PREBUILT حسب الوصف.
- التصنيف لا يعتمد على Keyword منفرد إذا تعارض مع Breadcrumb أو مواصفات المنتج.
- أي Confidence منخفضة أو تعارض ينتج NEEDS_REVIEW ولا يؤدي إلى حذف المنتج.
- Admin override ينتصر على التصنيف الآلي ويُحفظ مع سبب وتاريخ.

## 7. رحلات المستخدم الرئيسية

| الرحلة | التدفق المختصر |
| --- | --- |
| J1 — اكتشاف منتج | يدخل المستخدم كلمة أو MPN → تظهر اقتراحات → يفتح النتائج → يفلتر → يفتح Product Detail → ينتقل إلى Sigma. |
| J2 — تصفح فئة | يفتح GPUs مثلًا → يرى facets المتاحة → يحدد VRAM/Brand/Price → يرتب النتائج → يراجع البيانات. |
| J3 — بناء تجميعة | ينشئ Build → يختار CPU → يرى Motherboards مجمعة حسب التوافق → يضيف RAM/GPU/PSU/Case → يراجع Summary. |
| J4 — اختيار غير متوافق | المستخدم يعرض كل المنتجات ويختار قطعة Incompatible → النظام يسمح بالاستكشاف لكن يضع Build INVALID ويمنع توصيفه كجاهز للشراء. |
| J5 — بيانات ناقصة | يختار قطعة دون GPU length مثلًا → النتيجة UNKNOWN مع الحقل المفقود، ولا يتم الادعاء بالتوافق. |
| J6 — شراء | يفتح Shopping List → يرى السعر المرصود وتاريخ التحديث → يفتح كل Product page على Sigma → يكمل الطلب خارج المنصة. |
| J7 — تشغيل الـWorker | Admin يبدأ Full Sigma Run → يراقب discovery/fetch/parse/normalize → يشاهد الأخطاء → يعتمد الـrun أو يعيد تشغيل Category. |
| J8 — مراجعة البيانات | Admin يفتح Unclassified/Match Review → يختار canonical product أو category أو override → يعاد نشر المنتج في الكتالوج. |

## 8. المتطلبات الوظيفية

الأولوية: P0 إلزامي، P1 بعد الإطلاق، P2 تحسين اختياري.

### 8.1 الكتالوج وصفحات المنتجات

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| CAT-001 | P0 | يعرض النظام جميع Catalog Products المنشورة ضمن الفئات المعتمدة. | لا توجد Listing ناجحة ومؤهلة للنشر غير قابلة للوصول من Search أو Category page. |
| CAT-002 | P0 | يعرض Product Card الاسم والصورة والفئة والسعر وحالة المخزون والمتجر وتاريخ آخر تحديث. | تظهر القيم أو حالة Unknown صريحة، ولا يعرض السعر صفرًا عند الفشل. |
| CAT-003 | P0 | تعرض صفحة المنتج جميع Raw Specifications المستخرجة بالإضافة إلى Canonical specifications. | يمكن للمستخدم رؤية كل التفاصيل المصدرية حتى لو لم تدخل في الـNormalization. |
| CAT-004 | P0 | توفر صفحة المنتج رابطًا واضحًا إلى صفحة Sigma الأصلية. | الرابط يفتح sourceUrl الصحيح في تبويب جديد مع تنبيه أن الشراء خارج المنصة. |
| CAT-005 | P0 | يعرض النظام Data Quality indicator غير مضلل. | تظهر الحقول الناقصة المهمة أو علامة Limited compatibility data. |
| CAT-006 | P0 | تعرض المنتجات Out of Stock في الكتالوج مع إمكانية فلترتها. | لا تختفي المنتجات لمجرد عدم توفرها. |
| CAT-007 | P0 | لا تظهر المنتجات المعلّمة EXCLUDED أو PARSE_FAILED في الكتالوج العام. | كل استبعاد يحمل reason ويظهر في Admin. |
| CAT-008 | P1 | يدعم مقارنة منتجات من نفس الفئة. | يمكن اختيار 2–4 منتجات وعرض الحقول canonical جنبًا إلى جنب. |

### 8.2 البحث والفلترة

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| SRCH-001 | P0 | يدعم البحث بالاسم والـBrand والـModel والـMPN والـSKU والـaliases. | البحث الدقيق عن MPN يعرض المنتج المطابق في المركز الأول. |
| SRCH-002 | P0 | يوفر Autocomplete بعد حد أدنى من الأحرف. | تظهر اقتراحات خلال زمن الهدف ولا تُرسل Requests متراكمة بسبب switchMap/debounce. |
| SRCH-003 | P0 | يدعم Fuzzy search للأخطاء البسيطة في واجهة المستخدم فقط. | خطأ حرف أو حرفين يمكن أن يعيد نتائج مناسبة دون استخدامه للـProduct Matching. |
| SRCH-004 | P0 | توفر كل Category فلاتر مناسبة لحقولها canonical. | لا تظهر فلاتر GPU داخل CPU إلا الفلاتر العامة. |
| SRCH-005 | P0 | تعيد الـAPI facets وعدد النتائج لكل قيمة. | يتحدث العدد بعد تطبيق الفلاتر الحالية. |
| SRCH-006 | P0 | تدعم النتائج sorting بالسعر والاسم والتوفر والـrelevance. | يعمل الترتيب مع pagination بصورة ثابتة. |
| SRCH-007 | P0 | تحفظ الفلاتر والاستعلام في URL query params. | إعادة تحميل الصفحة أو مشاركة الرابط تعيد نفس النتائج. |
| SRCH-008 | P0 | تعرض النتائج المنتجات ذات البيانات الناقصة إذا طابقت الاستعلام. | لا يُشترط اكتمال specs للظهور. |
| SRCH-009 | P1 | يدعم البحث داخل raw specs للعرض الاستكشافي. | يمكن العثور على قيمة غير canonical مع وسم بأنها Raw match. |

### 8.3 PC Builder

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| BLD-001 | P0 | ينشئ المستخدم Build جديدًا دون إنشاء حساب. | يحصل على buildId ويمكنه الاستمرار من نفس المتصفح. |
| BLD-002 | P0 | يدعم Slots وCardinality المحددة في Taxonomy. | لا يسمح بأكثر من CPU/Motherboard/PSU/Case، ويسمح بتعدد Storage والكميات المدعومة. |
| BLD-003 | P0 | يعرض Product picker كل المنتجات في الفئة مقسمة Compatible/Potential/Incompatible. | لا تختفي المنتجات غير المتوافقة؛ يظهر السبب بجانبها. |
| BLD-004 | P0 | يمكن للمستخدم اختيار منتج غير متوافق للاستكشاف. | يُضاف المنتج لكن Build status يصبح INVALID وتظهر Errors. |
| BLD-005 | P0 | لا يمكن إضافة Bundle أو Prebuilt أو Catalog-only item. | تعيد الـAPI 422 مع reason واضح، والـUI لا تعرض زر Add to Build. |
| BLD-006 | P0 | يعيد التحقق بعد كل إضافة أو إزالة أو تغيير quantity. | تتحدث نتائج القواعد وSummary دون إعادة تحميل الصفحة. |
| BLD-007 | P0 | يعرض السعر المرصود لكل عنصر والإجمالي الحالي. | الإجمالي يتجاهل العناصر بلا سعر ويعرض Partial total warning. |
| BLD-008 | P0 | يعرض last checked لكل Offer أو أحدث وقت موحد للتجميعة. | يمكن للمستخدم معرفة عمر البيانات. |
| BLD-009 | P0 | يسمح بحذف عنصر أو استبداله مع الحفاظ على بقية الـBuild. | لا تفقد اختيارات غير مرتبطة. |
| BLD-010 | P1 | يسمح بتسمية الـBuild وحفظه ومشاركته. | الرابط يفتح نسخة قابلة للقراءة أو duplicate حسب السياسة. |

### 8.4 Compatibility Engine

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| CMP-001 | P0 | يشغل النظام جميع القواعد المنطبقة على مكونات الـBuild الحالية. | تعيد الاستجابة قائمة RuleResults وSummary counts. |
| CMP-002 | P0 | كل RuleResult يحمل code وstatus وmessage وaffected components وevidence وmissing fields وsuggestions. | لا توجد رسالة توافق غير قابلة للتتبع إلى ruleCode. |
| CMP-003 | P0 | الحالات الرسمية هي PASS وERROR وWARNING وUNKNOWN وINFO. | لا يستخدم Boolean compatible وحده كمخرج نهائي. |
| CMP-004 | P0 | غياب حقل مطلوب ينتج UNKNOWN. | لا ينتج PASS اعتمادًا على عدم وجود دليل على التعارض. |
| CMP-005 | P0 | ERROR يجعل Build INVALID. | لا تظهر عبارة Ready to buy عند وجود Error. |
| CMP-006 | P0 | WARNING يجعل Build VALID_WITH_WARNINGS إذا لم توجد Errors أو Unknowns حرجة. | تظهر التحذيرات دون منع الاستمرار. |
| CMP-007 | P0 | UNKNOWN يظهر كـUnverified ويؤثر على Summary. | يمكن للمستخدم رؤية الحقول التي تمنع الحكم. |
| CMP-008 | P0 | تستخدم القواعد Typed evaluators داخل الكود، وليس expressions نصية قابلة للتنفيذ من DB. | كل rule class لها unit tests. |
| CMP-009 | P0 | تطبق القواعد على الكميات الإجمالية مثل RAM modules وStorage slots. | التقييم لا يقتصر على أول عنصر من النوع المتعدد. |
| CMP-010 | P0 | تدعم القواعد Hard contradictions المعروفة حتى لو كانت أسماء المنتجات متشابهة. | DDR4/DDR5 وSocket mismatch ينتجان Error. |
| CMP-011 | P1 | تسمح Metadata في DB بتفعيل/تعطيل rule وتعديل النص والأولوية دون تغيير evaluator. | يظل logic typed بينما presentation configurable. |

### 8.5 المقترحات

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| REC-001 | P0 | يقترح النظام منتجات لا تحتوي Hard errors مع الاختيارات الحالية. | لا يظهر منتج ERROR داخل قائمة Recommended. |
| REC-002 | P0 | ترتب الاقتراحات بالتوافق ثم التوفر ثم اكتمال البيانات ثم السعر. | الترتيب deterministic ويمكن تفسيره. |
| REC-003 | P0 | لا يدعي النظام أداء أفضل دون مصدر benchmark. | لا توجد labels مثل Best Gaming Performance بناءً على specs فقط. |
| REC-004 | P0 | يعرض سبب الاقتراح مثل Socket match أو sufficient wattage. | كل suggestion يحتوي reasons قصيرة. |
| REC-005 | P1 | يسمح للمستخدم بتحديد budget للقطعة أو للتجميعة. | الاقتراحات تحاول الاقتراب من الميزانية دون كسر التوافق. |

### 8.6 الشراء والتوجيه للمتجر

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| BUY-001 | P0 | ينشئ النظام Shopping List من مكونات الـBuild وعروضها الحالية. | كل سطر يحتوي المنتج والمتجر والسعر والمخزون والرابط ووقت التحديث. |
| BUY-002 | P0 | لا يستخدم النظام كلمة Payment completed أو Order confirmed. | الواجهة توضح أن الشراء يتم خارج المنصة. |
| BUY-003 | P0 | يفتح كل عنصر صفحة Sigma الأصلية. | الرابط يطابق offer.sourceUrl. |
| BUY-004 | P0 | يعرض Disclaimer عن تغير السعر والمخزون. | يظهر قبل أزرار الشراء وفي Summary. |
| BUY-005 | P0 | إذا كان Build INVALID، تظهر روابط المنتجات لكن لا يوصف كـCompatible Purchase Plan. | يوضح النظام أن هناك تعارضات يجب حلها. |
| BUY-006 | P1 | عند إضافة متاجر لاحقًا، تجمع Shopping List حسب المتجر. | كل مجموعة توضح Checkout منفصلًا وإجماليًا لا يشمل الشحن. |

### 8.7 Bundles

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| BND-001 | P0 | يصنف كل Bundle كمنتج واحد مستقل. | له Product page وسعر ومخزون ورابط مصدر. |
| BND-002 | P0 | لا يتم تفكيك Bundle إلى Canonical products فردية. | لا تُنشأ Offers وهمية للمكونات المكتوبة داخله. |
| BND-003 | P0 | لا يكون Bundle مؤهلًا للـBuilder. | buildEligibility=NOT_ELIGIBLE. |
| BND-004 | P0 | تعرض التفاصيل النص الخام للمكونات إن كان متاحًا. | يظهر كـIncluded components text دون ضمان للمطابقة. |
| BND-005 | P0 | يمكن شراء Bundle فقط عبر رابط Sigma. | لا يظهر زر Add to Build. |

### 8.8 الإدارة والعمليات

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| ADM-001 | P0 | يمكن تشغيل Full/Category/Product scrape يدويًا. | توجد CLI أو Admin action مع سجل run. |
| ADM-002 | P0 | تعرض صفحة Scrape Runs الحالة والعدادات والأخطاء. | يمكن فتح تفاصيل كل run. |
| ADM-003 | P0 | تعرض Queues للمنتجات غير المصنفة أو غير المطابقة أو ذات التعارض. | لا تضيع الحالات الفاشلة داخل logs فقط. |
| ADM-004 | P0 | يمكن تطبيق Category override وProduct match override. | يحفظ القرار والمستخدم/الوقت والسبب. |
| ADM-005 | P0 | يمكن إعادة Normalize لبيانات خام موجودة دون إعادة Fetch. | يدعم الأمر run normalization --from-run. |
| ADM-006 | P0 | يمكن إعادة معالجة Product واحد. | توجد عملية آمنة لا تؤثر على باقي الكتالوج. |
| ADM-007 | P0 | لا تُنشر Run مشبوهة تلقائيًا إذا فشلت health thresholds. | تظل البيانات المنشورة السابقة فعالة. |
| ADM-008 | P1 | يعرض Diff بين النسخة القديمة والجديدة للمنتج. | السعر والمخزون والحقول canonical المتغيرة واضحة. |

## 9. نظام الـScraping وجمع البيانات

### 9.1 القرار التقني

الطريقة الأساسية HTTP-first باستخدام Crawlee CheerioCrawler، وPlaywright للتحقيق أو fallback محدود. الـAPI لا يقوم بالـScraping.

```text
Angular Web ------> Express API ------> Published MongoDB Collections
                                           ^
                                           | publish
Sigma Website -> Worker: Discover -> Fetch -> Raw -> Normalize -> Match -> Validate
```

### 9.2 مراحل الـPipeline

| المرحلة | المسؤولية |
| --- | --- |
| 1. Preflight | قراءة config، robots policy، seeds، منع run متزامن لنفس المتجر. |
| 2. Discovery | زيارة category pages والـpagination واستخراج product URLs. |
| 3. Fetch | تنزيل Product pages مع timeout/retry/rate limit. |
| 4. Raw extraction | استخراج title/price/spec rows/breadcrumb/SKU/images دون توحيد. |
| 5. Classification | تحديد category/productKind/buildEligibility مع confidence. |
| 6. Normalization | تحويل القيم إلى canonical fields ووحدات وقواميس ثابتة. |
| 7. Identity resolution | ربط listing بمنتج canonical أو إنشاء Review candidate. |
| 8. Validation | Schema validation، contradictions، quality flags. |
| 9. Publish | تحديث Product/Offer/Search documents بصورة idempotent. |
| 10. Reconciliation | تحديث lastSeen، stale policy، price events، run summary. |

### 9.3 متطلبات الـScraper

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| SCR-001 | P0 | يستخدم SigmaScraperAdapter مستقلًا. | إضافة Store جديد لا تعدل Sigma parser أو domain contracts. |
| SCR-002 | P0 | تحدد Seed categories في config/versioned data. | كل seed يحمل category hint وURL وحالة enabled. |
| SCR-003 | P0 | يكتشف جميع صفحات pagination حتى النهاية. | يُسجل page count وdiscovered count لكل category. |
| SCR-004 | P0 | يعمل Deduplication للـURLs قبل Fetch. | لا تتم معالجة نفس canonical URL مرتين في run واحد. |
| SCR-005 | P0 | يستخدم concurrency منخفضة قابلة للضبط، افتراضيًا 2–4. | لا يتجاوز الإعداد المعرّف ولا توجد burst غير محدودة. |
| SCR-006 | P0 | يدعم timeout وretry محدود مع exponential backoff. | لا يعاد HTTP 4xx غير القابل للإصلاح بلا نهاية. |
| SCR-007 | P0 | يسجل user-agent واضحًا خاصًا بالمشروع. | يمكن تتبع الطلبات في logs. |
| SCR-008 | P0 | يحترم robots rules وقرارات allow/deny المسجلة. | المسارات المحظورة لا تدخل RequestQueue. |
| SCR-009 | P0 | لا يحاول تجاوز login أو CAPTCHA أو anti-bot controls. | تُوقف العملية وتُسجل blocked status. |
| SCR-010 | P0 | يحفظ raw extracted payload لكل صفحة ناجحة. | يمكن إعادة normalization من payload السابق. |
| SCR-011 | P0 | يحفظ HTML sample أو failure snapshot للتشخيص. | كل parse failure يحتوي snapshot reference. |
| SCR-012 | P0 | يستخدم parserVersion في كل snapshot. | يمكن معرفة أي كود أنتج البيانات. |
| SCR-013 | P0 | يدعم Full، Category، Product modes. | كل mode ينتج ScrapeRun مستقلًا. |
| SCR-014 | P0 | يمنع Full runs متزامنة لنفس store. | المحاولة الثانية ترفض أو تنتظر حسب policy. |
| SCR-015 | P0 | لا يغيّر published availability عند فشل run. | لا يحدث mass out-of-stock بسبب parser break. |
| SCR-016 | P1 | يدعم schedule بواسطة cron/node-cron. | يمكن تعطيله من config دون تغيير الكود. |

### 9.4 Raw payload

```ts
interface RawProductSnapshot {
  storeCode: "SIGMA";
  externalId: string | null;
  sourceUrl: string;
  canonicalUrl: string;
  fetchedAt: Date;
  httpStatus: number;
  htmlHash: string;
  parserVersion: string;
  discovery: { seedId: string; pageUrl: string; categoryHint: string };
  rawTitle: string | null;
  rawPrice: string | null;
  rawOldPrice: string | null;
  rawAvailability: string | null;
  rawSku: string | null;
  rawBrand: string | null;
  rawBreadcrumbs: string[];
  rawSpecifications: Array<{ label: string; value: string }>;
  imageUrls: string[];
  parseWarnings: string[];
  scrapeRunId: ObjectId;
}
```

### 9.5 Health checks والنشر الآمن

- إذا كان discovered count أقل من 40% من آخر Full Run الناجح: run=SUSPICIOUS ولا يتم reconciliation.
- إذا تجاوزت الصفحات بلا title نسبة 10%: run=FAILED.
- إذا تجاوز parse price failure النسبة التاريخية بفرق كبير: run=SUSPICIOUS.
- إذا أعادت Category صفر منتجات وكانت سابقًا غير صفرية: لا يتم اعتبار عروضها unavailable.
- تتم عملية publish بعد اكتمال validation، وليس record-by-record مباشرة إلى واجهة المستخدم.
- يمكن النشر الجزئي للفئات الناجحة فقط إذا كان mode=Category؛ Full Run الجزئي يحتاج قرارًا صريحًا.

## 10. الـNormalization وجودة البيانات

### 10.1 الطبقات

| الطبقة | الغرض |
| --- | --- |
| RawSnapshot | ما جاء من الصفحة تقريبًا؛ لا يستخدمه المستخدم مباشرة إلا في raw specs. |
| StoreListing/Staging | قيم أساسية parsed مثل price وavailability وspec map، ما زالت مرتبطة بمصطلحات Sigma. |
| CanonicalProduct | هوية وفئة ومواصفات ثابتة مشتركة بين جميع المتاجر. |
| Offer | السعر والمخزون والرابط الخاص بالمتجر. |
| SearchDocument | حقول محسنة للبحث والـfacets، مشتقة ويمكن إعادة بنائها. |

### 10.2 قواعد عامة

- الاحتفاظ بـdisplayName قريبًا من اسم المتجر، وnormalizedName منفصل للبحث والهوية.
- Unicode normalization، إزالة المسافات الزائدة، توحيد علامات الشرط، دون حذف كلمات variant المهمة.
- عدم حذف Ti/Super/XT/XTX/OC/Tray/Box/Kit/Dual/Ventus وغيرها من identity tokens.
- السعر يحول إلى integer أو Decimal EGP؛ فشل التحليل ينتج null لا 0.
- كل قيمة canonical تحتفظ بمصدرها: SPEC/TITLE/BREADCRUMB/MANUAL/REFERENCE.
- القيمة inferred تحمل quality flag وconfidence.
- لا يُكتب UNKNOWN كنص داخل حقل رقمي؛ يستخدم null وحالة quality منفصلة.
- أي تعارض بين title وspec ينتج CONFLICTING flag ويحتاج rule أو review.

### 10.3 Controlled vocabularies

| المجال | قيم خام مثال | القيمة canonical |
| --- | --- | --- |
| Form factor | Micro ATX / mATX / M-ATX | MICRO_ATX |
| Memory generation | DDR 5 / DDR5 SDRAM | DDR5 |
| Availability | Add to Cart / In stock | IN_STOCK |
| Availability | Out Of Stock / Sold out | OUT_OF_STOCK |
| Modularity | Full Modular / Fully-Modular | FULLY_MODULAR |
| Storage form | M.2 2280 / 2280 M2 | M2_2280 |
| Interface | PCIe Gen 4 x4 / PCIe 4.0x4 | PCIE_4_X4 |

### 10.4 توحيد الوحدات

| النوع | أمثلة | المخرج |
| --- | --- | --- |
| Power | 750 W / 750 Watt | wattageW=750 |
| Length | 13.2 in / 335 mm | lengthMm=335 |
| Memory | 2x16GB | totalCapacityGb=32; moduleCount=2 |
| Speed | 6000 MHz / 6000 MT/s | speedMt=6000 مع الاحتفاظ بالنص الخام |
| Storage | 1 TB | capacityGb=1000 أو enum/value وفق سياسة موحدة |
| Voltage | 1.35 V | voltageV=1.35 |

### 10.5 جودة الحقول

| الحالة | المعنى |
| --- | --- |
| EXACT | مستخرج مباشرة من حقل واضح. |
| NORMALIZED | نفس المعنى بعد توحيد النص أو الوحدة. |
| INFERRED | استنتاج من title أو context مع confidence. |
| MISSING | غير موجود أو غير قابل للاستخراج. |
| CONFLICTING | مصدران يقدمان قيمتين متعارضتين. |
| MANUAL | تم تحديده بواسطة Admin override. |

### 10.6 متطلبات الـNormalization

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| NOR-001 | P0 | يحفظ النظام raw specs كلها حتى لو لم يكن لها canonical mapping. | عدد raw rows لا يقل بسبب عدم التعرف على label. |
| NOR-002 | P0 | تستخدم Label alias maps حسب الفئة والمتجر. | يمكن توحيد Max GPU Length وGPU Clearance إلى نفس الحقل. |
| NOR-003 | P0 | تستخدم parsers صغيرة Typed لكل نوع قيمة. | هناك unit tests مستقلة للقدرة والسعة والأبعاد والسرعة. |
| NOR-004 | P0 | تخضع النتائج لـZod validation قبل DB write. | الوثيقة غير الصالحة تذهب إلى validation errors. |
| NOR-005 | P0 | تطبق MongoDB schema validation على published collections. | لا يُخزن price كنص في Offer published. |
| NOR-006 | P0 | يمكن إعادة تشغيل normalization بإصدار جديد. | تُسجل normalizerVersion ويمكن مقارنة النتائج. |
| NOR-007 | P0 | يحمل كل Product dataQuality score وflags وcompatibilityCompleteness. | تظهر الأسباب التي خفضت الدرجة. |
| NOR-008 | P0 | لا تمنع البيانات الناقصة ظهور المنتج. | ينشر المنتج إذا كانت الهوية والسعر/الرابط الأساسيان صالحين، مع flags. |
| NOR-009 | P0 | تمنع تناقضات الهوية الخطيرة auto-publish حتى المراجعة. | مثال: title 32GB وspec 16GB لنفس RAM. |

## 11. Product Matching وهوية المنتج

### 11.1 الهدف

يفصل النظام بين Store Listing وCanonical Product لمنع التكرار والاستعداد لعروض متعددة المتاجر.

### 11.2 ترتيب معرفات الهوية

| الترتيب | المفتاح | الاستخدام |
| --- | --- | --- |
| 1 | GTIN/EAN/UPC | أقوى تطابق إن وجد. |
| 2 | Brand + MPN | المفتاح الأساسي الأكثر واقعية لقطع الهاردوير. |
| 3 | Brand + exact model | جيد إذا كان model محددًا وغير عام. |
| 4 | Store externalId alias | يضمن ثبات الربط عبر runs لنفس المتجر. |
| 5 | Category fingerprint | مجموعة حقول حاسمة حسب الفئة. |
| 6 | Manual review | الحالات المتقاربة أو المتعارضة. |

### 11.3 Blocking وScoring

```text
Candidate pool = same category + compatible brand block + model-family tokens

Score example:
  Exact GTIN                         +120
  Exact Brand + MPN                 +100
  Existing store externalId alias    +95
  Exact normalized model             +60
  Same category                      +10
  Same brand                         +15
  Matching critical specifications   +30
  Minor title token similarity       +10

Any hard contradiction => auto-match forbidden.
```

### 11.4 Hard contradictions حسب الفئة

| الفئة | التناقضات المانعة |
| --- | --- |
| RAM | DDR4 مقابل DDR5؛ 16GB مقابل 32GB؛ kit count مختلف؛ MPN مختلف؛ CL مختلف مع SKU مختلف. |
| GPU | Ti/Super/XT/XTX mismatch؛ VRAM مختلفة؛ Board partner/variant مختلف؛ MPN مختلف. |
| CPU | موديل مختلف؛ Box مقابل Tray عند كونه SKU منفصلًا؛ cooler included variant مختلف. |
| Storage | 1TB مقابل 2TB؛ SATA مقابل NVMe؛ form factor مختلف؛ heatsink SKU منفصل. |
| PSU | Wattage مختلف؛ efficiency مختلفة؛ model/MPN مختلف. |
| Case | لون أو variant قد يكون منتجًا منفصلًا إذا كان SKU مختلفًا؛ لا يدمج تلقائيًا. |

### 11.5 قرارات المطابقة

| الحالة | الإجراء |
| --- | --- |
| EXACT_MATCH | معرف exact بلا تعارض؛ auto-link. |
| PROBABLE_MATCH | score مرتفع بلا تعارض؛ يمكن auto-link مع audit. |
| NEEDS_REVIEW | score متوسط أو حقول أساسية ناقصة. |
| NEW_PRODUCT | لا توجد candidate مناسبة. |
| CONFLICT | معرف يشير لمنتج لكن المواصفات تتعارض. |

### 11.6 متطلبات المطابقة

| ID | Priority | المتطلب | معيار القبول |
| --- | --- | --- | --- |
| MAT-001 | P0 | يحاول النظام externalId alias قبل أي fuzzy comparison. | الـlisting المعروفة تعود لنفس productId. |
| MAT-002 | P0 | يستخدم GTIN/MPN/brand/model عندما تتوفر. | تُحفظ identifiers منفصلة وليست tokens داخل الاسم فقط. |
| MAT-003 | P0 | يطبق fingerprints مختلفة لكل Category. | لا تستخدم RAM fingerprint لمقارنة GPUs. |
| MAT-004 | P0 | يمنع hard contradictions auto-match. | أي تعارض حاسم يحول الحالة إلى CONFLICT/REVIEW. |
| MAT-005 | P0 | لا يستخدم السعر في الهوية. | تغيير السعر لا ينشئ منتجًا جديدًا ولا يؤثر في match score. |
| MAT-006 | P0 | لا يستخدم fuzzy title وحده للـauto-match. | يستخدم فقط signal منخفضة أو search UX. |
| MAT-007 | P0 | يخزن matchMethod وscore وevidence. | يمكن تفسير لماذا تم الربط. |
| MAT-008 | P0 | يدعم manual link/create/ignore/mark bundle. | كل قرار يخلق override دائمًا أو alias. |
| MAT-009 | P0 | يفضل false duplicate على false merge. | thresholds محافظة وتحتاج review للحالات الوسطى. |

## 12. تصميم PC Builder

### 12.1 نموذج الـBuild

```ts
interface Build {
  id: string;
  name?: string;
  status: "DRAFT" | "INCOMPLETE" | "VALID" |
          "VALID_WITH_WARNINGS" | "UNVERIFIED" | "INVALID";
  selections: Array<{
    category: ProductCategory;
    productId: ObjectId;
    offerId: ObjectId;
    quantity: number;
  }>;
  validationSummary: {
    errors: number;
    warnings: number;
    unknowns: number;
    infos: number;
    checkedAt: Date;
    rulesVersion: string;
  };
  observedTotalEgp: number | null;
  hasPartialTotal: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 12.2 Build status

| الحالة | المعنى |
| --- | --- |
| DRAFT | لا توجد اختيارات أو ما زال المستخدم يبدأ. |
| INCOMPLETE | لا توجد Errors لكن Slots الأساسية غير مكتملة. |
| VALID | الـBuild مكتمل، لا Errors ولا Unknowns حرجة ولا Warnings. |
| VALID_WITH_WARNINGS | مكتمل ولا Errors، لكن توجد Warnings. |
| UNVERIFIED | لا Errors واضحة، لكن توجد Unknowns تمنع تأكيد التوافق. |
| INVALID | توجد Error واحدة أو أكثر. |

### 12.3 سلوك Product Picker

- الفلاتر العادية تظل متاحة داخل الـPicker.
- النتائج تقسم إلى Compatible وPotentially compatible وIncompatible.
- Compatible: لا Errors ولا Unknowns مرتبطة بالقطعة ضمن السياق الحالي.
- Potential: Warnings أو Unknowns فقط.
- Incompatible: توجد Error متوقعة إذا أضيف المنتج.
- التصنيف Preview يستخدم نفس Rule engine بصورة افتراضية دون حفظ القطعة.
- الـDefault view يبدأ بـCompatible ثم Potential، مع زر Show incompatible.

### 12.4 الاكتمال الوظيفي

- الـBuild الأساسي يحتاج CPU + Motherboard + RAM + Storage + PSU + Case.
- GPU اختياري فقط إذا كان هناك Integrated Graphics مؤكدة أو المستخدم يقبل Warning.
- CPU Cooler اختياري إذا كان coolerIncluded=YES؛ وإلا Missing cooler ينتج Warning أو Error حسب السياسة.
- يمكن وجود أكثر من Storage، ويمكن RAM متعددة وفق عدد modules.
- الـCase fans ليست شرط اكتمال في P0.

## 13. Compatibility Engine — التعريف الدقيق

### 13.1 فلسفة الحكم

- PASS: البيانات تؤكد الشرط.
- ERROR: تعارض مانع.
- WARNING: مخاطرة أو شرط.
- UNKNOWN: بيانات غير كافية.
- INFO: معلومة غير مانعة.

### 13.2 Contract موحد للقواعد

```ts
interface CompatibilityRule {
  code: string;
  version: string;
  appliesTo: ProductCategory[];
  evaluate(context: BuildContext): CompatibilityResult[];
}

interface CompatibilityResult {
  ruleCode: string;
  status: "PASS" | "ERROR" | "WARNING" | "UNKNOWN" | "INFO";
  title: string;
  message: string;
  affectedSelections: string[];
  evidence: Array<{ selectionId: string; field: string; value: unknown }>;
  missingFields: string[];
  suggestions: string[];
  severityWeight: number;
}
```

### 13.3 Rule Catalog للـMVP

| Rule code | القاعدة | الحكم |
| --- | --- | --- |
| CMP-CPU-MB-001 | CPU ↔ MB socket | مختلف=ERROR؛ ناقص=UNKNOWN؛ متساوٍ=PASS. |
| CMP-CPU-MB-002 | CPU generation/chipset support | غير مدعوم=ERROR؛ BIOS update=WARNING؛ بلا reference=UNKNOWN. |
| CMP-RAM-MB-001 | RAM generation | DDR mismatch أو SO-DIMM/DIMM mismatch=ERROR. |
| CMP-RAM-MB-002 | RAM module count | إجمالي modules أكبر من slots=ERROR؛ slots missing=UNKNOWN. |
| CMP-RAM-MB-003 | RAM capacity | إجمالي capacity أكبر من max=ERROR؛ max missing=UNKNOWN. |
| CMP-RAM-MB-004 | RAM speed | أعلى من supported=WARNING/INFO حسب OC support. |
| CMP-RAM-001 | Mixing RAM kits | أكثر من kit أو موديلات/سرعات مختلفة=WARNING. |
| CMP-MB-CASE-001 | Form factor | Case لا يدعم motherboard form factor=ERROR. |
| CMP-GPU-CASE-001 | GPU length | أكبر من clearance=ERROR؛ margin صغير=WARNING؛ ناقص=UNKNOWN. |
| CMP-GPU-CASE-002 | GPU slot width | أكبر من expansion capacity=ERROR؛ ناقص=UNKNOWN. |
| CMP-COOLER-CPU-001 | Cooler socket | عدم دعم socket=ERROR؛ support list ناقصة=UNKNOWN. |
| CMP-COOLER-CASE-001 | Air cooler height | أعلى من الحد=ERROR؛ margin صغير=WARNING. |
| CMP-AIO-CASE-001 | Radiator size | الحجم غير مدعوم=ERROR؛ الموضع غير محدد=WARNING/UNKNOWN. |
| CMP-AIO-GPU-001 | Front radiator clearance | تعارض محتمل مع GPU=WARNING أو UNKNOWN في P0. |
| CMP-PSU-POWER-001 | PSU wattage | أقل من required=ERROR؛ headroom منخفض=WARNING. |
| CMP-PSU-GPU-001 | GPU power connectors | connector ناقص=ERROR؛ adapter required=WARNING. |
| CMP-STORAGE-MB-001 | Storage interface | لا يوجد interface/slot مناسب=ERROR. |
| CMP-STORAGE-MB-002 | Storage slot count | عدد الأجهزة يتجاوز slots=ERROR؛ shared lanes=INFO/WARNING. |
| CMP-STORAGE-MB-003 | PCIe generation | جهاز أسرع على slot أبطأ=WARNING؛ backward compatible معروف=PASS+INFO. |
| CMP-DISPLAY-001 | Display capability | لا GPU ولا iGPU=ERROR أو strong WARNING قبل الإكمال. |
| CMP-COOLING-001 | CPU cooler required | CPU دون included cooler ولا cooler مختار=WARNING/ERROR حسب اكتمال Build. |
| CMP-BUILD-001 | Required components | غياب القطع الأساسية يجعل Build INCOMPLETE. |

### 13.4 حساب الطاقة

```text
estimatedDrawW = sum(known component draw values)
headroomTargetW = ceilTo50(estimatedDrawW * 1.25)
requiredPsuW = max(headroomTargetW, gpu.recommendedPsuW ?? 0)

If critical draw values and GPU recommendation are both missing:
  result = UNKNOWN
Else if psu.wattageW < requiredPsuW:
  result = ERROR
Else if psu.wattageW < requiredPsuW + 100:
  result = WARNING
Else:
  result = PASS
```

> **قيد:** حساب الطاقة تقديري ويجب عرض مصادر القيم والبيانات الناقصة.

### 13.5 بيانات المرجع

- Platform compatibility reference: CPU family ↔ socket ↔ chipset ↔ BIOS note.
- Form factor containment reference: E-ATX/ATX/Micro-ATX/Mini-ITX.
- Connector vocabulary and equivalence: 6-pin, 8-pin, 12VHPWR, 12V-2x6.
- Known backward compatibility relationships للـPCIe وStorage.
- كل reference entry يحمل sourceUrl/sourceName/verifiedAt/version.

## 14. البحث والفلترة — التصميم التفصيلي

### 14.1 Search provider

يستخدم MongoDB Search خلف SearchRepository، مع fallback محلي للاختبارات.

### 14.2 حقول الفهرسة

- identity.brand، identity.model، identity.mpn، identity.gtin.
- display.name وsearch.normalizedName وsearch.aliases وsearch.tokens.
- category، productKind، buildEligibility، publicationStatus.
- offer.currentPriceEgp، availability، lastSeenAt.
- الحقول canonical المستخدمة في facets لكل category.

### 14.3 Ranking

| الإشارة | الترتيب |
| --- | --- |
| Exact MPN/GTIN | أعلى boost. |
| Exact model | مرتفع جدًا. |
| Exact phrase in name | مرتفع. |
| Brand + model tokens | متوسط. |
| Autocomplete prefix | متوسط حسب token order. |
| Fuzzy title | أقل من exact matches. |
| In stock | Boost صغير اختياري لا يتغلب على exact identity. |

### 14.4 Facets حسب الفئة

| الفئة | الفلاتر |
| --- | --- |
| عام | Brand، price range، availability، discount، quality level. |
| CPU | Manufacturer، socket، cores، threads، TDP، iGPU، Box/Tray، cooler included. |
| Motherboard | Socket، chipset، form factor، DDR generation، DIMM slots، Wi-Fi، M.2 count. |
| RAM | DDR generation، capacity، module count، speed، CAS، DIMM/SO-DIMM. |
| GPU | Chipset family، board brand، VRAM، memory type، length، recommended PSU. |
| Storage | Type، capacity، interface، form factor، PCIe generation، heatsink. |
| PSU | Wattage، efficiency، modularity، ATX version، connectors. |
| Case | Form factors، GPU clearance، cooler clearance، radiator sizes، included PSU/fans. |
| Cooling | Air/AIO، sockets، height، radiator size. |

### 14.5 Search API behavior

- Pagination افتراضي 24 وحد أقصى 100.
- Cursor أو stable sort tie-breaker بـ_id لتجنب duplicates بين الصفحات.
- فلاتر متعددة من نفس النوع تستخدم OR، والفلاتر المختلفة تستخدم AND.
- Price filter يعتمد على offer الحالية وغير stale، مع خيار include unknown price.
- Facet counts محسوبة على query context قبل تطبيق facet الحالي إن تم اختيار disjunctive facets حسب UX.
- API يعيد appliedFilters وwarnings للقيم غير المعروفة.

## 15. الشراء والدفع والتوجيه للمتجر

### 15.1 قرار الـMVP

> **القرار:** لا دفع ولا Orders داخل المنصة؛ كل شراء يتم في Sigma.

### 15.2 Shopping List وليست Cart

- تعرض العناصر المختارة والأسعار المرصودة والمخزون المرصود وروابط المصدر.
- تعرض إجماليًا تقديريًا فقط، مع إشارة Partial إذا كانت أسعار بعض العناصر null.
- لا تتضمن الشحن أو كوبونات Sigma أو ضرائب إضافية إن وجدت.
- لا تدعي أن المنتج أُضيف إلى Cart المتجر.
- تطلب من المستخدم التحقق من السعر والمخزون في صفحة المتجر.

### 15.3 عند إضافة متاجر متعددة

- كل Component selection يرتبط بـOffer مختار.
- الـShopping List تجمع العناصر حسب storeCode.
- كل Store group له Subtotal وLinks وCheckout منفصل.
- Cheapest overall يمكن أن يستخدم متاجر متعددة، لكن لا يوجد دفع موحد.
- Single-store strategy تبحث فقط عن Offers من متجر واحد يغطي المكونات المطلوبة.
- Max-N-stores optimization Feature مستقبلية، ولا تشمل shipping في الحساب الأولي.

## 16. التعامل مع Bundles وPrebuilt Products

يعامل كل Bundle كمنتج واحد ولا يتم تفكيكه أو إدخاله في الـBuilder.

```js
{
  category: "BUNDLE",
  productKind: "BUNDLE",
  buildEligibility: "NOT_ELIGIBLE",
  includedComponentsText: string[],
  includedCanonicalProductIds: [], // empty in MVP
  offer: { storeCode: "SIGMA", sourceUrl, price, availability }
}
```

### 16.2 تمييز Bundle عن Prebuilt

- BUNDLE: مجموعة قطع تباع معًا.
- PREBUILT: جهاز مكتمل.
- كلاهما خارج الـBuilder.

## 17. نموذج البيانات

### 17.1 Collections

| Collection | المسؤولية |
| --- | --- |
| stores | تعريف المتجر وحالة الـadapter وآخر run ناجحة. |
| scrape_runs | حالة وعدادات وأخطاء كل تشغيل. |
| raw_product_snapshots | كل payload خام extracted. |
| store_listings | Staging normalized جزئيًا قبل canonical linking. |
| catalog_products | المنتجات canonical المنشورة. |
| offers | السعر والمخزون والرابط لكل متجر. |
| price_events | تغيرات السعر والمخزون. |
| product_identity_aliases | ربط external IDs/MPNs بمنتجات. |
| match_reviews | حالات المطابقة والتصنيف اليدوي. |
| compatibility_reference | بيانات منصة/Socket/Chipset ومراجعها. |
| builds | اختيارات المستخدم ونتيجة التحقق. |
| rule_metadata | تفعيل النصوص والأولوية دون logic executable. |

### 17.2 CatalogProduct

```ts
interface CatalogProduct {
  _id: ObjectId;
  category: ProductCategory;
  productKind: "SINGLE_COMPONENT" | "BUNDLE" | "PREBUILT" | "ACCESSORY";
  buildEligibility: "ELIGIBLE" | "NOT_ELIGIBLE" | "CONDITIONAL";
  publicationStatus: "PUBLISHED" | "DRAFT" | "NEEDS_REVIEW" | "EXCLUDED";
  identity: {
    brand: string | null;
    model: string | null;
    mpn: string | null;
    gtin: string | null;
    aliases: string[];
  };
  display: { name: string; imageUrls: string[]; summary?: string };
  specsCanonical: ProductSpecs;
  specsRaw: Array<{ label: string; value: string; source: string }>;
  search: { normalizedName: string; tokens: string[]; aliases: string[] };
  dataQuality: {
    score: number;
    compatibilityCompleteness: number;
    flags: string[];
    fieldQuality: Record<string, FieldQuality>;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 17.3 Offer

```ts
interface Offer {
  _id: ObjectId;
  productId: ObjectId;
  storeId: ObjectId;
  externalId: string;
  sourceUrl: string;
  currentPriceEgp: number | null;
  oldPriceEgp: number | null;
  priceType: "FIXED" | "FROM" | "RANGE" | "UNAVAILABLE";
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  lastSeenAt: Date;
  lastChangedAt: Date;
  staleState: "FRESH" | "STALE" | "UNAVAILABLE";
  lastSuccessfulRunId: ObjectId;
}
```

### 17.4 Indexes والقيود

| Collection | Index | السبب |
| --- | --- | --- |
| offers | unique(storeId, externalId) | منع تكرار عرض المتجر. |
| product_identity_aliases | unique(storeId, externalId) | ربط ثابت للـlisting. |
| catalog_products | category + identity.brand | الفلاتر. |
| catalog_products | category + specsCanonical.* | Indexes للحقول الأكثر استخدامًا حسب الفئة. |
| offers | productId + storeId | جلب العروض. |
| scrape_runs | storeId + startedAt desc | التشغيل. |
| builds | id/opaque token | استرجاع build. |

### 17.5 Canonical specs المختصرة

| Category | Canonical fields |
| --- | --- |
| CPU | manufacturer, socket, family, cores, threads, base/boost clock, tdpW, iGPU, packageType, coolerIncluded |
| MOTHERBOARD | socket, chipset, supportedCpuFamilies, formFactor, memoryGeneration, dimmSlots, maxMemoryGb, M.2/SATA, Wi-Fi, Bluetooth, PCIe |
| RAM | memoryGeneration, totalCapacityGb, moduleCount, capacityPerModuleGb, speedMt, casLatency, moduleType, voltageV |
| GPU | chipset, variant, vramGb, memoryType, lengthMm, slotWidth, tdpW, recommendedPsuW, connectors, interface |
| STORAGE | storageType, capacityGb, formFactor, interface, pcieGeneration, read/write, heatsink |
| PSU | wattageW, efficiencyRating, modularity, atxVersion, connectors, formFactor |
| CASE | supportedFormFactors, maxGpuLengthMm, maxCoolerHeightMm, maxPsuLengthMm, expansionSlots, radiatorSupport, includedFans/PSU |
| CPU_COOLER | coolerType, supportedSockets, heightMm, radiatorSizeMm, tdpRatingW, fans |
| CASE_FAN | sizeMm, count, airflow, rpm, connector, rgbType |

## 18. تصميم الـAPI

### 18.1 مبادئ

- ReST JSON تحت `/api/v1`.
- الـAPI يقرأ البيانات المنشورة فقط، ولا يتصل بالمتجر.
- Request validation وResponse DTOs لا تعيد Mongo documents مباشرة.
- Error envelope موحد مع code وmessage وdetails وtraceId.
- OpenAPI/Swagger متاح في development.
- Pagination وfilter conventions ثابتة.

### 18.2 Endpoints العامة

| Method | Path | الغرض |
| --- | --- | --- |
| GET | /api/v1/categories | الفئات والـfacets metadata. |
| GET | /api/v1/products | بحث/فلترة/ترتيب/pagination. |
| GET | /api/v1/products/:id | تفاصيل المنتج canonical + raw specs. |
| GET | /api/v1/products/:id/offers | العروض الحالية. |
| GET | /api/v1/search/suggestions | Autocomplete. |
| POST | /api/v1/builds | إنشاء Build. |
| GET | /api/v1/builds/:id | قراءة Build. |
| PUT | /api/v1/builds/:id/selections/:slot | إضافة/استبدال selection. |
| DELETE | /api/v1/builds/:id/selections/:selectionId | إزالة selection. |
| POST | /api/v1/builds/:id/validate | تشغيل validation صريح. |
| GET | /api/v1/builds/:id/candidates/:category | نتائج مصنفة حسب التوافق. |
| GET | /api/v1/builds/:id/shopping-list | خطة الشراء. |

### 18.3 Admin endpoints

| Method | Path | الغرض |
| --- | --- | --- |
| POST | /api/v1/admin/scrape-runs | تشغيل Full/Category/Product. |
| GET | /api/v1/admin/scrape-runs | قائمة runs. |
| GET | /api/v1/admin/scrape-runs/:id | تفاصيل وأخطاء. |
| GET | /api/v1/admin/reviews | قوائم review. |
| POST | /api/v1/admin/reviews/:id/resolve | حل classification/match conflict. |
| POST | /api/v1/admin/normalization-runs | إعادة معالجة raw data. |

### 18.4 مثال Search response

```json
{
  "items": [
    {
      "id": "...",
      "name": "MSI GeForce RTX ...",
      "category": "GPU",
      "brand": "MSI",
      "priceEgp": 24999,
      "availability": "IN_STOCK",
      "quality": { "score": 88, "compatibilityCompleteness": 75 },
      "lastCheckedAt": "2026-07-12T10:00:00Z"
    }
  ],
  "page": { "number": 1, "size": 24, "totalItems": 310, "totalPages": 13 },
  "facets": { "brands": [], "vramGb": [], "price": { "min": 0, "max": 100000 } },
  "appliedFilters": {},
  "warnings": []
}
```

### 18.5 Error envelope

```json
{
  "error": {
    "code": "BUILD_COMPONENT_NOT_ELIGIBLE",
    "message": "Bundles cannot be added to a custom PC build.",
    "details": { "productId": "...", "productKind": "BUNDLE" },
    "traceId": "..."
  }
}
```

## 19. تطبيق Angular

### 19.1 الصفحات

| الصفحة | المحتوى |
| --- | --- |
| Home | Search، categories، CTA للـBuilder، freshness summary. |
| Catalog/Category | نتائج، filter sidebar، facets، sort، pagination. |
| Product Details | صور، السعر، offer، canonical/raw specs، quality، رابط المتجر. |
| Builder | slots، picker، compatibility summary، suggestions، total. |
| Shopping List | العناصر والروابط والإجمالي والتنبيه. |
| Bundles | تصفح bundles catalog-only. |
| Admin Runs | runs، counters، errors، controls. |
| Admin Review | classification/matching/normalization conflicts. |

### 19.2 المكونات

- GlobalSearchBar
- AutocompletePanel
- FilterSidebar
- FacetGroup
- ProductCard
- AvailabilityBadge
- DataQualityBadge
- RawSpecsTable
- CanonicalSpecsGrid
- BuildSlot
- CandidatePicker
- CompatibilitySummary
- RuleResultCard
- SuggestionCard
- ShoppingListGroup
- ScrapeRunTable
- ReviewDecisionPanel

### 19.3 إدارة الحالة

- Angular Services + Signals/Computed للـlocal UI state.
- RxJS للـHTTP streams والـdebounce وswitchMap.
- Reactive Forms للفلاتر والـBuilder controls.
- لا NgRx في P0 إلا إذا أثبت التعقيد الحاجة إليه.
- Query params هي source of truth لحالة البحث القابلة للمشاركة.
- Builder state يحمّل من API ويحتفظ optimistic UI بحذر مع rollback عند الفشل.

### 19.4 UX قواعد إلزامية

- لا تعرض Compatible بدون سبب أو rule summary.
- استخدم ألوانًا مع نص/أيقونة، وليس اللون وحده.
- أظهر تاريخ آخر تحديث قرب السعر.
- لا تخفِ Out of Stock افتراضيًا دون خيار واضح.
- اعرض skeleton/loading وempty/error states.
- فرق بوضوح بين Canonical specs وStore raw details عند الحاجة.
- الـBuilder لا يحذف اختيارًا تلقائيًا عند إضافة قطعة متعارضة؛ يعرض الخطأ ويترك القرار للمستخدم.

## 20. المعمارية والتنظيم البرمجي

### 20.1 النمط

Modular Monolith: Angular Web + Express API + Node Worker + shared packages.

```text
repo/
  apps/
    web/                 # Angular
    api/                 # Express REST API
    worker/              # Crawling, normalization, publishing
  packages/
    domain/              # entities, enums, compatibility rules
    contracts/           # DTOs and API schemas
    scraping-core/       # adapter contracts, run engine, retry
    normalization/       # parsers, vocabularies, category schemas
    data-access/         # Mongo repositories/models
    test-fixtures/       # HTML and normalized samples
  docs/
    PRD/
    ADR/
  docker-compose.yml
```

### 20.2 مسؤوليات التطبيقات

| المكون | المسؤولية |
| --- | --- |
| Web | واجهة المستخدم فقط؛ لا تحتوي قواعد التوافق كمصدر حقيقي. |
| API | Catalog، search orchestration، builds، compatibility، admin API. |
| Worker | Scraping، raw storage، normalization، matching، reconciliation. |
| Domain package | Enums، rule evaluators، schemas/interfaces، shared invariants. |
| Data access | Repositories، indexes، transactions عند الحاجة، migrations/scripts. |

### 20.3 التقنيات المستهدفة

| الطبقة | الاختيار |
| --- | --- |
| Language | TypeScript end-to-end. |
| Frontend | Angular، Reactive Forms، RxJS، Signals. |
| API | Node.js + Express + Zod + OpenAPI. |
| Worker | Node.js + Crawlee CheerioCrawler؛ Playwright fallback. |
| Database | MongoDB + Mongoose/native repositories؛ Schema validation. |
| Search | MongoDB Search/Atlas Search في البيئة المستضافة. |
| Testing | Unit + integration + contract + E2E؛ Playwright للـE2E. |
| Packaging | npm workspaces؛ Docker Compose للتطوير. |

### 20.4 تدفق النشر

- Worker يكتب Raw/Staging أثناء run.
- Normalization وmatching ينتجان candidate version.
- Validation يحسب quality وpublication decision.
- Publish upserts CatalogProduct وOffer بصورة idempotent.
- Search index يتحدث بعد DB update أو عبر derived rebuild.
- API لا يرى run نصف مكتملة كمصدر وحيد؛ يحتفظ بالنسخة المنشورة السابقة عند الفشل.

## 21. الحالات ودورات الحياة

| الكائن | الحالات |
| --- | --- |
| ScrapeRun | PENDING → RUNNING → SUCCEEDED \| PARTIALLY_FAILED \| SUSPICIOUS \| FAILED \| CANCELLED |
| Raw parse | FETCHED → PARSED \| PARSE_FAILED |
| Listing | DISCOVERED → NORMALIZED \| NORMALIZATION_FAILED → MATCHED \| NEEDS_REVIEW |
| Product publication | DRAFT → PUBLISHED \| NEEDS_REVIEW \| EXCLUDED |
| Offer freshness | FRESH → STALE → UNAVAILABLE |
| Match decision | EXACT_MATCH \| PROBABLE_MATCH \| NEEDS_REVIEW \| NEW_PRODUCT \| CONFLICT |
| Build | DRAFT \| INCOMPLETE \| VALID \| VALID_WITH_WARNINGS \| UNVERIFIED \| INVALID |

### 21.2 Stale policy

- ظهر في آخر run ناجحة: FRESH.
- لم يظهر في run ناجحة واحدة: STALE مع الاحتفاظ بالسعر السابق.
- لم يظهر في ثلاث Full Runs ناجحة متتالية: UNAVAILABLE.
- فشل run أو كان SUSPICIOUS: لا تتغير freshness بسبب الغياب.
- ظهوره مرة أخرى يعيده إلى FRESH.

## 22. المتطلبات غير الوظيفية

| ID | المجال | المتطلب |
| --- | --- | --- |
| NFR-001 | Performance | Catalog/Search API p95 أقل من 700ms في Dataset الـMVP المستهدفة. |
| NFR-002 | Performance | Builder validation p95 أقل من 400ms بعد جلب المنتجات. |
| NFR-003 | Reliability | فشل الـWorker لا يوقف API ولا يمسح بيانات منشورة. |
| NFR-004 | Idempotency | إعادة نفس run/input لا تنشئ duplicate Offers أو aliases. |
| NFR-005 | Data integrity | Published writes تخضع schema validation وunique indexes. |
| NFR-006 | Observability | كل request/run يحمل traceId/runId في logs. |
| NFR-007 | Maintainability | كل Store Adapter معزول واختباراته تستخدم fixtures. |
| NFR-008 | Accessibility | الواجهة قابلة لاستخدام لوحة المفاتيح ولها labels وحالات غير معتمدة على اللون فقط. |
| NFR-009 | Security | Admin endpoints محمية على الأقل بمصادقة بسيطة في بيئة العرض. |
| NFR-010 | Privacy | لا تجمع بيانات دفع أو معلومات شخصية حساسة. |
| NFR-011 | Freshness | كل سعر يعرض lastCheckedAt؛ لا توجد بيانات بلا timestamp. |
| NFR-012 | Recoverability | يمكن إعادة بناء published catalog من raw/staging وversions المتاحة. |
| NFR-013 | Compatibility | Rules version محفوظة مع كل validation summary. |
| NFR-014 | Portability | التطبيقات قابلة للتشغيل محليًا عبر documented setup. |

## 23. الأمان والاستخدام المسؤول للـScraping

- فحص robots.txt قبل الـFull Crawl واحترام المسارات الممنوعة.
- مراجعة شروط الاستخدام يدويًا وتسجيل القرار داخل store configuration.
- عدم تجاوز authentication أو CAPTCHA أو rate limits أو حماية تقنية.
- استخدام معدل طلبات منخفض وconfigurable وعدم Scrape عند كل user request.
- عدم إعادة استضافة أو نسخ الوصف والصور على نحو غير ضروري؛ الاحتفاظ بالمصدر والرابط.
- إظهار أن السعر والمخزون مأخوذان من آخر فحص وليسا ضمانًا.
- إتاحة تعطيل الـadapter فورًا إذا ظهرت مشكلة أو طلب المصدر ذلك.
- حماية Admin actions من التشغيل غير المقصود.
- تجنب SSRF: الـWorker يزور domains وpaths مسموحة فقط، والـAPI لا يقبل URL عشوائيًا من المستخدم.
- تنقية أي HTML قبل عرضه؛ raw descriptions لا تُحقن مباشرة في DOM.

> robots.txt ليس تصريحًا قانونيًا؛ يجب مراجعة شروط الموقع بصورة مستقلة.

## 24. استراتيجية الاختبار وضمان الجودة

### 24.1 هرم الاختبارات

| النوع | النطاق |
| --- | --- |
| Unit | Parsers، unit conversion، controlled vocabularies، matching scoring، compatibility rules. |
| Fixture/Parser | HTML محفوظ لكل category والحالات discount/out-of-stock/missing specs/bundle. |
| Integration | Mongo repositories، unique indexes، publish/reconciliation، API مع test DB. |
| Contract | كل StoreAdapter يعيد نفس contract؛ DTO schemas متوافقة بين API وAngular. |
| E2E | Search → Product → Build → Compatibility → Shopping list. |
| Regression data | Golden normalized products لكل category تقارن بعد تغيير normalizer. |

### 24.2 Test fixtures المطلوبة

- Product عادي بسعر ثابت.
- Product بخصم old/new price.
- Out of stock.
- Product بدون Brand أو MPN.
- Product بمواصفات مكررة أو Labels مختلفة.
- RAM kit وموديول منفرد.
- GPU بأبعاد وRecommended PSU.
- Case يتضمن PSU أو Fans.
- Bundle متعدد القطع.
- صفحة HTML تغير فيها Selector أساسي.
- صفحة 404/500/timeout.
- عناوين قديمة numeric ID وعناوين slug/UUID.

### 24.3 Compatibility test matrix

| الحالة | النتيجة المتوقعة |
| --- | --- |
| AM5 CPU + AM5 MB | PASS |
| AM5 CPU + LGA1700 MB | ERROR |
| Socket missing | UNKNOWN |
| DDR5 RAM + DDR4 MB | ERROR |
| 4 RAM modules + 2 slots | ERROR |
| GPU 350mm + Case 330mm | ERROR |
| GPU 330mm + Case 335mm | WARNING margin |
| 750W PSU + required 850W | ERROR |
| Gen4 SSD + Gen3 slot | WARNING/INFO |
| No GPU + CPU no iGPU | ERROR/strong warning |
| Bundle add to build | API 422 |

### 24.4 Definition of Done العامة

- المتطلبات ذات الصلة لها اختبارات ناجحة.
- لا توجد Critical lint/type errors.
- الـAPI contract موثق ومحدث.
- توجد error/empty/loading states في الواجهة.
- لا توجد بيانات مخترعة لسد الحقول الناقصة.
- التغييرات في schema أو rules مسجلة versioned.
- تم تحديث README/ADR/PRD إذا تغير القرار.
- الـfeature تعمل على dataset حقيقية وfixtures.

## 25. الرصد وعمليات التشغيل

### 25.1 Logs

- Structured JSON logs تحتوي timestamp، level، service، traceId/runId، storeCode، URL hash، event code.
- لا تسجل HTML كاملًا في log؛ يحفظ snapshot reference منفصل.
- أحداث رئيسية: RUN_STARTED، URL_DISCOVERED، FETCH_FAILED، PARSE_FAILED، NORMALIZE_WARNING، MATCH_REVIEW، PUBLISH_SUCCESS، RUN_FINISHED.
- API logs تسجل status/latency ولا تسجل edit tokens أو أسرار.

### 25.2 Metrics

- Discovered/fetched/parsed/normalized/published counts لكل run/category.
- Parse success rate وprice parse failure rate.
- Products by publication status وquality flag.
- Match decisions distribution.
- Offers fresh/stale/unavailable.
- API latency/error rate.
- Search zero-result rate.
- Compatibility outcomes by rule code.

### 25.3 أوامر التشغيل

```bash
# Full Sigma run
npm run worker:sigma -- --mode=full

# One category
npm run worker:sigma -- --mode=category --category=GPU

# One product
npm run worker:sigma -- --mode=product --url="https://..."

# Re-normalize an existing run without fetching
npm run worker:normalize -- --store=SIGMA --runId=<id>

# Rebuild search documents
npm run worker:search-rebuild -- --store=SIGMA
```

## 26. القياسات ومعايير نجاح المنتج

| المقياس | التعريف |
| --- | --- |
| Catalog coverage | Published + review + excluded reasons تساوي discovered valid listings. |
| Data completeness | نسبة اكتمال الحقول الحرجة لكل category. |
| Search success | نسبة searches التي ينتج عنها click على product. |
| Zero results | النسبة وأشهر queries لتحديث aliases. |
| Builder completion | عدد builds التي تصل لحالة مكتملة. |
| Compatibility prevention | عدد Errors التي ظهرت قبل outbound click. |
| Outbound click-through | النقرات على Sigma product links. |
| Data freshness | عمر أحدث run ناجحة وعدد stale offers. |

> القياسات يمكن أن تكون مجهولة ولا تتطلب ملفات شخصية للمستخدم.

## 27. معايير القبول النهائية للـMVP

| المعيار | القبول |
| --- | --- |
| A1 — Data acquisition | Full Sigma run يكتشف كل صفحات الفئات المحددة ويعطي تقريرًا لكل Category. |
| A2 — Raw preservation | يمكن أخذ raw snapshot وتشغيل normalizer جديد عليه دون Fetch. |
| A3 — Catalog completeness | كل Listing ناجحة إما منشورة أو في Review/Excluded بسبب مسجل. |
| A4 — Product details | صفحة المنتج تعرض السعر والمخزون ووقت التحديث وكل raw specs والحقول canonical. |
| A5 — Search | الاسم/الموديل/MPN يعمل، والـfacets تختلف حسب category، وحالة URL قابلة للمشاركة. |
| A6 — Builder | يمكن إنشاء Build وإضافة القطع الفردية بالكميات المسموحة. |
| A7 — Compatibility | الـBuild يعرض PASS/ERROR/WARNING/UNKNOWN/INFO مع أسباب وmissing fields. |
| A8 — All products visible | الـPicker يسمح بإظهار incompatible products ولا يخفي المنتجات الناقصة. |
| A9 — Bundles | تظهر في Catalog ولا يمكن إضافتها للـBuilder. |
| A10 — Purchase | Shopping List تعرض روابط Sigma والتنبيه ولا توجد عملية دفع داخلية. |
| A11 — Failure safety | فشل run لا يحول الكتالوج بالكامل إلى Out of Stock. |
| A12 — Testability | توجد fixtures واختبارات لكل category وكل compatibility rule P0. |
| A13 — Documentation | README وOpenAPI وArchitecture وPRD متوافقة مع التنفيذ. |

## 28. خطة التنفيذ والـMilestones

| Milestone | النطاق | بوابة الخروج |
| --- | --- | --- |
| M0 — Repository/Foundation | Monorepo، TypeScript configs، shared contracts، Mongo connection، logging، CI basics. | التطبيقات تعمل وhealth endpoints ناجحة. |
| M1 — Sigma Discovery Research | Seeds، 30–50 fixtures تغطي الفئات، label inventory، robots/terms decision. | تقرير Data Discovery وfixtures معتمدة. |
| M2 — Raw Crawler | Discovery، pagination، fetch، retry، raw snapshots، run logs. | Full run raw بلا نشر canonical. |
| M3 — Classification & Normalization | Taxonomy، parsers، vocabularies، quality flags، schemas. | كل raw listing لها classification/result. |
| M4 — Canonical Catalog & Matching | Products، offers، aliases، review queue، publish. | Catalog API يعرض البيانات. |
| M5 — Search & Filters | Search index، autocomplete، facets، Angular catalog. | Search acceptance ناجح. |
| M6 — PC Builder | Build model، slots، add/remove، candidate picker. | Build قابل للحفظ والتعديل. |
| M7 — Compatibility Engine | Rules، reference data، status summary، tests. | Rule catalog P0 يعمل. |
| M8 — Shopping Flow & Bundles | Shopping list، outbound links، bundle pages. | End-to-end journey مكتملة. |
| M9 — Admin & Hardening | Runs dashboard، review screens، health thresholds، regression tests. | MVP release candidate. |
| M10 — Portfolio Polish | README، diagrams، demo dataset، screenshots، trade-offs. | عرض Portfolio جاهز. |

### 28.2 ترتيب التنفيذ داخل كل Milestone

- Contract/schema أولًا.
- Fixture/test.
- Minimal implementation.
- Failure behavior.
- UI/docs.
- Acceptance review.

## 29. المخاطر وخطة المعالجة

| ID | الخطر | الأثر | المعالجة |
| --- | --- | --- | --- |
| R1 | تغير HTML/Selectors | عالٍ | Fixtures، semantic label parsing، health thresholds، previous publish retained. |
| R2 | بيانات ناقصة للتوافق | عالٍ | UNKNOWN state، quality flags، reference data، manual enrichment محدود. |
| R3 | False product merge | عالٍ | Identifiers first، hard contradictions، conservative thresholds، review queue. |
| R4 | نطاق “كل القطع” يتوسع للملحقات | متوسط | Taxonomy واضحة: catalog-only vs builder-eligible. |
| R5 | تضخم Rule Engine | عالٍ | P0 rule catalog ثابت وTyped؛ لا DSL عام. |
| R6 | الاعتماد على Atlas Search | متوسط | SearchRepository abstraction وfallback للاختبارات. |
| R7 | قضايا الاستخدام/الشروط | عالٍ | robots/terms preflight، rate limit، links/attribution، disable switch. |
| R8 | أسعار قديمة | متوسط | lastCheckedAt، stale policy، disclaimers. |
| R9 | فتح روابط كثيرة للشراء | منخفض | Checklist وروابط فردية؛ لا auto-open tabs. |
| R10 | Over-engineering | عالٍ | Modular monolith، worker واحد، لا queue/distributed lock في P0. |
| R11 | فشل Scrape mass update | عالٍ | staged publish، suspicious run blocking، no reconcile on failure. |
| R12 | صعوبة ملء Reference compatibility | متوسط | ابدأ بالقواعد القابلة للاستخراج، سجل UNKNOWN، أضف reference تدريجيًا. |

## 30. سجل القرارات والأسئلة المؤجلة

### 30.1 قرارات معتمدة

| ID | القرار |
| --- | --- |
| ADR-001 | Sigma first؛ لا متجر ثانٍ قبل اكتمال الـvertical slice. |
| ADR-002 | كل متجر له ScraperAdapter مخصص. |
| ADR-003 | HTTP-first؛ Playwright fallback/investigation. |
| ADR-004 | Raw → Staging → Canonical → Publish. |
| ADR-005 | Products منفصلة عن Offers منذ البداية. |
| ADR-006 | كل القطع تظهر؛ builder eligibility منفصلة عن catalog visibility. |
| ADR-007 | Bundles منتج واحد وNOT_ELIGIBLE. |
| ADR-008 | Typed compatibility rules؛ لا executable expressions من DB. |
| ADR-009 | UNKNOWN حالة مستقلة وليست PASS. |
| ADR-010 | لا دفع داخلي؛ outbound links فقط. |
| ADR-011 | Modular monolith وWorker منفصل في نفس repository. |
| ADR-012 | لا Redis/BullMQ/Microservices في P0. |

### 30.2 أسئلة مؤجلة لا تمنع البدء

| ID | السؤال | القرار المؤقت |
| --- | --- | --- |
| Q1 | هل UI النهائية English-only أم bilingual؟ | الافتراض الحالي English-first؛ القرار قبل M5. |
| Q2 | هل نحفظ كل HTML response أم failures/samples فقط؟ | P0: raw extracted لكل صفحة، HTML failures/samples؛ يمكن تشغيل full archive config. |
| Q3 | ما مدة الاحتفاظ بالـraw snapshots؟ | في Portfolio يمكن الاحتفاظ بكل runs أو تطبيق retention بعد قياس الحجم. |
| Q4 | هل Build shareable في P0؟ | مصنف P1؛ لا يمنع core builder. |
| Q5 | هل Missing GPU مع no iGPU Error أم Warning؟ | في حالة Build مكتمل: Error؛ أثناء draft: Warning/Info. |
| Q6 | ما حدود المنتج “PC Hardware” الدقيقة في Sigma؟ | تُحسم في M1 عبر seed inventory وتوثق. |

## 31. الملحقات

### 31.1 مثال Quality Score

```text
Start at 100
- Missing MPN/GTIN (when commonly expected)        -10
- Missing critical compatibility field             -15 each
- Inferred critical field                           -5 each
- Conflicting critical field                        -30 each
- Missing price                                     -15
- Unknown availability                               -5
Minimum score = 0

compatibilityCompleteness = known critical fields / expected critical fields * 100
```

### 31.2 مثال Compatibility response

```json
{
  "buildStatus": "INVALID",
  "summary": { "pass": 8, "error": 1, "warning": 2, "unknown": 1, "info": 3 },
  "results": [
    {
      "ruleCode": "CMP-CPU-MB-001",
      "status": "ERROR",
      "title": "CPU socket mismatch",
      "message": "The CPU uses AM5 while the motherboard uses LGA1700.",
      "affectedSelections": ["cpu-1", "mb-1"],
      "evidence": [
        { "selectionId": "cpu-1", "field": "socket", "value": "AM5" },
        { "selectionId": "mb-1", "field": "socket", "value": "LGA1700" }
      ],
      "missingFields": [],
      "suggestions": ["Choose an AM5 motherboard or replace the CPU."]
    }
  ]
}
```

### 31.3 Glossary

| المصطلح | التعريف |
| --- | --- |
| Canonical Product | تمثيل موحد للقطعة مستقل عن اسم المتجر. |
| Store Listing | السجل المستخرج من صفحة متجر محدد. |
| Offer | السعر والمخزون والرابط الخاص بمتجر لمنتج canonical. |
| Raw Snapshot | البيانات قبل التوحيد. |
| Normalization | تحويل النصوص والوحدات إلى schema متناسقة. |
| Product Matching | تحديد أن Listing تشير إلى Product موجود. |
| Fingerprint | مجموعة خصائص تحدد هوية فئة معينة. |
| Facet | فلتر مع قيم وعدد نتائج. |
| Hard contradiction | اختلاف يمنع دمج المنتجات أو يثبت عدم التوافق. |
| Stale Offer | عرض لم يظهر مؤخرًا لكن لم يُحكم بعد أنه unavailable. |
| Reference Data | بيانات يدوية/موثقة تدعم قواعد التوافق. |
| Vertical Slice | تنفيذ كامل من المصدر إلى الواجهة لنطاق صغير قبل التوسع. |

### 31.4 مصادر البحث المرجعية

| ID | المصدر | الرابط |
| --- | --- | --- |
| R1 | Sigma Computer — Bundles | https://www.sigma-computer.com/en/bundles |
| R2 | Sigma Computer — Product page with structured specifications | https://sigma-computer.com/en/item?id=adata-legend-860-1tb-m2-pcie-nvme-gen-40x4-gwlvyaup2vbn |
| R3 | Sigma Computer — Case product with dimensions and clearances | https://sigma-computer.com/en/item?id=apnx-v2-black-mid-tower-case-ygnewhhgybuc |
| R4 | Crawlee — CheerioCrawler guide | https://crawlee.dev/js/docs/guides/cheerio-crawler-guide |
| R5 | Crawlee — Request storage/queue | https://crawlee.dev/js/docs/guides/request-storage |
| R6 | Playwright — Network monitoring | https://playwright.dev/docs/network |
| R7 | Playwright — Locators and auto-waiting | https://playwright.dev/docs/locators |
| R8 | MongoDB — Schema validation | https://www.mongodb.com/docs/manual/core/schema-validation/ |
| R9 | MongoDB — Atomicity and consistency | https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/ |
| R10 | MongoDB Search — Autocomplete | https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/autocomplete/ |
| R11 | RFC 9309 — Robots Exclusion Protocol | https://www.rfc-editor.org/info/rfc9309/ |
| R12 | Google Merchant Center — Unique product identifiers | https://support.google.com/merchants/answer/160161?hl=en |
| R13 | Node.js — Fetch API with Undici | https://nodejs.org/learn/getting-started/fetch |

### 31.5 Baseline declaration

> **Baseline:** هذه الوثيقة تمثل Baseline الإصدار 1.0. يمكن بدء تحليل الـSigma DOM، إنشاء fixtures، وتصميم الـschemas بناءً عليها مباشرة. أي Feature أو قرار يناقض هذه الوثيقة يحتاج ADR أو إصدار PRD جديد قبل دمجه في نطاق الـMVP.
