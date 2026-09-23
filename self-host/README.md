# تشغيل قاعدة البيانات على سيرفرك الخاص

هذه الحزمة تنقل قاعدة بيانات النظام بالكامل من Lovable Cloud إلى **Supabase مستضاف ذاتياً** على سيرفر مكتبك أو VPS خاص بك، بحيث تبقى كل البيانات عندك.

## المحتويات

| الملف | الوصف |
|------|-------|
| `schema.sql` | هيكل قاعدة البيانات كاملاً (الجداول، الصلاحيات، سياسات الحماية، الدوال، المشغلات) |
| `data/*.csv` | نسخة من بياناتك الحالية (عملاء، معاملات، فواتير، خدمات، جهات حكومية...) |
| `import-data.sh` | سكربت لاستيراد البيانات إلى السيرفر الجديد |

## الخطوات

### 1) تثبيت Supabase على سيرفرك

على سيرفر فيه Docker:

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# عدّل .env: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SITE_URL
docker compose up -d
```

بعد التشغيل تحصل على:
- واجهة Supabase Studio: `http://<سيرفرك>:8000`
- رابط API: `http://<سيرفرك>:8000`
- مفتاح `ANON_KEY` من ملف `.env`

> مهم: لا تستخدم القيم الافتراضية في `.env` — ولّد `JWT_SECRET` و`ANON_KEY` و`SERVICE_ROLE_KEY` جديدة، وفعّل HTTPS عبر Nginx/Caddy قبل الفتح للإنترنت.

### 2) إنشاء الهيكل

```bash
psql "postgresql://postgres:PASSWORD@<سيرفرك>:5432/postgres" -f schema.sql
```

> هذه الخطوة لقاعدة بيانات جديدة فارغة فقط. إذا كانت عندك قاعدة قائمة فراجع قسم [ترقية تثبيت قائم](#ترقية-تثبيت-قائم).

### 3) إنشاء حسابات الموظفين

الحسابات لا تُنقل بكلمات مرورها (مشفّرة). أنشئ المستخدمين من Supabase Studio → Authentication → Add user، ثم عدّل ملفات `data/profiles.csv` و`data/user_roles.csv` لتطابق معرّفات المستخدمين الجديدة (عمود `id` / `user_id`).

### 4) استيراد البيانات

```bash
export DB_URL="postgresql://postgres:PASSWORD@<سيرفرك>:5432/postgres"
./import-data.sh
```

### 5) توجيه التطبيق إلى سيرفرك

النظام يقرأ الاتصال من متغيرات البيئة، فما تحتاج تعديل أي كود. عيّن في بيئة التشغيل:

```
VITE_SUPABASE_URL=https://db.your-office.ae
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY الخاص بك>
SUPABASE_URL=https://db.your-office.ae
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY الخاص بك>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY الخاص بك>
```

بعدها تبني نسخة من المشروع وتشغّلها على سيرفرك (أو أي استضافة تختارها) وتكون كل البيانات محلياً عندك.

## ترقية تثبيت قائم

ملف `schema.sql` المحدَّث مخصص **للتثبيت الجديد فقط** (قاعدة بيانات فارغة).

> ⚠️ **لا تُعِد تشغيل `schema.sql` كاملاً على قاعدة بيانات قائمة.** سيفشل عند محاولة إنشاء الجداول الموجودة أصلاً، وقد يترك القاعدة في حالة غير مكتملة.

إذا كانت قاعدتك منشأة من نسخة سابقة من `schema.sql`، طبّق بدلاً من ذلك ملفات الـ migrations العشرة التالية فقط من المجلد `supabase/migrations/`، **بهذا الترتيب الزمني**:

| # | الملف | المحتوى |
|---|------|-------|
| 1 | `20260825214552_cdf12758-e075-408e-bc97-17a5dff24a97.sql` | جدول حالات الخدمات `service_statuses` |
| 2 | `20260826090407_7232c5be-6682-4771-9053-6068322616e1.sql` | جدولا إعدادات البريد `email_settings` وسجل الإشعارات `notification_log` |
| 3 | `20260826130308_ac29a71a-c118-4884-8a0b-9752789778b1.sql` | عمود العدد `qty` في `transaction_items` |
| 4 | `20260923120000_transactions_delete_guard.sql` | حماية المعاملات والفواتير المدفوعة، والتعديل الذري للمعاملة |
| 5 | `20260923130000_clients_delete_admin_only.sql` | حذف العملاء لمدير النظام فقط |
| 6 | `20260923140000_employees_suppliers_delete_guard.sql` | حذف الموظفين والموردين لمدير النظام فقط، ومنع حذف موظف له رواتب |
| 7 | `20260923150000_invoices_payments_guard.sql` | حماية مبالغ الفواتير والدفعات من التعديل المباشر |
| 8 | `20260924120000_treasury_accounts_guard.sql` | تعديل حسابات الخزينة وإيقافها، ومنع استخدام الحسابات الموقوفة في حركات جديدة |
| 9 | `20260925120000_withdrawals_insert_finance_only.sql` | منع الموظفين من تسجيل السحوبات: الإضافة لمدير النظام والمحاسب فقط |
| 10 | `20260926120000_withdrawals_select_finance_only.sql` | منع الموظفين من الاطلاع على السحوبات: العرض لمدير النظام والمحاسب فقط |

الملفات 1–3 كانت ناقصة من `schema.sql` السابق، والملفات 4–10 هي تحديثات الحماية الجديدة للإنتاج. إذا كنت قد طبّقت بعض هذه الملفات سابقاً فأكمل من أول ملف لم تطبّقه بالترتيب نفسه (مثلاً: إذا طبّقت 1–8 فطبّق 9 و10 فقط).

من المجلد الرئيسي للمشروع:

```bash
export DB_URL="postgresql://postgres:PASSWORD@<سيرفرك>:5432/postgres"
pg_dump "$DB_URL" > backup-before-upgrade-$(date +%F).sql

for f in \
  supabase/migrations/20260825214552_cdf12758-e075-408e-bc97-17a5dff24a97.sql \
  supabase/migrations/20260826090407_7232c5be-6682-4771-9053-6068322616e1.sql \
  supabase/migrations/20260826130308_ac29a71a-c118-4884-8a0b-9752789778b1.sql \
  supabase/migrations/20260923120000_transactions_delete_guard.sql \
  supabase/migrations/20260923130000_clients_delete_admin_only.sql \
  supabase/migrations/20260923140000_employees_suppliers_delete_guard.sql \
  supabase/migrations/20260923150000_invoices_payments_guard.sql \
  supabase/migrations/20260924120000_treasury_accounts_guard.sql \
  supabase/migrations/20260925120000_withdrawals_insert_finance_only.sql \
  supabase/migrations/20260926120000_withdrawals_select_finance_only.sql
do
  echo "==> $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$f" || break
done
```

- كل ملف يُطبَّق في عملية واحدة: عند أي خطأ يُلغى الملف بالكامل ويتوقف التنفيذ. عالج الخطأ ثم أكمل من الملف الذي فشل، دون إعادة الملفات التي نجحت.
- إذا فشل أحد الملفات 1–3 بخطأ `already exists` فهو مطبَّق مسبقاً على قاعدتك؛ تخطَّه وأكمل بالذي بعده.
- طبّق الملفات العشرة **قبل** تشغيل النسخة الجديدة من التطبيق، لأن تعديل المعاملات يعتمد على الدالة التي يضيفها الملف 4.

## ملاحظات

- داخل محرر Lovable ستبقى المعاينة مربوطة بـ Lovable Cloud؛ الفصل الفعلي يتم في نسختك المستضافة ذاتياً.
- خذ نسخة احتياطية دورية: `pg_dump "$DB_URL" > backup-$(date +%F).sql`
- ملفات المرفقات في Storage (bucket: `documents`) تُنقل يدوياً عبر Studio أو Supabase CLI.
