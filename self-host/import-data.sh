#!/usr/bin/env bash
# استيراد البيانات المصدَّرة إلى قاعدة بيانات Supabase المستضافة ذاتياً.
# الاستخدام:
#   export DB_URL="postgresql://postgres:PASSWORD@localhost:5432/postgres"
#   ./import-data.sh
set -euo pipefail

: "${DB_URL:?يجب تعيين متغير DB_URL برابط قاعدة البيانات}"
cd "$(dirname "$0")/data"

# الترتيب مهم بسبب المفاتيح الأجنبية
TABLES=(
  gov_entities transaction_types clients employees suppliers accounts
  chart_of_accounts office_settings profiles user_roles
  transactions transaction_items invoices payments expenses
  payroll_entries journal_entries journal_lines transfers withdrawals documents
)

for t in "${TABLES[@]}"; do
  if [ -s "$t.csv" ]; then
    echo "استيراد $t ..."
    psql "$DB_URL" -q -c "\copy public.$t from '$t.csv' with (format csv, header)"
  fi
done

echo "تم الاستيراد بنجاح."
