import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { dateAr, INVOICE_STATUS, money, PAYMENT_METHODS } from "@/lib/domain";
import type { OfficeSettings } from "@/lib/office";
import officeLogo from "@/assets/office-logo.png.asset.json";
import officeStamp from "@/assets/office-stamp.jpg.asset.json";

export type InvoiceLang = "ar" | "en";

export type PrintInvoice = {
  invoice_no: string;
  issue_date: string;
  due_date: string | null;
  gov_fees: number;
  office_fees: number;
  discount: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  paid: number;
  status: string;
  notes: string | null;
  clients: { name: string; phone: string | null } | null;
  transactions: {
    ref_no: string;
    type_name: string;
    type_name_en?: string | null;
    gov_entity: string | null;
    gov_entity_en?: string | null;
  } | null;
};

export type PrintItem = {
  id: string;
  gov_entity: string | null;
  gov_entity_en?: string | null;
  type_name: string;
  type_name_en?: string | null;
  gov_fee: number;
  office_fee: number;
};

export type PrintPayment = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  reference: string | null;
};

const INVOICE_STATUS_EN: Record<string, string> = {
  unpaid: "Unpaid",
  partial: "Partially paid",
  paid: "Paid",
  refunded: "Refunded",
};

const PAYMENT_METHODS_EN: Record<string, string> = {
  cash: "Cash",
  transfer: "Bank transfer",
  link: "Payment link",
  card: "Card",
};

const T = {
  ar: {
    docTitle: "فاتورة ضريبية",
    docTitleAlt: "TAX INVOICE",
    invoiceNo: "رقم الفاتورة",
    issueDate: "تاريخ الإصدار",
    dueDate: "تاريخ الاستحقاق",
    status: "الحالة",
    client: "بيانات العميل",
    trx: "بيانات المعاملة",
    idx: "#",
    item: "البيان",
    amount: "المبلغ",
    govLine: "رسوم حكومية (أمانات تُدفع للجهات الحكومية)",
    officeLine: "أتعاب المكتب",
    defaultService: "خدمة تخليص",
    subtotal: "المجموع قبل الخصم",
    discount: "الخصم",
    vat: "ضريبة القيمة المضافة",
    grand: "الإجمالي المستحق",
    paid: "المدفوع",
    due: "المتبقي",
    paymentsTitle: "سجل الدفعات",
    date: "التاريخ",
    method: "الطريقة",
    reference: "المرجع",
    notes: "ملاحظات",
    phone: "هاتف",
    license: "رقم الرخصة",
    trn: "الرقم الضريبي (TRN)",
    fine: "الرسوم الحكومية تُحصَّل لصالح الجهات الحكومية ولا تُحتسب ضمن دخل المكتب، ولا تخضع لضريبة القيمة المضافة.",
    officeSign: "توقيع المكتب",
    issuedBy: (n: string) => `هذه الفاتورة صادرة إلكترونياً من ${n}`,
    dash: "—",
  },
  en: {
    docTitle: "TAX INVOICE",
    docTitleAlt: "فاتورة ضريبية",
    invoiceNo: "Invoice No.",
    issueDate: "Issue date",
    dueDate: "Due date",
    status: "Status",
    client: "Client details",
    trx: "Transaction details",
    idx: "#",
    item: "Description",
    amount: "Amount",
    govLine: "Government fees (paid directly to authorities)",
    officeLine: "Service fees",
    defaultService: "Clearing service",
    subtotal: "Subtotal",
    discount: "Discount",
    vat: "VAT",
    grand: "Total due",
    paid: "Paid",
    due: "Balance",
    paymentsTitle: "Payments",
    date: "Date",
    method: "Method",
    reference: "Reference",
    notes: "Notes",
    phone: "Tel",
    license: "License No.",
    trn: "TRN",
    fine: "Government fees are collected on behalf of government authorities, are not office income and are not subject to VAT.",
    officeSign: "Office signature",
    clientSign: "Client signature",
    issuedBy: (n: string) => `This invoice was issued electronically by ${n}`,
    dash: "—",
  },
} as const;

export function InvoicePrint({
  office,
  invoice,
  payments,
  items = [],
  lang = "ar",
}: {
  office: OfficeSettings | null | undefined;
  invoice: PrintInvoice;
  payments: PrintPayment[];
  items?: PrintItem[];
  lang?: InvoiceLang;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const t = T[lang];
  const en = lang === "en";
  const remaining = Number(invoice.total) - Number(invoice.paid);
  const arName = office?.legal_name?.trim() || "مكتب تخليص المعاملات";
  const enName = office?.legal_name_en?.trim() || "";
  const name = en ? enName || arName : arName;
  const subName = en ? (enName ? arName : "") : enName;
  const serviceName = en
    ? invoice.transactions?.type_name_en || invoice.transactions?.type_name || t.defaultService
    : invoice.transactions?.type_name || t.defaultService;
  const entityName = en
    ? invoice.transactions?.gov_entity_en || invoice.transactions?.gov_entity || t.dash
    : invoice.transactions?.gov_entity || t.dash;
  const statusLabel = en
    ? (INVOICE_STATUS_EN[invoice.status] ?? invoice.status)
    : (INVOICE_STATUS[invoice.status] ?? invoice.status);
  const methodLabel = (m: string) =>
    en ? (PAYMENT_METHODS_EN[m] ?? m) : (PAYMENT_METHODS[m] ?? m);

  const amt = (v: number | string | null | undefined) =>
    en
      ? `${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`
      : money(v);

  type GroupRow = { service: string; gov_fee: number; office_fee: number };
  const groups: { entity: string; rows: GroupRow[] }[] = [];
  for (const it of items) {
    const entity =
      (en ? it.gov_entity_en || it.gov_entity : it.gov_entity) || t.dash;
    const service =
      (en ? it.type_name_en || it.type_name : it.type_name) || t.defaultService;
    let g = groups.find((x) => x.entity === entity);
    if (!g) {
      g = { entity, rows: [] };
      groups.push(g);
    }
    g.rows.push({
      service,
      gov_fee: Number(it.gov_fee) || 0,
      office_fee: Number(it.office_fee) || 0,
    });
  }

  type DisplayRow =
    | { kind: "entity"; index: number; entity: string }
    | { kind: "fee"; index: string; label: string; amount: number };
  const displayRows: DisplayRow[] = [];
  if (groups.length > 0) {
    groups.forEach((group, groupIndex) => {
      displayRows.push({ kind: "entity", index: groupIndex + 1, entity: group.entity });
      group.rows.forEach((row, rowIndex) => {
        const index = `${groupIndex + 1}.${rowIndex + 1}`;
        displayRows.push({ kind: "fee", index, label: `${row.service} — ${t.officeLine}`, amount: row.office_fee });
        if (Number(row.gov_fee) > 0) {
          displayRows.push({ kind: "fee", index: "", label: `${row.service} — ${t.govLine}`, amount: row.gov_fee });
        }
      });
    });
  } else {
    displayRows.push(
      { kind: "fee", index: "1", label: t.govLine, amount: invoice.gov_fees },
      { kind: "fee", index: "2", label: `${t.officeLine} — ${serviceName}`, amount: invoice.office_fees },
    );
  }

  const rowLimit = 10;
  const itemPages = Array.from(
    { length: Math.max(1, Math.ceil(displayRows.length / rowLimit)) },
    (_, index) => displayRows.slice(index * rowLimit, (index + 1) * rowLimit),
  );

  // التعديل 1: ترتيب الفاتورة من فوق، وتخصيص مسار الشعار /favicon.png وتكبيره
  const header = (
    <div className="pi-repeat-header">
      <header className="flex justify-between items-start w-full border-b-2 border-gray-200 pb-6 mb-6">
        <div className="text-right flex-1 pr-4">
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          {subName && <p className="text-lg text-gray-700 mt-1">{subName}</p>}
          <div className="text-sm text-gray-600 mt-3 space-y-1">
            {office?.phone && <p>{t.phone}: {office.phone}</p>}
            {office?.address && <p>{office.address}</p>}
            <p>
              {office?.email && <span>{office.email} | </span>}
              {office?.website && <span>{office.website}</span>}
            </p>
            <p>
              {office?.license_no && <span>{t.license}: {office.license_no} </span>}
              {office?.trn && <span>| {t.trn}: {office.trn}</span>}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {/* هنا خلينا مسار الشعار favicon وكبرنا الحجم بـ w-40 */}
          <img src="/favicon.png" alt={name} className="w-40 h-auto object-contain" />
        </div>
      </header>
      <div className="pi-doc">
        <p className="pi-doc-title">{t.docTitle}</p>
        <p className="pi-doc-title-en">{t.docTitleAlt}</p>
        <table className="pi-doc-table"><tbody>
          <tr><th>{t.invoiceNo}</th><td className="num">{invoice.invoice_no}</td></tr>
          <tr><th>{t.issueDate}</th><td className="num">{dateAr(invoice.issue_date)}</td></tr>
          <tr><th>{t.dueDate}</th><td className="num">{dateAr(invoice.due_date)}</td></tr>
          <tr><th>{t.status}</th><td>{statusLabel}</td></tr>
        </tbody></table>
      </div>
      <div className="pi-rule" />
    </div>
  );

  // التعديل 2: تنسيق منطقة الختم عشان تكون متسنترة بشكل جميل ومنظم
  const signBlock = (
    <div className="mt-12 flex justify-center w-full">
      <div className="flex flex-col items-center">
        <img src={officeStamp.url} alt="Stamp" className="w-32 h-auto object-contain mb-2" />
        <span className="font-bold text-lg border-t border-gray-400 pt-2 w-48 text-center">{t.officeSign}</span>
      </div>
    </div>
  );

  // التعديل 3: ضبط الفوتر
  const footer = (isLast: boolean) => (
    <footer className="pi-footer pi-repeat-footer mt-8">
      {isLast ? signBlock : (
        <div className="flex justify-center mt-4">
          <img src={officeStamp.url} alt="Stamp" className="w-24 opacity-50" />
        </div>
      )}
      <div className="text-center text-sm text-gray-500 mt-8 border-t border-gray-200 pt-4">
        {office?.invoice_footer && <p>{office.invoice_footer}</p>}
        <p>{t.fine}</p>
        <p className="mt-2 font-semibold text-gray-400">{t.issuedBy(name)}</p>
      </div>
    </footer>
  );

  if (!mounted) return null;

  return createPortal(
    <div className="print-invoice hidden" aria-hidden dir={en ? "ltr" : "rtl"} lang={lang}>
      {itemPages.map((pageRows, pageIndex) => {
        const firstPage = pageIndex === 0;
        const lastPage = pageIndex === itemPages.length - 1;
        return <section className="pi-sheet" key={`page-${pageIndex}`}>
          {header}
          <main className="pi-content">
      {firstPage && <section className="pi-parties">
        <div>
          <h2>{t.client}</h2>
          <p>{invoice.clients?.name ?? t.dash}</p>
          {invoice.clients?.phone && <p className="num">{invoice.clients.phone}</p>}
        </div>
        <div>
          <h2>{t.trx}</h2>
          <p className="num">{invoice.transactions?.ref_no ?? t.dash}</p>
          <p>{serviceName}</p>
          <p>{entityName}</p>
        </div>
      </section>}
      <table className="pi-table">
        <thead>
          <tr>
            <th>{t.idx}</th>
            <th>{t.item}</th>
            <th>{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, rowIndex) => row.kind === "entity" ? (
            <tr key={`entity-${pageIndex}-${rowIndex}`}><td className="num">{row.index}</td><td colSpan={2} className="pi-entity-name">{row.entity}</td></tr>
          ) : (
            <tr key={`fee-${pageIndex}-${rowIndex}`}><td className="num">{row.index}</td><td className="pi-fee-label">{row.label}</td><td className="num">{amt(row.amount)}</td></tr>
          ))}
        </tbody>
      </table>
      {lastPage && <>
      <div className="pi-totals">
        <table>
          <tbody>
            <tr>
              <th>{t.subtotal}</th>
              <td className="num">
                {amt(Number(invoice.gov_fees) + Number(invoice.office_fees))}
              </td>
            </tr>
            <tr>
              <th>{t.discount}</th>
              <td className="num">{amt(invoice.discount)}</td>
            </tr>
            <tr>
              <th>
                {t.vat} ({Number(invoice.vat_rate ?? 0)}%)
              </th>
              <td className="num">{amt(invoice.vat_amount)}</td>
            </tr>
            <tr className="pi-grand">
              <th>{t.grand}</th>
              <td className="num">{amt(invoice.total)}</td>
            </tr>
            <tr>
              <th>{t.paid}</th>
              <td className="num">{amt(invoice.paid)}</td>
            </tr>
            <tr className="pi-due">
              <th>{t.due}</th>
              <td className="num">{amt(remaining)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {payments.length > 0 && (
        <>
          <h2 className="pi-section">{t.paymentsTitle}</h2>
          <table className="pi-table">
            <thead>
              <tr>
                <th>{t.date}</th>
                <th>{t.amount}</th>
                <th>{t.method}</th>
                <th>{t.reference}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{dateAr(p.paid_at)}</td>
                  <td className="num">{amt(p.amount)}</td>
                  <td>{methodLabel(p.method)}</td>
                  <td className="num">{p.reference ?? t.dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {invoice.notes && (
        <p className="pi-notes">
          {t.notes}: {invoice.notes}
        </p>
      )}
      </>}
          </main>
          {footer(lastPage)}
        </section>;
      })}
    </div>,
    document.body,
  );
}