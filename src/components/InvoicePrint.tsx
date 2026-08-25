import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { dateAr, INVOICE_STATUS, money, PAYMENT_METHODS } from "@/lib/domain";
import type { OfficeSettings } from "@/lib/office";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const t = T[lang];
  const en = lang === "en";

  const remaining =
    Number(invoice.total || 0) - Number(invoice.paid || 0);

  const arName =
    office?.legal_name?.trim() || "مكتب تخليص المعاملات";

  const enName =
    office?.legal_name_en?.trim() || "";

  const name = en
    ? enName || arName
    : arName;

  const subName = en
    ? enName
      ? arName
      : ""
    : enName;

  const serviceName = en
    ? invoice.transactions?.type_name_en ||
      invoice.transactions?.type_name ||
      t.defaultService
    : invoice.transactions?.type_name ||
      t.defaultService;

  const entityName = en
    ? invoice.transactions?.gov_entity_en ||
      invoice.transactions?.gov_entity ||
      t.dash
    : invoice.transactions?.gov_entity ||
      t.dash;

  const statusLabel = en
    ? INVOICE_STATUS_EN[invoice.status] ??
      invoice.status
    : INVOICE_STATUS[invoice.status] ??
      invoice.status;

  const methodLabel = (method: string) =>
    en
      ? PAYMENT_METHODS_EN[method] ?? method
      : PAYMENT_METHODS[method] ?? method;

  const amt = (
    value: number | string | null | undefined
  ) =>
    en
      ? `${Number(value ?? 0).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} AED`
      : money(value);

  /* =========================================================
     GROUP ITEMS
     ========================================================= */

  type GroupRow = {
    service: string;
    gov_fee: number;
    office_fee: number;
  };

  const groups: {
    entity: string;
    rows: GroupRow[];
  }[] = [];

  for (const item of items) {
    const entity =
      (
        en
          ? item.gov_entity_en || item.gov_entity
          : item.gov_entity
      ) || t.dash;

    const service =
      (
        en
          ? item.type_name_en || item.type_name
          : item.type_name
      ) || t.defaultService;

    let group = groups.find(
      (current) => current.entity === entity
    );

    if (!group) {
      group = {
        entity,
        rows: [],
      };

      groups.push(group);
    }

    group.rows.push({
      service,
      gov_fee: Number(item.gov_fee) || 0,
      office_fee: Number(item.office_fee) || 0,
    });
  }

  /* =========================================================
     DISPLAY ROWS
     ========================================================= */

  type DisplayRow =
    | {
        kind: "entity";
        index: number;
        entity: string;
      }
    | {
        kind: "fee";
        index: string;
        label: string;
        amount: number;
      };

  const displayRows: DisplayRow[] = [];

  if (groups.length > 0) {
    groups.forEach((group, groupIndex) => {
      displayRows.push({
        kind: "entity",
        index: groupIndex + 1,
        entity: group.entity,
      });

      group.rows.forEach((row, rowIndex) => {
        const index =
          `${groupIndex + 1}.${rowIndex + 1}`;

        displayRows.push({
          kind: "fee",
          index,
          label:
            `${row.service} — ${t.officeLine}`,
          amount: row.office_fee,
        });

        if (Number(row.gov_fee) > 0) {
          displayRows.push({
            kind: "fee",
            index: "",
            label:
              `${row.service} — ${t.govLine}`,
            amount: row.gov_fee,
          });
        }
      });
    });
  } else {
    displayRows.push(
      {
        kind: "fee",
        index: "1",
        label: t.govLine,
        amount: invoice.gov_fees,
      },
      {
        kind: "fee",
        index: "2",
        label:
          `${t.officeLine} — ${serviceName}`,
        amount: invoice.office_fees,
      },
    );
  }

  /* =========================================================
     PAGE SPLITTING
     ========================================================= */

  /*
   * React is responsible for page splitting.
   *
   * Each .pi-sheet becomes exactly one A4 page.
   *
   * Keep this number conservative because the header,
   * totals and footer also consume physical page space.
   */
  const rowLimit = 10;

  const itemPages = Array.from(
    {
      length: Math.max(
        1,
        Math.ceil(
          displayRows.length / rowLimit
        )
      ),
    },
    (_, index) =>
      displayRows.slice(
        index * rowLimit,
        (index + 1) * rowLimit
      ),
  );

  /* =========================================================
     HEADER
     ========================================================= */

  const header = (
    <div className="pi-repeat-header">

      <header
        className="
          invoice-header
          flex
          justify-between
          items-start
          w-full
          border-b-2
          border-gray-200
        "
      >
        <div className="text-right flex-1 pr-4">

          <h1 className="text-2xl font-bold text-gray-900">
            {name}
          </h1>

          {subName && (
            <p className="text-lg text-gray-700 mt-1">
              {subName}
            </p>
          )}

          <div className="text-sm text-gray-600 mt-3 space-y-1">

            {office?.phone && (
              <p>
                {t.phone}: {office.phone}
              </p>
            )}

            {office?.address && (
              <p>
                {office.address}
              </p>
            )}

            <p>
              {office?.email && (
                <span>
                  {office.email}{" "}
                  |{" "}
                </span>
              )}

              {office?.website && (
                <span>
                  {office.website}
                </span>
              )}
            </p>

            <p>
              {office?.license_no && (
                <span>
                  {t.license}:{" "}
                  {office.license_no}{" "}
                </span>
              )}

              {office?.trn && (
                <span>
                  | {t.trn}:{" "}
                  {office.trn}
                </span>
              )}
            </p>

          </div>
        </div>

        <div className="flex-shrink-0">

          <img
            src="/Nukhbt-Almstqbl-CMYK-02.png"
            alt={name}
            className="
              w-60
              h-auto
              object-contain
              [image-rendering:-webkit-optimize-contrast]
            "
          />

        </div>
      </header>

      <div className="pi-doc">

        <p className="pi-doc-title">
          {t.docTitle}
        </p>

        <p className="pi-doc-title-en">
          {t.docTitleAlt}
        </p>

        <table className="pi-doc-table">
          <tbody>

            <tr>
              <th>{t.invoiceNo}</th>
              <td className="num">
                {invoice.invoice_no}
              </td>
            </tr>

            <tr>
              <th>{t.issueDate}</th>
              <td className="num">
                {dateAr(invoice.issue_date)}
              </td>
            </tr>

            <tr>
              <th>{t.dueDate}</th>
              <td className="num">
                {dateAr(invoice.due_date)}
              </td>
            </tr>

            <tr>
              <th>{t.status}</th>
              <td>
                {statusLabel}
              </td>
            </tr>

          </tbody>
        </table>

      </div>

      <div className="pi-rule" />

    </div>
  );

  /* =========================================================
     FOOTER
     ========================================================= */

  const footer = (isLast: boolean) => (
    <footer className="pi-footer pi-repeat-footer">

      <div className="flex items-center justify-between w-full">

        <div
          className="
            flex-1
            text-xs
            text-gray-500
            space-y-1
            ltr:text-left
            rtl:text-right
          "
        >

          {office?.invoice_footer && (
            <p>
              {office.invoice_footer}
            </p>
          )}

          <p>
            {t.fine}
          </p>

          <p className="mt-1 font-semibold text-gray-400">
            {t.issuedBy(name)}
          </p>

        </div>

        <div
          className="
            flex-shrink-0
            mx-4
            flex
            flex-col
            items-center
          "
        >

          <img
            src="/stamp.jpeg"
            alt="Stamp"
            className="
              w-24
              h-auto
              object-contain
              [image-rendering:-webkit-optimize-contrast]
            "
          />

          {isLast && (
            <span
              className="
                text-[10px]
                font-bold
                mt-1
                text-gray-700
                border-t
                border-gray-300
                pt-1
                w-24
                text-center
              "
            >
              {t.officeSign}
            </span>
          )}

        </div>

      </div>

    </footer>
  );

  /* =========================================================
     SERVER / CLIENT MOUNT
     ========================================================= */

  if (!mounted) {
    return null;
  }

  /* =========================================================
     PRINT PORTAL
     ========================================================= */

  return createPortal(

    <div
      className="print-invoice hidden"
      aria-hidden
      dir={en ? "ltr" : "rtl"}
      lang={lang}
    >

      {itemPages.map(
        (pageRows, pageIndex) => {

          const firstPage =
            pageIndex === 0;

          const lastPage =
            pageIndex ===
            itemPages.length - 1;

          return (
            <section
              className="pi-sheet"
              key={`page-${pageIndex}`}
            >

              {/* HEADER */}
              {header}

              {/* CONTENT */}
              <main className="pi-content">

                {/* CLIENT + TRANSACTION */}
                {firstPage && (
                  <section className="pi-parties">

                    <div>
                      <h2>
                        {t.client}
                      </h2>

                      <p>
                        {invoice.clients?.name ??
                          t.dash}
                      </p>

                      {invoice.clients?.phone && (
                        <p className="num">
                          {invoice.clients.phone}
                        </p>
                      )}
                    </div>

                    <div>
                      <h2>
                        {t.trx}
                      </h2>

                      <p className="num">
                        {invoice.transactions?.ref_no ??
                          t.dash}
                      </p>

                      <p>
                        {serviceName}
                      </p>

                      <p>
                        {entityName}
                      </p>
                    </div>

                  </section>
                )}

                {/* ITEMS */}
                <table className="pi-table">

                  <thead>
                    <tr>
                      <th>
                        {t.idx}
                      </th>

                      <th>
                        {t.item}
                      </th>

                      <th>
                        {t.amount}
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {pageRows.map(
                      (row, rowIndex) => {

                        if (row.kind === "entity") {
                          return (
                            <tr
                              key={`entity-${pageIndex}-${rowIndex}`}
                            >
                              <td className="num">
                                {row.index}
                              </td>

                              <td
                                colSpan={2}
                                className="pi-entity-name"
                              >
                                {row.entity}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={`fee-${pageIndex}-${rowIndex}`}
                          >
                            <td className="num">
                              {row.index}
                            </td>

                            <td className="pi-fee-label">
                              {row.label}
                            </td>

                            <td className="num">
                              {amt(row.amount)}
                            </td>
                          </tr>
                        );
                      },
                    )}

                  </tbody>

                </table>

                {/* LAST PAGE ONLY */}
                {lastPage && (
                  <>

                    {/* TOTALS */}
                    <div className="pi-totals">

                      <table>

                        <tbody>

                          <tr>
                            <th>
                              {t.subtotal}
                            </th>

                            <td className="num">
                              {amt(
                                Number(invoice.gov_fees) +
                                Number(invoice.office_fees)
                              )}
                            </td>
                          </tr>

                          <tr>
                            <th>
                              {t.discount}
                            </th>

                            <td className="num">
                              {amt(invoice.discount)}
                            </td>
                          </tr>

                          <tr>
                            <th>
                              {t.vat} (
                              {Number(
                                invoice.vat_rate ?? 0
                              )}
                              %)
                            </th>

                            <td className="num">
                              {amt(
                                invoice.vat_amount
                              )}
                            </td>
                          </tr>

                          <tr className="pi-grand">
                            <th>
                              {t.grand}
                            </th>

                            <td className="num">
                              {amt(
                                invoice.total
                              )}
                            </td>
                          </tr>

                          <tr>
                            <th>
                              {t.paid}
                            </th>

                            <td className="num">
                              {amt(
                                invoice.paid
                              )}
                            </td>
                          </tr>

                          <tr className="pi-due">
                            <th>
                              {t.due}
                            </th>

                            <td className="num">
                              {amt(
                                remaining
                              )}
                            </td>
                          </tr>

                        </tbody>

                      </table>

                    </div>

                    {/* PAYMENTS */}
                    {payments.length > 0 && (
                      <>

                        <h2 className="pi-section">
                          {t.paymentsTitle}
                        </h2>

                        <table className="pi-table">

                          <thead>
                            <tr>

                              <th>
                                {t.date}
                              </th>

                              <th>
                                {t.amount}
                              </th>

                              <th>
                                {t.method}
                              </th>

                              <th>
                                {t.reference}
                              </th>

                            </tr>
                          </thead>

                          <tbody>

                            {payments.map(
                              (payment) => (
                                <tr
                                  key={payment.id}
                                >

                                  <td className="num">
                                    {dateAr(
                                      payment.paid_at
                                    )}
                                  </td>

                                  <td className="num">
                                    {amt(
                                      payment.amount
                                    )}
                                  </td>

                                  <td>
                                    {methodLabel(
                                      payment.method
                                    )}
                                  </td>

                                  <td className="num">
                                    {payment.reference ??
                                      t.dash}
                                  </td>

                                </tr>
                              ),
                            )}

                          </tbody>

                        </table>

                      </>
                    )}

                    {/* NOTES */}
                    {invoice.notes && (
                      <p className="pi-notes">
                        {t.notes}:{" "}
                        {invoice.notes}
                      </p>
                    )}

                  </>
                )}

              </main>

              {/* FOOTER */}
              {footer(lastPage)}

            </section>
          );
        },
      )}

    </div>,

    document.body,
  );
}