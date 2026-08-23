import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "gov" | "destructive";
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    default: "text-primary bg-primary/10",
    success: "text-success bg-success/12",
    warning: "text-warning-foreground bg-warning/20",
    gov: "text-gov bg-gov/12",
    destructive: "text-destructive bg-destructive/12",
  };
  return (
    <div className="surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="num mt-1 truncate text-xl font-bold">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <span className={cn("flex size-9 items-center justify-center rounded-lg", tones[tone])}>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

export function Badge({ label, tone }: { label: string; tone?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone ?? "bg-secondary text-secondary-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="p-10 text-center text-sm text-muted-foreground">{text}</div>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b bg-muted/60 px-4 py-3 text-start text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b px-4 py-3 align-middle", className)}>{children}</td>;
}
