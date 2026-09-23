export type AppRole = "admin" | "accountant" | "staff";

export const ROLES: AppRole[] = ["admin", "accountant", "staff"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  accountant: "محاسب",
  staff: "موظف",
};

export const ROLE_DESC: Record<AppRole, string> = {
  admin: "صلاحية كاملة على جميع أقسام النظام والإعدادات والصلاحيات.",
  accountant: "الفواتير والمصروفات والخزينة والقيود والتقارير، مع الاطلاع على العملاء والمعاملات.",
  staff: "العملاء والمعاملات والفواتير فقط.",
};

export const ROLE_TONE: Record<AppRole, string> = {
  admin: "bg-primary/12 text-primary",
  accountant: "bg-gov/15 text-gov",
  staff: "bg-secondary text-secondary-foreground",
};

/** المسارات المسموحة لكل صلاحية */
export const ROUTE_ROLES: Record<string, AppRole[]> = {
  "/dashboard": ["admin", "accountant", "staff"],
  "/clients": ["admin", "accountant", "staff"],
  "/transactions": ["admin", "accountant", "staff"],
  "/invoices": ["admin", "accountant", "staff"],
  "/gov-entities": ["admin", "accountant"],
  "/services": ["admin", "accountant"],
  "/expenses": ["admin", "accountant"],
  "/treasury": ["admin", "accountant"],
  "/employees": ["admin", "accountant"],
  "/accounting": ["admin", "accountant"],
  "/reports": ["admin", "accountant"],
  "/settings": ["admin", "accountant", "staff"],
};

export function canAccess(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  const allowed = ROUTE_ROLES[path];
  return allowed ? allowed.includes(role) : role === "admin";
}

/** تعديل المعاملة كاملة (العميل والخدمات والرسوم) — تغيير الحالة متاح للجميع من الجدول */
export function canEditTransaction(role: AppRole | null): boolean {
  return role === "admin" || role === "accountant";
}

/** حذف المعاملة — مدير النظام فقط (مفروض أيضاً بسياسة RLS في قاعدة البيانات) */
export function canDeleteTransaction(role: AppRole | null): boolean {
  return role === "admin";
}

/** حذف العميل — مدير النظام فقط (مفروض أيضاً بسياسة RLS). التعديل متاح لكل من يدخل قسم العملاء */
export function canDeleteClient(role: AppRole | null): boolean {
  return role === "admin";
}

/**
 * حذف الموظفين والموردين — مدير النظام فقط (مفروض أيضاً بسياسة RLS).
 * التعديل وإيقاف الموظف متاحان لكل من يدخل القسم (مدير، محاسب).
 */
export function canDeleteStaffOrSupplier(role: AppRole | null): boolean {
  return role === "admin";
}

/** صلاحية إضافة/تعديل/حذف الجهات الحكومية والخدمات */
export function canManageCatalog(role: AppRole | null): boolean {
  return role === "admin" || role === "accountant";
}
