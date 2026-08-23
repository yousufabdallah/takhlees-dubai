import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { dateAr, INVOICE_STATUS, money, PAYMENT_METHODS } from "@/lib/domain";
import type { OfficeSettings } from "@/lib/office";

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
  transactions: { ref_no: string; type_name: string; gov_entity: string | null } | null;
};

export type PrintPayment = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  reference: string | null;
};

export function InvoicePrint({
  office,
  invoice,
  payments,
}: {
  office: OfficeSettings | null | undefined;
  invoice: PrintInvoice;
  payments: PrintPayment[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const remaining = Number(invoice.total) - Number(invoice.paid);
  const name = office?.legal_name?.trim() || "مكتب تخليص المعاملات";

  if (!mounted) return null;

  return createPortal(
    <div className="print-invoice hidden" aria-hidden>

      <header className="pi-head">
        <div className="pi-office">
          {office?.logo_url ? (
            <img src={office.logo_url} alt={name} className="pi-logo" />
          ) : null}
          <div>
            <h1 className="pi-name">{name}</h1>
            {office?.legal_name_en && <p className="pi-name-en">{office.legal_name_en}</p>}
            <p className="pi-meta">
              {office?.address ? <span>{office.address}</span> : null}
              {office?.phone ? <span>هاتف: {office.phone}</span> : null}
              {office?.email ? <span>{office.email}</span> : null}
              {office?.website ? <span>{office.website}</span> : null}
            </p>
            <p className="pi-meta">
              {office?.license_no ? <span>رقم الرخصة: {office.license_no}</span> : null}
              {office?.trn ? <span>الرقم الضريبي (TRN): {office.trn}</span> : null}
            </p>
          </div>
        </div>
        <div className="pi-doc">
          <p className="pi-doc-title">فاتورة ضريبية</p>
          <p className="pi-doc-title-en">TAX INVOICE</p>
          <table className="pi-doc-table">
            <tbody>
              <tr>
                <th>رقم الفاتورة</th>
                <td className="num">{invoice.invoice_no}</td>
              </tr>
              <tr>
                <th>تاريخ الإصدار</th>
                <td className="num">{dateAr(invoice.issue_date)}</td>
              </tr>
              <tr>
                <th>تاريخ الاستحقاق</th>
                <td className="num">{dateAr(invoice.due_date)}</td>
              </tr>
              <tr>
                <th>الحالة</th>
                <td>{INVOICE_STATUS[invoice.status] ?? invoice.status}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </header>

      <section className="pi-parties">
        <div>
          <h2>بيانات العميل</h2>
          <p>{invoice.clients?.name ?? "—"}</p>
          {invoice.clients?.phone && <p className="num">{invoice.clients.phone}</p>}
        </div>
        <div>
          <h2>بيانات المعاملة</h2>
          <p className="num">{invoice.transactions?.ref_no ?? "—"}</p>
          <p>{invoice.transactions?.type_name ?? "—"}</p>
          <p>{invoice.transactions?.gov_entity ?? "—"}</p>
        </div>
      </section>

      <table className="pi-table">
        <thead>
          <tr>
            <th>#</th>
            <th>البيان</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="num">1</td>
            <td>رسوم حكومية (أمانات تُدفع للجهات الحكومية)</td>
            <td className="num">{money(invoice.gov_fees)}</td>
          </tr>
          <tr>
            <td className="num">2</td>
            <td>أتعاب المكتب — {invoice.transactions?.type_name ?? "خدمة تخليص"}</td>
            <td className="num">{money(invoice.office_fees)}</td>
          </tr>
        </tbody>
      </table>

      <div className="pi-totals">
        <table>
          <tbody>
            <tr>
              <th>المجموع قبل الخصم</th>
              <td className="num">{money(Number(invoice.gov_fees) + Number(invoice.office_fees))}</td>
            </tr>
            <tr>
              <th>الخصم</th>
              <td className="num">{money(invoice.discount)}</td>
            </tr>
            <tr>
              <th>ضريبة القيمة المضافة ({Number(invoice.vat_rate ?? 0)}%)</th>
              <td className="num">{money(invoice.vat_amount)}</td>
            </tr>
            <tr className="pi-grand">
              <th>الإجمالي المستحق</th>
              <td className="num">{money(invoice.total)}</td>
            </tr>
            <tr>
              <th>المدفوع</th>
              <td className="num">{money(invoice.paid)}</td>
            </tr>
            <tr className="pi-due">
              <th>المتبقي</th>
              <td className="num">{money(remaining)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {payments.length > 0 && (
        <>
          <h2 className="pi-section">سجل الدفعات</h2>
          <table className="pi-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الطريقة</th>
                <th>المرجع</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{dateAr(p.paid_at)}</td>
                  <td className="num">{money(p.amount)}</td>
                  <td>{PAYMENT_METHODS[p.method] ?? p.method}</td>
                  <td className="num">{p.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {invoice.notes && <p className="pi-notes">ملاحظات: {invoice.notes}</p>}

      <footer className="pi-footer">
        {office?.invoice_footer && <p>{office.invoice_footer}</p>}
        <p className="pi-fine">
          الرسوم الحكومية تُحصَّل لصالح الجهات الحكومية ولا تُحتسب ضمن دخل المكتب، ولا تخضع لضريبة
          القيمة المضافة.
        </p>
        <div className="pi-sign">
          <div>
            <span>توقيع المكتب</span>
          </div>
          <div>
            <span>توقيع العميل</span>
          </div>
        </div>
        <p className="pi-fine">هذه الفاتورة صادرة إلكترونياً من {name}</p>
      </footer>
    </div>,
    document.body,
  );
}
