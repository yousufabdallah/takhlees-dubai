import { TRX_STATUS, TRX_STATUS_TONE } from "@/lib/domain";

export type ServiceStatus = {
  id: string;
  type_id: string;
  name: string;
  name_en: string | null;
  color: string;
  sort_order: number;
  is_final: boolean;
};

/** Prefix used when a transaction stores a service-specific status. */
export const CUSTOM_PREFIX = "cs:";

export const STATUS_COLORS: { value: string; label: string; tone: string }[] = [
  { value: "muted", label: "رمادي", tone: "bg-muted text-muted-foreground" },
  { value: "primary", label: "أزرق", tone: "bg-primary/12 text-primary" },
  { value: "warning", label: "برتقالي", tone: "bg-warning/20 text-warning-foreground" },
  { value: "gov", label: "حكومي", tone: "bg-gov/15 text-gov" },
  { value: "success", label: "أخضر", tone: "bg-success/15 text-success" },
  { value: "destructive", label: "أحمر", tone: "bg-destructive/12 text-destructive" },
];

export function colorTone(color: string): string {
  return STATUS_COLORS.find((c) => c.value === color)?.tone ?? STATUS_COLORS[0]!.tone;
}

export function isCustom(status: string): boolean {
  return status.startsWith(CUSTOM_PREFIX);
}

export function customId(status: string): string {
  return status.slice(CUSTOM_PREFIX.length);
}

export function statusValue(s: ServiceStatus): string {
  return `${CUSTOM_PREFIX}${s.id}`;
}

/** Options to show for a transaction: service-specific ones when defined, else defaults. */
export function statusOptions(
  typeId: string | null,
  statuses: ServiceStatus[],
  lang: "ar" | "en",
): { value: string; label: string; tone: string }[] {
  const custom = typeId ? statuses.filter((s) => s.type_id === typeId) : [];
  if (custom.length > 0)
    return custom
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        value: statusValue(s),
        label: (lang === "en" && s.name_en) || s.name,
        tone: colorTone(s.color),
      }));
  return Object.entries(TRX_STATUS).map(([k, v]) => ({
    value: k,
    label: v,
    tone: TRX_STATUS_TONE[k] ?? "bg-muted text-muted-foreground",
  }));
}

export function statusLabel(
  status: string,
  statuses: ServiceStatus[],
  lang: "ar" | "en",
): { label: string; tone: string } {
  if (isCustom(status)) {
    const s = statuses.find((x) => x.id === customId(status));
    if (s)
      return { label: (lang === "en" && s.name_en) || s.name, tone: colorTone(s.color) };
    return { label: "—", tone: "bg-muted text-muted-foreground" };
  }
  return {
    label: TRX_STATUS[status] ?? status,
    tone: TRX_STATUS_TONE[status] ?? "bg-muted text-muted-foreground",
  };
}

export function isFinalStatus(status: string, statuses: ServiceStatus[]): boolean {
  if (isCustom(status)) return statuses.find((x) => x.id === customId(status))?.is_final ?? false;
  return status === "completed";
}
