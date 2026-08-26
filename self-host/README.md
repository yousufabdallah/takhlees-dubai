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

## ملاحظات

- داخل محرر Lovable ستبقى المعاينة مربوطة بـ Lovable Cloud؛ الفصل الفعلي يتم في نسختك المستضافة ذاتياً.
- خذ نسخة احتياطية دورية: `pg_dump "$DB_URL" > backup-$(date +%F).sql`
- ملفات المرفقات في Storage (bucket: `documents`) تُنقل يدوياً عبر Studio أو Supabase CLI.
