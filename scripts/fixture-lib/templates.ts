/**
 * HTML templates for the invoice fixtures, rendered with headless Chrome so Arabic
 * text is shaped by a real browser. All companies and data are fictitious.
 */
import {
  BUYER,
  COOL_BREEZE,
  COOL_BREEZE_INVOICE,
  GREEN_OASIS,
  GREEN_OASIS_INVOICE,
  SAR_DISPLAY,
  vat15,
} from "./data";
import type { CoolBreezeTotals } from "./invoice-xml";

const ibanGroups = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

// ---------------------------------------------------------------------------
// 1. Cool Breeze: bilingual A4 tax invoice (printed to PDF)
// ---------------------------------------------------------------------------

export function coolBreezeInvoiceHtml(t: CoolBreezeTotals, qr: string): string {
  const S = COOL_BREEZE;
  const B = BUYER;
  const inv = COOL_BREEZE_INVOICE;
  const en = S.address.en;
  const ar = S.address.ar;
  const ben = B.address.en;
  const bar = B.address.ar;

  const rows = inv.lines
    .map((l, i) => {
      const lt = t.lines[i];
      return `<tr>
        <td class="c idx">${l.id}</td>
        <td class="desc">
          <div class="en">${l.nameEn}</div>
          <div class="ar" lang="ar" dir="rtl">${l.nameAr}</div>
        </td>
        <td class="c">${l.quantity} <span class="unit">${l.unitCode}</span></td>
        <td class="n">${SAR_DISPLAY(l.unitPrice)}</td>
        <td class="n">${SAR_DISPLAY(lt.lineExtension)}</td>
        <td class="c">15%</td>
        <td class="n">${SAR_DISPLAY(lt.vat)}</td>
        <td class="n strong">${SAR_DISPLAY(lt.rounding)}</td>
      </tr>`;
    })
    .join("\n");

  const kv = (enLabel: string, value: string, arLabel: string) =>
    `<tr><th class="l">${enLabel}</th><td>${value}</td><th class="r ar" lang="ar" dir="rtl">${arLabel}</th></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tax Invoice ${inv.id} – ${S.nameEn} (fictitious)</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1d2733; font-size: 8.3pt; line-height: 1.36;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* Latin digits stay in Helvetica Neue; Arabic letters fall through to Geeza Pro. */
  .ar, [lang="ar"] { font-family: "Helvetica Neue", "Geeza Pro", "SF Arabic", "Al Nile", sans-serif; }
  .page { width: 210mm; height: 296mm; padding: 12mm 13mm 8mm; position: relative; display: flex; flex-direction: column; background: #fff; }
  .band { position: absolute; top: 0; left: 0; right: 0; height: 4mm; background: linear-gradient(90deg, #0b4a66 0%, #136d92 55%, #2aa3c9 100%); }
  .band2 { position: absolute; top: 4mm; left: 0; right: 0; height: 0.8mm; background: #b9e3f1; }

  header { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
  .sup h1 { font-size: 13.5pt; margin: 0 0 1.2mm; color: #0b4a66; letter-spacing: -0.1pt; line-height: 1.25; }
  .sup.ar h1 { font-size: 15pt; }
  .sup p { margin: 0; color: #4a5866; }
  .sup .ids { margin-top: 1.4mm; color: #1d2733; }
  .sup .ids b { font-weight: 600; }
  .sup.ar { text-align: right; }

  .title { margin: 5mm 0 4.5mm; display: flex; align-items: center; gap: 5mm; }
  .title .rule { flex: 1; height: 0.35mm; background: #cfdde6; }
  .title .t { display: flex; align-items: center; gap: 4mm; }
  .title .t .en { font-size: 16pt; font-weight: 700; letter-spacing: 1.2pt; color: #0b4a66; text-transform: uppercase; }
  .title .t .sep { width: 0.35mm; height: 7mm; background: #9fc3d4; }
  .title .t .ar { font-size: 18pt; font-weight: 700; color: #0b4a66; }

  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .card { border: 0.3mm solid #d5e1e8; border-radius: 2mm; overflow: hidden; background: #fff; }
  .hd { display: flex; justify-content: space-between; align-items: center; background: #eef5f9; padding: 1.4mm 3mm; font-weight: 600; color: #0b4a66; font-size: 8.4pt; }
  .hd .ar { font-size: 9.2pt; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv th, table.kv td { padding: 1.05mm 3mm; vertical-align: top; border-top: 0.2mm solid #edf2f5; }
  table.kv tr:first-child th, table.kv tr:first-child td { border-top: 0; }
  table.kv th { font-weight: 400; color: #5b6976; white-space: nowrap; }
  table.kv th.l { text-align: left; width: 26mm; }
  table.kv th.r { text-align: right; width: 24mm; font-size: 8.6pt; }
  table.kv td { font-weight: 600; text-align: center; white-space: nowrap; }
  .mono { font-family: "SF Mono", Menlo, monospace; font-size: 7.6pt; font-weight: 500; letter-spacing: -0.1pt; }
  .party { padding: 1.8mm 3mm 1.4mm; border-bottom: 0.2mm solid #edf2f5; }
  .party .en { font-weight: 700; font-size: 9.4pt; }
  .party .ar { font-weight: 700; font-size: 10pt; text-align: right; margin-top: -0.6mm; }
  .addr { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; padding: 1.2mm 3mm 1.8mm; color: #4a5866; border-top: 0.2mm solid #edf2f5; font-size: 7.8pt; }
  .addr .ar { text-align: right; font-size: 8.2pt; }

  table.items { width: 100%; border-collapse: collapse; margin-top: 5mm; table-layout: fixed; }
  table.items thead th { background: #0b4a66; color: #fff; font-weight: 600; font-size: 7.5pt; padding: 1.4mm 1.4mm; text-align: center; vertical-align: middle; line-height: 1.22; }
  table.items thead th .ar { display: block; font-size: 8.1pt; font-weight: 600; opacity: 0.9; margin-top: 0.3mm; }
  table.items thead th:first-child { border-top-left-radius: 1.6mm; }
  table.items thead th:last-child { border-top-right-radius: 1.6mm; }
  table.items thead th.desc { text-align: left; padding-left: 2mm; }
  table.items thead th.desc .ar { display: inline; margin-left: 2mm; }
  table.items td { padding: 2.2mm 1.4mm; border-bottom: 0.25mm solid #dfe8ee; vertical-align: top; }
  table.items td.c { text-align: center; white-space: nowrap; }
  table.items td.idx { color: #5b6976; }
  table.items td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.items td.strong { font-weight: 700; }
  table.items td.desc { padding-left: 2mm; }
  table.items td.desc .en { font-weight: 600; }
  table.items td.desc .ar { text-align: right; color: #33414d; font-size: 8.6pt; margin-top: 0.5mm; }
  .unit { color: #8795a1; font-size: 6.8pt; }

  .summary { display: grid; grid-template-columns: 1fr 88mm; gap: 7mm; margin-top: 5mm; align-items: start; }
  .qrbox { display: flex; gap: 4mm; align-items: flex-start; }
  .qr { width: 31mm; height: 31mm; flex: none; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .qrcap { color: #5b6976; font-size: 7.3pt; }
  .qrcap .ar { display: block; text-align: left; margin-top: 0.4mm; font-size: 7.9pt; }
  .qrcap .meta { margin-top: 1.8mm; }
  .words { margin-top: 3.5mm; padding: 2mm 3mm; background: #f4f8fa; border-radius: 1.6mm; }
  .words .lbl { color: #5b6976; font-size: 7.1pt; }
  .words .en { font-weight: 600; }
  .words .ar { text-align: right; font-weight: 600; font-size: 8.8pt; }

  table.totals { width: 100%; border-collapse: collapse; }
  table.totals th, table.totals td { padding: 1.35mm 2.6mm; border-bottom: 0.2mm solid #e3ebf0; vertical-align: middle; }
  table.totals th { text-align: left; font-weight: 400; color: #4a5866; }
  table.totals th .ar { display: block; text-align: left; font-size: 8.2pt; color: #5b6976; }
  table.totals td { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
  .grand { display: flex; justify-content: space-between; align-items: center; background: #0b4a66; color: #fff; padding: 1.8mm 2.6mm; font-weight: 700; border-radius: 0 0 1.6mm 1.6mm; }
  .grand .ar { display: block; color: #dcf0f7; font-size: 8.4pt; }
  .grand .amt { font-size: 12.5pt; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .grand .cur { font-size: 8pt; font-weight: 600; margin-right: 1.2mm; opacity: 0.85; }

  .pay { margin-top: 5mm; }
  .pay .grid { display: grid; grid-template-columns: 1fr 1fr; }
  .pay .grid > table + table { border-left: 0.2mm solid #edf2f5; }
  .pay table.kv td { text-align: left; }
  .pay table.kv th.l { width: 23mm; }
  .pay table.kv th.r { width: 20mm; }
  .pay table.iban-row { border-top: 0.2mm solid #edf2f5; background: #f7fbfd; }
  .pay table.iban-row td { padding-top: 1.5mm; padding-bottom: 1.5mm; }
  .iban { font-family: "SF Mono", Menlo, monospace; font-size: 9.6pt; font-weight: 600; letter-spacing: 0.4pt; color: #0b4a66; }

  .notes { margin-top: 3.5mm; display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; color: #4a5866; font-size: 7.8pt; }
  .notes .ar { text-align: right; font-size: 8.4pt; }

  footer { margin-top: auto; border-top: 0.3mm solid #d5e1e8; padding-top: 2.2mm; color: #6b7884; font-size: 6.9pt; display: grid; grid-template-columns: 1fr auto; gap: 0.8mm 6mm; }
  footer .demo { grid-column: 1 / -1; color: #8a96a1; }
  footer .ar { font-size: 7.4pt; }
</style>
</head>
<body>
<div class="page">
  <div class="band"></div><div class="band2"></div>

  <header>
    <div class="sup">
      <h1>${S.nameEn}</h1>
      <p>${en.building} ${en.street}, ${en.district}</p>
      <p>${en.city} ${en.postal}, additional no. ${en.additional}, Saudi Arabia</p>
      <p>${S.email}</p>
      <p class="ids"><b>VAT No.</b> ${S.vat} &nbsp;·&nbsp; <b>CR No.</b> ${S.cr}</p>
    </div>
    <div class="sup ar" lang="ar" dir="rtl">
      <h1>${S.nameAr}</h1>
      <p>${ar.building} ${ar.street}، ${ar.district}</p>
      <p>${ar.city} ${ar.postal}، الرقم الإضافي ${ar.additional}، المملكة العربية السعودية</p>
      <p><span dir="ltr">${S.email}</span></p>
      <p class="ids"><b>الرقم الضريبي</b> ${S.vat} &nbsp;·&nbsp; <b>السجل التجاري</b> ${S.cr}</p>
    </div>
  </header>

  <div class="title">
    <div class="rule"></div>
    <div class="t"><span class="en">Tax Invoice</span><span class="sep"></span><span class="ar" lang="ar" dir="rtl">فاتورة ضريبية</span></div>
    <div class="rule"></div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="hd"><span>Invoice details</span><span class="ar" lang="ar" dir="rtl">بيانات الفاتورة</span></div>
      <table class="kv">
        ${kv("Invoice number", inv.id, "رقم الفاتورة")}
        ${kv("Issue date", `${inv.issueDate}&nbsp;&nbsp;${inv.issueTime.slice(0, 5)}`, "تاريخ الإصدار")}
        ${kv("Supply date", inv.supplyDate, "تاريخ التوريد")}
        ${kv("Due date", inv.dueDate, "تاريخ الاستحقاق")}
        ${kv("Purchase order", inv.orderRef, "رقم أمر الشراء")}
      </table>
    </div>
    <div class="card">
      <div class="hd"><span>Buyer</span><span class="ar" lang="ar" dir="rtl">بيانات المشتري</span></div>
      <div class="party"><div class="en">${B.nameEn}</div><div class="ar" lang="ar" dir="rtl">${B.nameAr}</div></div>
      <table class="kv">
        ${kv("VAT number", B.vat, "الرقم الضريبي")}
        ${kv("CR number", B.cr, "السجل التجاري")}
      </table>
      <div class="addr">
        <span>${ben.building} ${ben.street}, ${ben.district}, ${ben.city} ${ben.postal}</span>
        <span class="ar" lang="ar" dir="rtl">${bar.building} ${bar.street}، ${bar.district}، ${bar.city} ${bar.postal}</span>
      </div>
    </div>
  </div>

  <table class="items">
    <colgroup>
      <col style="width:6mm"><col><col style="width:12mm"><col style="width:18mm"><col style="width:20mm">
      <col style="width:12mm"><col style="width:17mm"><col style="width:21mm">
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th class="desc">Description<span class="ar" lang="ar">الوصف</span></th>
        <th>Qty<span class="ar" lang="ar">الكمية</span></th>
        <th>Unit price<span class="ar" lang="ar">سعر الوحدة</span></th>
        <th>Taxable amount<span class="ar" lang="ar">المبلغ الخاضع للضريبة</span></th>
        <th>VAT %<span class="ar" lang="ar">النسبة</span></th>
        <th>VAT amount<span class="ar" lang="ar">مبلغ الضريبة</span></th>
        <th>Total incl. VAT<span class="ar" lang="ar">الإجمالي مع الضريبة</span></th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="summary">
    <div>
      <div class="qrbox">
        <div class="qr">${qr}</div>
        <div class="qrcap">
          ZATCA QR code: seller, VAT number, time stamp, total and VAT.
          <span class="ar" lang="ar" dir="rtl">رمز الاستجابة السريعة للفاتورة الإلكترونية</span>
          <div class="meta">UUID<br><span class="mono">${inv.uuid}</span></div>
          <div class="meta" style="margin-top:1mm">Invoice counter (ICV): <span class="mono">${inv.icv}</span></div>
        </div>
      </div>
      <div class="words">
        <div class="lbl">Amount in words / <span lang="ar" dir="rtl">المبلغ كتابةً</span></div>
        <div class="en">Forty-five thousand Saudi riyals only</div>
        <div class="ar" lang="ar" dir="rtl">فقط خمسة وأربعون ألف ريال سعودي لا غير</div>
      </div>
    </div>
    <div>
    <table class="totals">
      <tr><th>Total (excluding VAT)<span class="ar" lang="ar" dir="rtl">الإجمالي غير شامل ضريبة القيمة المضافة</span></th><td>${SAR_DISPLAY(t.subtotal)}</td></tr>
      <tr><th>Discount<span class="ar" lang="ar" dir="rtl">إجمالي الخصومات</span></th><td>0.00</td></tr>
      <tr><th>VAT (15%)<span class="ar" lang="ar" dir="rtl">ضريبة القيمة المضافة (15%)</span></th><td>${SAR_DISPLAY(t.vat)}</td></tr>
    </table>
    <div class="grand"><div>Total amount due<span class="ar" lang="ar" dir="rtl">إجمالي المبلغ المستحق</span></div><div class="amt"><span class="cur">SAR</span>${SAR_DISPLAY(t.total)}</div></div>
    </div>
  </div>

  <div class="card pay">
    <div class="hd"><span>Payment details</span><span class="ar" lang="ar" dir="rtl">بيانات الدفع</span></div>
    <div class="grid">
      <table class="kv">
        ${kv("Method", "Bank transfer", "طريقة الدفع")}
        ${kv("Bank", S.bankEn, "البنك")}
        ${kv("Account name", S.nameEn, "اسم الحساب")}
      </table>
      <table class="kv">
        ${kv("Reference", inv.id, "المرجع")}
        ${kv("Pay by", inv.dueDate, "السداد قبل")}
        ${kv("Currency", "SAR", "العملة")}
      </table>
    </div>
    <table class="kv iban-row">
      ${kv("IBAN", `<span class="iban">${ibanGroups(S.iban)}</span>`, "رقم الآيبان")}
    </table>
  </div>

  <div class="notes">
    <span>Payment terms: net 30 days from the invoice date. Please quote the invoice number on your transfer.</span>
    <span class="ar" lang="ar" dir="rtl">شروط الدفع: خلال 30 يوماً من تاريخ الفاتورة. يرجى ذكر رقم الفاتورة عند التحويل.</span>
  </div>

  <footer>
    <span>The structured e-invoice (UBL 2.1 XML) is attached to this PDF as <b>${inv.embeddedXmlName}</b>.</span>
    <span>Page 1 of 1</span>
    <span class="demo">Demo document for the Darb Bill Pay prototype. Fictitious company and data; not a real tax invoice. &nbsp;<span class="ar" lang="ar" dir="rtl">مستند تجريبي ببيانات وهمية.</span></span>
  </footer>
</div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// 2. Green Oasis: Arabic paper invoice, photographed on a desk (screenshot -> JPEG)
// ---------------------------------------------------------------------------

/** Wood desk texture as an inline SVG (fractal noise stretched into grain). */
const WOOD_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1600'>
<filter id='g' x='0' y='0' width='100%' height='100%'>
<feTurbulence type='fractalNoise' baseFrequency='0.0035 0.11' numOctaves='5' seed='11'/>
<feColorMatrix type='matrix' values='0 0 0 0 0.24  0 0 0 0 0.13  0 0 0 0 0.06  0 0 0 1.6 -0.45'/>
</filter>
<filter id='k' x='0' y='0' width='100%' height='100%'>
<feTurbulence type='fractalNoise' baseFrequency='0.02 0.6' numOctaves='2' seed='3'/>
<feColorMatrix type='matrix' values='0 0 0 0 0.9  0 0 0 0 0.7  0 0 0 0 0.5  0 0 0 0.9 -0.42'/>
</filter>
<rect width='1200' height='1600' fill='#8a5a36'/>
<rect width='1200' height='1600' filter='url(#g)'/>
<rect width='1200' height='1600' filter='url(#k)' opacity='0.5'/>
<rect x='0' y='540' width='1200' height='2.5' fill='#3a2212' opacity='0.55'/>
<rect x='0' y='1150' width='1200' height='2.5' fill='#3a2212' opacity='0.55'/>
</svg>`;

const svgDataUri = (svg: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\n/g, ""))}")`;

function stampSvg(): string {
  // Name on the top arc, city on the bottom arc, CR number in the middle.
  return `<svg class="stamp" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="arcTop" d="M37.98,122.57 A66,66 0 1,1 162.02,122.57"/>
    <path id="arcBottom" d="M48.58,161.28 A80,80 0 0,0 151.42,161.28"/>
    <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.8" result="m"/>
      <feComposite in="SourceGraphic" in2="m" operator="in" result="c"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="w"/>
      <feDisplacementMap in="c" in2="w" scale="2.2"/>
    </filter>
  </defs>
  <g filter="url(#ink)" fill="none" stroke="#2747a3">
    <circle cx="100" cy="100" r="95" stroke-width="3.6"/>
    <circle cx="100" cy="100" r="89" stroke-width="1.3"/>
    <circle cx="100" cy="100" r="55" stroke-width="1.5"/>
    <g font-family="Geeza Pro" font-weight="700" fill="#2747a3" stroke="none">
      <text font-size="14.5"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">${GREEN_OASIS.nameAr}</textPath></text>
      <text font-size="14"><textPath href="#arcBottom" startOffset="50%" text-anchor="middle">★ الرياض ★</textPath></text>
      <text x="100" y="88" font-size="14" text-anchor="middle">س.ت</text>
      <text x="100" y="108" font-family="Arial" font-size="14" text-anchor="middle">${GREEN_OASIS.cr}</text>
      <text x="100" y="126" font-size="11" text-anchor="middle">مؤسسة فردية</text>
    </g>
  </g>
</svg>`;
}

const SIGNATURE_SVG = `<svg class="sig" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 58 C 22 34, 40 22, 46 36 C 52 50, 34 66, 28 56 C 22 46, 54 34, 70 44 C 80 50, 76 64, 90 58 C 104 52, 108 30, 120 34 C 130 38, 118 62, 134 60 C 150 58, 160 36, 172 40 C 180 43, 176 56, 186 54 C 196 52, 204 42, 212 36"
        fill="none" stroke="#1d2f6b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 72 C 70 62, 130 60, 206 52" fill="none" stroke="#1d2f6b" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="150" cy="24" r="2.2" fill="#1d2f6b"/>
</svg>`;

export function greenOasisPhotoHtml(qr: string): string {
  const S = GREEN_OASIS;
  const B = BUYER;
  const inv = GREEN_OASIS_INVOICE;
  const subtotal = inv.lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const vat = vat15(subtotal);
  const total = subtotal + vat;
  const e = inv.expected;
  if (subtotal !== e.subtotal || vat !== e.vat || total !== e.total) {
    throw new Error(`Green Oasis totals ${subtotal}/${vat}/${total} do not match seed`);
  }
  const rows = inv.lines
    .map(
      (l, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="d">${l.nameAr}</td>
        <td class="c">${l.unitAr}</td>
        <td class="c">${l.quantity}</td>
        <td class="n">${SAR_DISPLAY(l.unitPrice)}</td>
        <td class="n">${SAR_DISPLAY(l.quantity * l.unitPrice)}</td>
      </tr>`,
    )
    .join("\n");
  const ltr = (s: string) => `<span dir="ltr" class="num">${s}</span>`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>Photo of paper invoice ${inv.id} (fictitious)</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 1200px; height: 1600px; overflow: hidden; }
  body { background: #7c5232 ${svgDataUri(WOOD_SVG)} no-repeat; background-size: 1200px 1600px; position: relative; }

  .scene { position: absolute; inset: 0; perspective: 1700px; perspective-origin: 52% 30%; }
  .paper {
    position: absolute; left: 158px; top: 150px; width: 884px; height: 1250px;
    background: #fbf9f3; color: #1e1e1e;
    transform: rotateX(8deg) rotateY(-1.2deg) rotateZ(-2.6deg); transform-origin: 50% 55%;
    box-shadow: 0 2px 3px rgba(40,22,8,0.35), 0 22px 40px rgba(30,15,5,0.45), 18px 30px 60px rgba(30,15,5,0.25);
    padding: 54px 58px 40px; overflow: hidden;
    font-family: Arial, "Geeza Pro", sans-serif; font-size: 19px; line-height: 1.5;
  }
  .paper::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(to bottom, transparent 32.6%, rgba(0,0,0,0.055) 33.15%, rgba(255,255,255,0.5) 33.45%, transparent 34.2%),
      linear-gradient(to bottom, transparent 65.9%, rgba(0,0,0,0.05) 66.45%, rgba(255,255,255,0.45) 66.75%, transparent 67.5%),
      linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(0,0,0,0.0) 40%, rgba(60,40,20,0.10) 100%);
  }
  .num { font-family: Arial, sans-serif; unicode-bidi: isolate; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .co h1 { margin: 0; font-family: "Geeza Pro", Arial, sans-serif; font-size: 31px; color: #1f6a35; line-height: 1.3; }
  .co .en { font-family: "Helvetica Neue", Arial, sans-serif; direction: ltr; text-align: right; font-size: 15px; color: #2e5c3a; letter-spacing: 0.3px; font-weight: 600; }
  .co p { margin: 2px 0 0; font-size: 15px; color: #333; }
  .doc { text-align: left; }
  .doc .t { font-family: "Geeza Pro", Arial, sans-serif; font-size: 34px; font-weight: 700; color: #1e1e1e; line-height: 1.2; }
  .doc .te { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 14px; letter-spacing: 2px; color: #555; direction: ltr; }
  .rule { height: 0; border-top: 3px double #1f6a35; margin: 18px 0 16px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 40px; font-size: 19px; }
  .meta div { display: flex; gap: 14px; border-bottom: 1px dotted #999; padding: 3px 0; }
  .meta b { font-weight: 700; }
  .box { border: 1.5px solid #333; border-radius: 6px; padding: 10px 16px; margin-top: 18px; font-size: 18px; }
  .box .h { font-weight: 700; color: #1f6a35; margin-bottom: 2px; }
  .box .row { display: flex; gap: 30px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 18px; }
  th { background: #e4efe2; border: 1.4px solid #333; padding: 7px 6px; font-weight: 700; }
  td { border: 1.4px solid #333; padding: 9px 8px; vertical-align: top; }
  td.c { text-align: center; }
  td.n { text-align: left; font-family: Arial, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; direction: ltr; }
  td.d { width: 46%; }
  tr.blank td { height: 34px; }
  .totals { width: 52%; margin-top: 14px; margin-right: auto; border-collapse: collapse; font-size: 18px; }
  .totals td { border: 1.4px solid #333; padding: 7px 10px; }
  .totals tr.g td { font-weight: 700; background: #e4efe2; font-size: 19px; }
  .words { margin-top: 12px; font-size: 18px; }
  .bank { margin-top: 8px; font-size: 18px; color: #222; }
  .notes { margin-top: 16px; border: 1.2px dashed #777; border-radius: 6px; padding: 8px 14px; font-size: 17px; color: #333; }
  .bottom { position: absolute; left: 58px; right: 58px; bottom: 74px; display: flex; justify-content: space-between; align-items: flex-end; }
  .signblock { width: 330px; text-align: center; position: relative; height: 190px; }
  .signblock .lbl { position: absolute; bottom: 0; left: 0; right: 0; border-top: 1.4px dotted #444; padding-top: 4px; font-size: 15px; }
  .stamp { position: absolute; width: 168px; height: 168px; left: 18px; top: -6px; transform: rotate(-14deg); opacity: 0.8; mix-blend-mode: multiply; }
  .sig { position: absolute; width: 200px; left: 120px; top: 70px; transform: rotate(-4deg); mix-blend-mode: multiply; opacity: 0.92; }
  .recv { width: 230px; text-align: center; height: 190px; position: relative; }
  .recv .lbl { position: absolute; bottom: 0; left: 0; right: 0; border-top: 1.4px dotted #444; padding-top: 4px; font-size: 15px; }
  .qr { width: 150px; height: 150px; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .foot { position: absolute; left: 58px; right: 58px; bottom: 22px; display: flex; justify-content: space-between; font-size: 13px; color: #555; border-top: 1px solid #bbb; padding-top: 6px; }

  .light { position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 70% 55% at 38% 28%, rgba(255,236,205,0.20), rgba(255,236,205,0) 70%),
      radial-gradient(ellipse 85% 75% at 50% 48%, rgba(0,0,0,0) 58%, rgba(20,10,0,0.42) 100%),
      linear-gradient(180deg, rgba(0,0,0,0) 70%, rgba(20,10,0,0.12) 100%);
  }
</style>
</head>
<body>
<div class="scene">
  <div class="paper">
    <div class="top">
      <div class="co">
        <h1>${S.nameAr}</h1>
        <div class="en">${S.nameEn.toUpperCase()}</div>
        <p>${S.addressAr}</p>
        <p>الرقم الضريبي: ${ltr(S.vat)} &nbsp;|&nbsp; س.ت: ${ltr(S.cr)}</p>
        <p>البريد: ${ltr(S.email)}</p>
      </div>
      <div class="doc">
        <div class="t">فاتورة ضريبية</div>
        <div class="te">TAX INVOICE</div>
      </div>
    </div>
    <div class="rule"></div>
    <div class="meta">
      <div><span>رقم الفاتورة:</span><b>${ltr(inv.id)}</b></div>
      <div><span>تاريخ الفاتورة:</span><b>${ltr(inv.issueDateShown)}م</b></div>
      <div><span>طريقة الدفع:</span><b>تحويل بنكي</b></div>
      <div><span>تاريخ الاستحقاق:</span><b>${ltr(inv.dueDateShown)}م</b></div>
    </div>
    <div class="box">
      <div class="h">بيانات العميل</div>
      <div class="row"><span>الاسم: <b>${B.nameAr}</b></span><span class="num" dir="ltr">${B.nameEn}</span></div>
      <div class="row"><span>الرقم الضريبي: ${ltr(B.vat)}</span><span>العنوان: ${B.address.ar.city} – ${B.address.ar.district}</span></div>
    </div>
    <table>
      <thead><tr><th>م</th><th>البيان</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي (ر.س)</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="blank"><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr class="blank"><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr class="blank"><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <table class="totals">
      <tr><td>المجموع قبل الضريبة</td><td class="n">${SAR_DISPLAY(subtotal)}</td></tr>
      <tr><td>ضريبة القيمة المضافة (15%)</td><td class="n">${SAR_DISPLAY(vat)}</td></tr>
      <tr class="g"><td>الإجمالي شامل الضريبة</td><td class="n">${SAR_DISPLAY(total)} ر.س</td></tr>
    </table>
    <div class="words">المبلغ كتابةً: <b>${inv.totalInWordsAr}</b></div>
    <div class="bank">يرجى التحويل إلى حساب المؤسسة لدى ${S.bankAr} – آيبان: ${ltr(ibanGroups(S.iban))}</div>
    <div class="notes">ملاحظات: نُفذت الأعمال في موقع العميل (المقر الرئيسي – الرياض). السداد خلال 15 يوماً من تاريخ الفاتورة.</div>

    <div class="bottom">
      <div class="signblock">
        ${stampSvg()}
        ${SIGNATURE_SVG}
        <div class="lbl">الختم والتوقيع</div>
      </div>
      <div class="recv"><div class="lbl">توقيع المستلم</div></div>
      <div class="qr">${qr}</div>
    </div>
    <div class="foot"><span>شكراً لتعاملكم معنا</span><span>نموذج تجريبي – بيانات وهمية لأغراض العرض فقط</span></div>
  </div>
</div>
<div class="light"></div>
</body>
</html>
`;
}
