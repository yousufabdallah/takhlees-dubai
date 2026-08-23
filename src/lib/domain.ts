export const AED = "د.إ";

export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${AED}`;
}

export function dateAr(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB");
}

export const CLIENT_STATUS: Record<string, string> = {
  new: "جديد",
  active: "مستمر",
  completed: "مكتمل",
};

export const CLIENT_TYPE: Record<string, string> = {
  individual: "فرد",
  company: "شركة",
};

export const TRX_STATUS: Record<string, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  waiting_client: "بانتظار العميل",
  waiting_gov: "بانتظار جهة حكومية",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const TRX_STATUS_TONE: Record<string, string> = {
  new: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/12 text-primary",
  waiting_client: "bg-warning/20 text-warning-foreground",
  waiting_gov: "bg-gov/15 text-gov",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/12 text-destructive",
};

export const INVOICE_STATUS: Record<string, string> = {
  unpaid: "غير مدفوعة",
  partial: "مدفوعة جزئياً",
  paid: "مدفوعة",
  refunded: "مستردة",
};

export const INVOICE_STATUS_TONE: Record<string, string> = {
  unpaid: "bg-destructive/12 text-destructive",
  partial: "bg-warning/20 text-warning-foreground",
  paid: "bg-success/15 text-success",
  refunded: "bg-muted text-muted-foreground",
};

export const PAYMENT_METHODS: Record<string, string> = {
  cash: "كاش",
  transfer: "تحويل بنكي",
  link: "رابط دفع",
  card: "بطاقة",
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  rent: "إيجار",
  salaries: "رواتب",
  telecom: "اتصالات",
  fuel: "بنزين ومواصلات",
  gov_fees: "رسوم حكومية للمكتب",
  purchases: "مشتريات",
  marketing: "تسويق",
  petty: "مصروفات نثرية",
  other: "مصاريف أخرى",
};

export const PAYROLL_TYPES: Record<string, string> = {
  salary: "راتب",
  commission: "عمولة",
  advance: "سلفة",
  deduction: "خصم",
  bonus: "حافز",
};

export const ACCOUNT_TYPES: Record<string, string> = {
  cash: "صندوق",
  bank: "بنك",
};

export const ACCOUNT_CLASSES: Record<string, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

/**
 * الرسوم الحكومية أمانات تُدفع مباشرة للجهة الحكومية،
 * لذلك تُستبعد من أرصدة الصندوق والبنوك ومن صافي النقد.
 * التوزيع: كل دفعة تُخصم أولاً من الرسوم الحكومية ثم من أتعاب المكتب.
 */
export type PaymentLike = {
  id: string;
  invoice_id: string;
  account_id: string | null;
  amount: number | string;
};

export function splitPayments(
  payments: PaymentLike[],
  govFeesByInvoice: Record<string, number>,
): Map<string, { gov: number; office: number }> {
  const remaining = new Map<string, number>();
  const out = new Map<string, { gov: number; office: number }>();
  for (const p of payments) {
    const amount = Number(p.amount ?? 0);
    if (!remaining.has(p.invoice_id)) {
      remaining.set(p.invoice_id, Number(govFeesByInvoice[p.invoice_id] ?? 0));
    }
    const left = remaining.get(p.invoice_id) ?? 0;
    const gov = Math.min(amount, Math.max(left, 0));
    remaining.set(p.invoice_id, left - gov);
    out.set(p.id, { gov, office: amount - gov });
  }

  return out;
}
