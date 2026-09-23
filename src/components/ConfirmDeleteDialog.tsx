import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** نتيجة فحص السجلات المرتبطة: سبب المنع إن وُجد، أو قائمة بما سيُحذف، وملاحظة اختيارية بالأثر */
export type DeleteCheck = { blockedReason: string | null; willDelete: string[]; note?: string };

/**
 * نافذة تأكيد حذف عامة: تفحص السجلات المرتبطة عند الفتح (`check`)،
 * وتمنع الحذف إذا أعاد الفحص سبباً، ثم تنفّذ `onConfirm`.
 * `targetKey` يعيد الفحص عند تغيير السجل المستهدف؛ القيمة null تغلق النافذة.
 */
export function ConfirmDeleteDialog({
  targetKey,
  title,
  check,
  onConfirm,
  onClose,
}: {
  targetKey: string | null;
  title: string;
  check: () => Promise<DeleteCheck>;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "en" ? en : ar);
  const [result, setResult] = useState<DeleteCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setResult(null);
    setError(null);
    if (!targetKey) return;
    let alive = true;
    check()
      .then((r) => alive && setResult(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // الفحص يُعاد فقط عند تغيّر السجل المستهدف، لا عند كل إعادة رسم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  const blocked = !!result?.blockedReason;

  async function confirm() {
    if (!result || blocked) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog
      open={!!targetKey}
      onOpenChange={(v) => {
        if (!v && !deleting) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {error ? (
                <p className="text-destructive">{error}</p>
              ) : !result ? (
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {tr("جارٍ فحص البيانات المرتبطة…", "Checking related records…")}
                </p>
              ) : result.blockedReason ? (
                <p className="surface bg-destructive/10 p-3 text-destructive">
                  {result.blockedReason}
                </p>
              ) : (
                <>
                  <p>
                    {tr("سيتم حذف ما يلي نهائياً:", "The following will be permanently deleted:")}
                  </p>
                  <ul className="list-disc space-y-1 ps-5">
                    {result.willDelete.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {result.note && <p>{result.note}</p>}
                  <p className="text-xs">
                    {tr("لا يمكن التراجع عن هذا الإجراء.", "This action cannot be undone.")}
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{tr("إلغاء", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting || !result || blocked}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {deleting && <Loader2 className="size-4 animate-spin" />}
            {tr("حذف نهائي", "Delete permanently")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
