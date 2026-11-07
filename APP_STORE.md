# رفع «المحافظ» على الآب ستور

اللعبة صارت جاهزة كتطبيق آيفون وآيباد. هذا الملف يشرح كل خطوة، من حساب آبل إلى أول تحديث.

## ما الذي تم تجهيزه في المشروع

| الملف / المجلد | ما هو |
|---|---|
| `app/` | نسخة اللعبة الخاصة بالتطبيق (الخط العربي مضمّن، تعمل بدون إنترنت) |
| `vite.app.config.ts` | بناء نسخة التطبيق في `dist-app/` |
| `capacitor.config.ts` | إعدادات التطبيق: الاسم «المحافظ»، المعرّف `com.sulimanobead.almohafez`، شاشة البداية، التحديث المباشر |
| `ios/` | مشروع Xcode كامل (آيفون وآيباد، iOS 15 فأحدث) مع الأيقونة وشاشة البداية |
| `src/native/native.ts` | ربط اللعبة بالآيفون: حفظ دائم للمدينة، اهتزاز خفيف عند البناء، شريط الحالة |
| `codemagic.yaml` | بناء ورفع سحابي لمن لا يملك جهاز ماك |
| `public/privacy.html` | صفحة سياسة الخصوصية (آبل تطلب رابطها) |
| `app/store/` | صور الآب ستور جاهزة بمقاسات آيفون وآيباد |

### حفظ المدينة
اللعبة تحفظ في ذاكرة المتصفح، وiOS قد يمسحها إذا امتلأ الجهاز. لذلك كل حفظ يُنسخ أيضاً إلى الذاكرة الدائمة للتطبيق ويُسترجع تلقائياً عند الفتح، فلا يخسر اللاعب مدينته.

## الأوامر

```bash
npm run app:build   # يبني نسخة التطبيق في dist-app/
npm run app:sync    # يبني ثم ينسخها داخل مشروع iOS (شغّله بعد أي تعديل)
npm run app:open    # يفتح المشروع في Xcode (على الماك فقط)
```

## الخطوة ١: حساب مطوّر آبل
1. سجّل في [Apple Developer Program](https://developer.apple.com/programs/) (اشتراك سنوي).
2. في [App Store Connect](https://appstoreconnect.apple.com) → «التطبيقات» → «+» → «تطبيق جديد»:
   - المنصة: iOS
   - الاسم: **المحافظ** (إن كان محجوزاً جرّب «المحافظ: مدينة الكويت»)
   - اللغة الأساسية: العربية
   - معرّف الحزمة (Bundle ID): **com.sulimanobead.almohafez** — سجّله أولاً في Certificates, Identifiers & Profiles إن لم يظهر.
   - SKU: almohafez-001

> إن اخترت معرّفاً آخر، غيّره في `capacitor.config.ts` (`appId`) ثم شغّل `npm run app:sync`، وفي Xcode → Signing & Capabilities.

## الخطوة ٢ (أ): البناء على جهاز ماك
1. ثبّت Xcode من متجر الماك، وNode.js 22.
2. في مجلد المشروع:
   ```bash
   npm ci
   npm run app:sync
   npm run app:open
   ```
3. في Xcode: اختر هدف **App** → Signing & Capabilities → فعّل *Automatically manage signing* واختر فريقك (Team).
4. جرّب على المحاكي أو على جهازك (اضغط ▶).
5. للرفع: Product → Archive → Distribute App → App Store Connect → Upload.

## الخطوة ٢ (ب): البناء السحابي بدون ماك (Codemagic)
1. أنشئ حساباً في [codemagic.io](https://codemagic.io) واربط مستودع GitHub.
2. في App Store Connect → Users and Access → Integrations → **App Store Connect API**: أنشئ مفتاحاً بصلاحية *App Manager* ونزّل ملف `.p8`.
3. في Codemagic → Team settings → Integrations → Developer Portal: أضف المفتاح وسمّه **codemagic**.
4. افتح `codemagic.yaml` وضع رقم `APP_STORE_APPLE_ID` (رقم Apple ID للتطبيق، من App Store Connect → App Information).
5. شغّل workflow **Al-Muhafiz iOS (App Store)**: يبني التطبيق ويوقّعه ويرفعه إلى TestFlight تلقائياً.

## الخطوة ٣: صفحة التطبيق في الآب ستور
- **سياسة الخصوصية:** غيّر `CONTACT_EMAIL` في `public/privacy.html` إلى بريدك، ثم انشر الموقع؛ الرابط يكون `https://<موقعك>/privacy.html`.
- **خصوصية التطبيق (App Privacy):** اختر *Data Not Collected* — اللعبة لا تجمع أي بيانات.
- **التصنيف العمري:** أجب «لا» على كل الأسئلة ← غالباً **4+**. (الأزمات والكوارث في اللعبة رسوم بسيطة بلا عنف.)
- **الفئة:** Games → Simulation، والثانوية Strategy.
- **الصور:** في `app/store/` — مقاس آيفون 6.9 إنش (1290×2796) وآيباد 13 إنش (2048×2732).
- **الأيقونة:** موجودة في المشروع؛ نسخة 1024×1024 في `app/icon-1024.png`.

### نص صفحة المتجر (عربي)
**العنوان الفرعي:** ابنِ الكويت من حيّك إلى الدولة

**الوصف:**
ابدأ مساعداً للمختار في حي من أحياء الكويت، وابنِ طريقك إلى منصب المحافظ.

• خريطة الكويت الحقيقية كاملة: من العبدلي إلى الخيران، مع جزيرة بوبيان وفيلكا — ابنِ الجسور إليها.
• معالم الكويت: أبراج الكويت، برج الحمراء، برج التجارية، برج البنك الوطني، حديقة الشهيد، المباركية، الأفنيوز، مركز جابر الثقافي.
• اقتصاد حقيقي: ضرائب، رسوم معيشة، قروض وتمويل إسلامي، ودائع، سندات وصكوك، تأمين.
• سوق أسهم بشركات اللعبة: اشترِ حصصاً واربح توزيعات سنوية.
• مجلس الإدارة: أعطِ أوامرك لمدراء الإدارات، أو سلّمهم المدينة في اللعب الآلي.
• مشاريع كبرى: مطار، سكة حديد، ميناء مبارك، مصفاة الزور، مدينة الحرير.
• ميناء ومصافٍ ومصانع، وكوارث وأزمات عالمية، وآراء الناس وشكاواهم.
• عربي وإنجليزي، يعمل بدون إنترنت، بلا إعلانات ولا جمع بيانات.

**الكلمات المفتاحية (100 حرف):** الكويت,مدينة,محاكاة,بناء,اقتصاد,استراتيجية,محافظ,أبراج,بوبيان,فيلكا

### Store text (English)
**Subtitle:** Build Kuwait, block by block

**Description:**
Start as the mukhtar's assistant in a Kuwaiti neighbourhood and rise to governor.
• The whole real map of Kuwait, from Abdali to Al-Khiran, with Bubiyan and Failaka — build bridges to them.
• Kuwait's landmarks: Kuwait Towers, Al Hamra, Al Tijaria, NBK Tower, Al Shaheed Park, Mubarakiya, The Avenues, Jaber Cultural Centre.
• A real economy: taxes, living fees, loans and Islamic finance, deposits, bonds and sukuk, insurance.
• A stock market of the game's companies with yearly dividends.
• A board of directors you can command, or hand the city to on autopilot.
• Mega projects: airport, railway, Mubarak port, Al-Zour refinery, Silk City.
• Arabic and English, works offline, no ads, no data collected.

**Keywords:** kuwait,city,builder,simulation,economy,strategy,governor,towers,tycoon,sim

## الخطوة ٤: المراجعة
- أرسل النسخة للمراجعة من App Store Connect. المراجعة عادة يوم إلى يومين.
- في ملاحظات المراجع اكتب: *"A city-building simulation of Kuwait. No account or login needed. All companies, banks and stocks are fictional and use in-game currency only."*

## التحديثات بعد النشر

### الطريقة العادية (كل تعديل)
1. عدّل اللعبة كالمعتاد.
2. ارفع رقم النسخة في Xcode (مثلاً 1.0 → 1.1)، أو اترك Codemagic يرفع رقم البناء تلقائياً.
3. `npm run app:sync` ثم Archive وUpload (أو شغّل Codemagic).
4. أرسل للمراجعة.

### التحديث المباشر (بدون مراجعة آبل)
التطبيق فيه مكتبة **Capgo** للتحديث المباشر، وهي متوقفة حتى تفعّلها:
1. أنشئ حساباً في [capgo.app](https://capgo.app) (خدمة مدفوعة بفترة تجربة).
2. في المشروع:
   ```bash
   npx @capgo/cli init
   ```
3. في `capacitor.config.ts` غيّر `CapacitorUpdater.autoUpdate` إلى `true`، ثم `npm run app:sync` وارفع نسخة جديدة للآب ستور **مرة واحدة**.
4. بعدها، أي تعديل على اللعبة:
   ```bash
   npm run app:build
   npx @capgo/cli bundle upload
   ```
   ويصل للاعبين خلال دقائق، بدون مراجعة.

> آبل تسمح بالتحديث المباشر للمحتوى والإصلاحات ما دام التطبيق لا يغيّر غرضه الأساسي. أي إضافة تحتاج كود آيفون أصلياً جديداً (إشعارات، مشتريات داخل التطبيق…) تمرّ بالمراجعة العادية.
