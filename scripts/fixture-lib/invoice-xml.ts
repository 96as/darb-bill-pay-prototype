/**
 * Builds the ZATCA-style UBL 2.1 standard tax invoice for INV-2026-0451 and the
 * test variants. Everything is fictitious; the signature block holds dummy values.
 */
import { createHash } from "node:crypto";
import { BUYER, COOL_BREEZE, COOL_BREEZE_INVOICE, SAR, vat15 } from "./data";

export type NameVariant = "bilingual" | "english" | "arabic";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64");

/** ZATCA QR payload: TLV (tag, length, UTF-8 value) then base64. */
export function zatcaQrBase64(fields: string[]): string {
  const parts: Buffer[] = [];
  fields.forEach((value, i) => {
    const v = Buffer.from(value, "utf8");
    if (v.length > 255) throw new Error(`QR tag ${i + 1} too long`);
    parts.push(Buffer.from([i + 1, v.length]), v);
  });
  return Buffer.concat(parts).toString("base64");
}

// Dummy cryptographic values. Each decodes to readable text saying it is fake.
const DUMMY = {
  invoiceDigest: b64("FAKE-INVOICE-DIGEST|prototype fixture|not a real hash"),
  signedPropsDigest: b64("FAKE-SIGNED-PROPERTIES-DIGEST|prototype fixture"),
  certDigest: b64("FAKE-CERTIFICATE-DIGEST|prototype fixture"),
  signatureValue: b64("FAKE-ECDSA-SIGNATURE|prototype fixture|not issued by ZATCA|will not validate"),
  certificate: b64(
    "FAKE-X509-CERTIFICATE|prototype fixture|not a ZATCA CSID|subject=Cool Breeze HVAC Contracting Co. (fictitious)",
  ),
  publicKey: "FAKE-ECDSA-PUBLIC-KEY|prototype fixture",
  issuerName: "CN=DUMMY-ISSUING-CA, DC=prototype, DC=example",
  serial: "1000000000000000000000000000000000000001",
};

/** Previous-invoice hash: base64 of a hex SHA-256 (ZATCA style), computed from a dummy string. */
const PIH = b64(
  createHash("sha256").update("dummy previous invoice INV-2026-0450 (prototype fixture)").digest("hex"),
);

interface Names {
  supplierPartyName: string;
  supplierRegistrationName: string;
  buyerPartyName: string;
  buyerRegistrationName: string;
  addressLang: "en" | "ar";
  line: (l: { nameEn: string; nameAr: string }) => string;
  bank: string;
  accountName: string;
  paymentNote: string;
  paymentTerms: string;
}

function namesFor(variant: NameVariant): Names {
  const S = COOL_BREEZE;
  const B = BUYER;
  switch (variant) {
    case "bilingual":
      return {
        supplierPartyName: S.nameAr,
        supplierRegistrationName: `${S.nameEn} | ${S.nameAr}`,
        buyerPartyName: B.nameAr,
        buyerRegistrationName: `${B.nameEn} | ${B.nameAr}`,
        addressLang: "en",
        line: (l) => `${l.nameEn} | ${l.nameAr}`,
        bank: `${S.bankEn} | ${S.bankAr}`,
        accountName: S.nameEn,
        paymentNote: "Bank transfer, quote the invoice number | تحويل بنكي مع ذكر رقم الفاتورة",
        paymentTerms: "Net 30 days from invoice date | السداد خلال 30 يوماً من تاريخ الفاتورة",
      };
    case "english":
      return {
        supplierPartyName: S.nameEn,
        supplierRegistrationName: S.nameEn,
        buyerPartyName: B.nameEn,
        buyerRegistrationName: B.nameEn,
        addressLang: "en",
        line: (l) => l.nameEn,
        bank: S.bankEn,
        accountName: S.nameEn,
        paymentNote: "Bank transfer, quote the invoice number",
        paymentTerms: "Net 30 days from invoice date",
      };
    case "arabic":
      return {
        supplierPartyName: S.nameAr,
        supplierRegistrationName: S.nameAr,
        buyerPartyName: B.nameAr,
        buyerRegistrationName: B.nameAr,
        addressLang: "ar",
        line: (l) => l.nameAr,
        bank: S.bankAr,
        accountName: S.nameAr,
        paymentNote: "تحويل بنكي مع ذكر رقم الفاتورة",
        paymentTerms: "السداد خلال 30 يوماً من تاريخ الفاتورة",
      };
  }
}

export interface CoolBreezeTotals {
  lines: { lineExtension: number; vat: number; rounding: number }[];
  subtotal: number;
  vat: number;
  total: number;
}

/** Computes line and document totals and checks them against the seed numbers. */
export function coolBreezeTotals(): CoolBreezeTotals {
  const inv = COOL_BREEZE_INVOICE;
  const lines = inv.lines.map((l) => {
    const lineExtension = l.quantity * l.unitPrice;
    const vat = vat15(lineExtension);
    return { lineExtension, vat, rounding: lineExtension + vat };
  });
  const subtotal = lines.reduce((a, l) => a + l.lineExtension, 0);
  const vat = lines.reduce((a, l) => a + l.vat, 0);
  const total = subtotal + vat;
  const e = inv.expected;
  if (subtotal !== e.subtotal || vat !== e.vat || total !== e.total) {
    throw new Error(`Cool Breeze totals ${subtotal}/${vat}/${total} do not match seed ${e.subtotal}/${e.vat}/${e.total}`);
  }
  return { lines, subtotal, vat, total };
}

export function coolBreezeQrBase64(variant: NameVariant): string {
  const inv = COOL_BREEZE_INVOICE;
  const t = coolBreezeTotals();
  return zatcaQrBase64([
    namesFor(variant).supplierPartyName,
    COOL_BREEZE.vat,
    `${inv.issueDate}T${inv.issueTime}`,
    SAR(t.total),
    SAR(t.vat),
    DUMMY.invoiceDigest,
    DUMMY.signatureValue,
    DUMMY.publicKey,
  ]);
}

function address(a: (typeof COOL_BREEZE)["address"]["en"], indent: string): string {
  return [
    `${indent}<cac:PostalAddress>`,
    `${indent}  <cbc:StreetName>${esc(a.street)}</cbc:StreetName>`,
    `${indent}  <cbc:BuildingNumber>${a.building}</cbc:BuildingNumber>`,
    `${indent}  <cbc:PlotIdentification>${a.additional}</cbc:PlotIdentification>`,
    `${indent}  <cbc:CitySubdivisionName>${esc(a.district)}</cbc:CitySubdivisionName>`,
    `${indent}  <cbc:CityName>${esc(a.city)}</cbc:CityName>`,
    `${indent}  <cbc:PostalZone>${a.postal}</cbc:PostalZone>`,
    `${indent}  <cbc:CountrySubentity>${esc(a.region)}</cbc:CountrySubentity>`,
    `${indent}  <cac:Country>`,
    `${indent}    <cbc:IdentificationCode>SA</cbc:IdentificationCode>`,
    `${indent}  </cac:Country>`,
    `${indent}</cac:PostalAddress>`,
  ].join("\n");
}

const TAX_CATEGORY_S = (indent: string, tag: "TaxCategory" | "ClassifiedTaxCategory") =>
  [
    `${indent}<cac:${tag}>`,
    `${indent}  <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">S</cbc:ID>`,
    `${indent}  <cbc:Percent>15.00</cbc:Percent>`,
    `${indent}  <cac:TaxScheme>`,
    `${indent}    <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>`,
    `${indent}  </cac:TaxScheme>`,
    `${indent}</cac:${tag}>`,
  ].join("\n");

export function buildCoolBreezeXml(variant: NameVariant): string {
  const inv = COOL_BREEZE_INVOICE;
  const S = COOL_BREEZE;
  const B = BUYER;
  const n = namesFor(variant);
  const t = coolBreezeTotals();
  const amt = (h: number) => `currencyID="SAR">${SAR(h)}`;

  const lines = inv.lines
    .map((l, i) => {
      const lt = t.lines[i];
      return `  <cac:InvoiceLine>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${l.unitCode}">${l.quantity.toFixed(6)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount ${amt(lt.lineExtension)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount ${amt(lt.vat)}</cbc:TaxAmount>
      <cbc:RoundingAmount ${amt(lt.rounding)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${esc(n.line(l))}</cbc:Name>
      <cac:SellersItemIdentification>
        <cbc:ID>${l.sellerItemId}</cbc:ID>
      </cac:SellersItemIdentification>
${TAX_CATEGORY_S("      ", "ClassifiedTaxCategory")}
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount ${amt(l.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <!-- PLACEHOLDER cryptographic stamp. Every value in this block is FAKE (Darb Bill Pay prototype fixture, fictitious supplier). It will not validate against ZATCA. -->
        <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
          <sac:SignatureInformation>
            <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
            <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
            <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
              <ds:SignedInfo>
                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                <ds:Reference Id="invoiceSignedData" URI="">
                  <ds:Transforms>
                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                      <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                    </ds:Transform>
                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                      <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                    </ds:Transform>
                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                      <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                    </ds:Transform>
                    <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                  </ds:Transforms>
                  <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                  <ds:DigestValue>${DUMMY.invoiceDigest}</ds:DigestValue>
                </ds:Reference>
                <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
                  <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                  <ds:DigestValue>${DUMMY.signedPropsDigest}</ds:DigestValue>
                </ds:Reference>
              </ds:SignedInfo>
              <ds:SignatureValue>${DUMMY.signatureValue}</ds:SignatureValue>
              <ds:KeyInfo>
                <ds:X509Data>
                  <ds:X509Certificate>${DUMMY.certificate}</ds:X509Certificate>
                </ds:X509Data>
              </ds:KeyInfo>
              <ds:Object>
                <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
                  <xades:SignedProperties Id="xadesSignedProperties">
                    <xades:SignedSignatureProperties>
                      <xades:SigningTime>${inv.issueDate}T${inv.issueTime}</xades:SigningTime>
                      <xades:SigningCertificate>
                        <xades:Cert>
                          <xades:CertDigest>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                            <ds:DigestValue>${DUMMY.certDigest}</ds:DigestValue>
                          </xades:CertDigest>
                          <xades:IssuerSerial>
                            <ds:X509IssuerName>${DUMMY.issuerName}</ds:X509IssuerName>
                            <ds:X509SerialNumber>${DUMMY.serial}</ds:X509SerialNumber>
                          </xades:IssuerSerial>
                        </xades:Cert>
                      </xades:SigningCertificate>
                    </xades:SignedSignatureProperties>
                  </xades:SignedProperties>
                </xades:QualifyingProperties>
              </ds:Object>
            </ds:Signature>
          </sac:SignatureInformation>
        </sig:UBLDocumentSignatures>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${inv.id}</cbc:ID>
  <cbc:UUID>${inv.uuid}</cbc:UUID>
  <cbc:IssueDate>${inv.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${inv.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:OrderReference>
    <cbc:ID>${inv.orderRef}</cbc:ID>
  </cac:OrderReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${inv.icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${PIH}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${coolBreezeQrBase64(variant)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:Signature>
    <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
    <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${S.cr}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${esc(n.supplierPartyName)}</cbc:Name>
      </cac:PartyName>
${address(S.address[n.addressLang], "      ")}
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${S.vat}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(n.supplierRegistrationName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:ElectronicMail>${S.email}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${B.cr}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${esc(n.buyerPartyName)}</cbc:Name>
      </cac:PartyName>
${address(B.address[n.addressLang], "      ")}
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${B.vat}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(n.buyerRegistrationName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${inv.supplyDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${inv.dueDate}</cbc:PaymentDueDate>
    <cbc:InstructionNote>${esc(n.paymentNote)}</cbc:InstructionNote>
    <cbc:PaymentID>${inv.id}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${S.iban}</cbc:ID>
      <cbc:Name>${esc(n.accountName)}</cbc:Name>
      <cac:FinancialInstitutionBranch>
        <cbc:Name>${esc(n.bank)}</cbc:Name>
      </cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>${esc(n.paymentTerms)}</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount ${amt(t.vat)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount ${amt(t.subtotal)}</cbc:TaxableAmount>
      <cbc:TaxAmount ${amt(t.vat)}</cbc:TaxAmount>
${TAX_CATEGORY_S("      ", "TaxCategory")}
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount ${amt(t.vat)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount ${amt(t.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount ${amt(t.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount ${amt(t.total)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount ${amt(0)}</cbc:AllowanceTotalAmount>
    <cbc:PrepaidAmount ${amt(0)}</cbc:PrepaidAmount>
    <cbc:PayableAmount ${amt(t.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</Invoice>
`;
}

// ---------- Hostile inputs (inert text; the app must reject them) ----------

const UBL_NS =
  'xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"';

function hostileInvoice(id: string, injected: string): string {
  return `<Invoice ${UBL_NS}>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${id}</cbc:ID>
  <cbc:UUID>00000000-0000-4000-8000-000000000000</cbc:UUID>
  <cbc:IssueDate>2026-10-13</cbc:IssueDate>
  <cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>300000000000003</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${injected}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">15.00</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="SAR">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">115.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">115.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>
`;
}

export function buildXxeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TEST FIXTURE (hostile input): declares an external entity pointing at a local file. The invoice reader must reject this file (no DOCTYPE / no entity expansion). Inert text; nothing here runs. -->
<!DOCTYPE Invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
${hostileInvoice("INV-TEST-XXE-0001", "&xxe;")}`;
}

export function buildBillionLaughsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TEST FIXTURE (hostile input): "billion laughs" entity expansion (about 3 GB if expanded). The invoice reader must reject this file (no DOCTYPE / no entity expansion). Inert text; nothing here runs. -->
<!DOCTYPE Invoice [
  <!ENTITY lol "lol">
  <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
  <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
  <!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;">
  <!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;">
  <!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;">
  <!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;">
  <!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">
]>
${hostileInvoice("INV-TEST-LOL-0001", "&lol9;")}`;
}
