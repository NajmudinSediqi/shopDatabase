export const customerBillStyles = `@page {
  size: A4;
  margin: 12mm;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #fff;
  color: #202020;
  font:
    11px Tahoma,
    Arial,
    sans-serif;
  line-height: 1.9;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
h1,
h2,
p {
  margin: 0;
}
header {
  margin-bottom: 15px;
  border-bottom: 6px solid #ff9b00;
  position: relative;
}
header::after {
  content: "";
  position: absolute;
  bottom: -6px;
  left: 0;
  width: 46%;
  height: 6px;
  background: #e83121;
}
.masthead {
  display: flex;
  min-height: 110px;
  overflow: hidden;
}
.brand {
  width: 56%;
  padding: 18px 20px;
  text-align: center;
  align-self: center;
}
.brand h1 {
  color: #de3d21;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.eyebrow {
  display: inline-block;
  background: #202020;
  padding: 0 14px;
  border-radius: 12px 0;
  color: #ffab19;
  font-size: 10px;
  margin-bottom: 5px;
}
.brand-subtitle {
  color: #7f4b39;
  font-size: 11px;
  margin-top: 3px;
}
.contact {
  width: 44%;
  background: #1c1c1c;
  color: #ffbf48;
  padding: 20px 28px 20px 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  font-size: 10px;
  overflow-wrap: anywhere;
}
.contact::before {
  content: "";
  position: absolute;
  right: -28px;
  top: -35px;
  height: 200px;
  width: 50px;
  border-radius: 50%;
  background: #fff;
  box-shadow:
    -9px 0 #ffb000,
    -18px 0 #f86122,
    -24px 0 #e73525;
}
.contact > div {
  position: relative;
  z-index: 1;
  padding-right: 13px;
}
.meta {
  margin-bottom: 12px;
}
.bill-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 11px;
}
.bill-info strong {
  font-size: 14px;
}
.bill-info .date-label {
  background: #202020;
  color: #fff;
  padding: 2px 10px;
  margin-left: 8px;
}
.customer-line {
  display: flex;
  border: 1px solid #aaa;
  border-radius: 5px;
  min-height: 30px;
  margin-bottom: 6px;
  overflow: hidden;
  align-items: stretch;
}
.customer-line .label {
  background: #252525;
  color: white;
  padding: 3px 10px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 85px;
}
.customer-line .value {
  padding: 3px 10px;
  overflow-wrap: anywhere;
}
.customer-name {
  font-weight: 700;
}
.numbers {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-bottom: 14px;
}
thead {
  display: table-header-group;
}
th,
td {
  text-align: right;
  padding: 7px 8px;
  border: 1px solid #a8a8a8;
  vertical-align: top;
  overflow-wrap: anywhere;
}
th {
  background: #f28b08;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
th:last-child {
  background: #d62d20;
}
th:first-child {
  width: 7%;
}
th:nth-child(2) {
  width: 31%;
}
th:nth-child(3) {
  width: 10%;
}
th:nth-child(4) {
  width: 16%;
}
th:nth-child(5),
th:nth-child(6) {
  width: 18%;
}
tr {
  break-inside: avoid;
}
tbody td:nth-child(2n) {
  background: #fffcf7;
}
.blank-row td {
  height: 27px;
  padding: 0;
}
.bottom {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 20px;
  margin-bottom: 14px;
}
.notes {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.section-title {
  font-size: 11px;
  margin: 0 0 6px;
}
.totals {
  border: 1px solid #aaa;
  break-inside: avoid;
}
.pair {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 10px;
  border-bottom: 1px solid #ddd;
}
.pair:last-child {
  border: 0;
}
.net {
  font-weight: 700;
  color: #bd4b09;
  background: #fff5e5;
}
.balance {
  font-weight: 700;
  color: #b52d1b;
  background: #fff0e9;
}
.payment-table {
  font-size: 10px;
  margin-top: 6px;
}
.payment-table th {
  width: auto;
  background: #f0ece5;
  color: #333;
}
.payment-table th:first-child {
  width: 28%;
}
.payment-table th:nth-child(2) {
  width: 42%;
}
.payment-table th:last-child {
  width: 30%;
}
.payment-table td {
  padding: 4px 6px;
}
.signatures {
  display: flex;
  justify-content: space-between;
  gap: 50px;
  margin: 32px 0 20px;
  break-inside: avoid;
}
.signatures div {
  width: 38%;
  border-top: 1px solid #999;
  padding-top: 7px;
  text-align: center;
  color: #555;
  font-size: 10px;
}
footer {
  border-bottom: 6px solid #f5910b;
  border-top: 1px solid #ddd;
  padding: 10px 12px;
  text-align: center;
  position: relative;
  break-inside: avoid;
}
footer::after {
  content: "";
  position: absolute;
  bottom: -6px;
  left: 0;
  height: 6px;
  width: 35%;
  background: #db3021;
}
footer strong {
  font-size: 11px;
}
.footer-contact {
  font-size: 10px;
  color: #666;
  overflow-wrap: anywhere;
  margin-top: 3px;
}
.print-note {
  font-size: 9px;
  color: #777;
  margin-top: 5px;
}
@media screen {
  body {
    max-width: 186mm;
    margin: 24px auto;
  }
}
/* Brand system: print-safe colors, the owner's original artwork and a calmer grid. */
header { border-bottom-color: var(--bill-accent); }
header::after, footer::after { background: var(--bill-primary); }
.masthead { min-height: 104px; border: 1px solid #dce1ea; border-radius: 10px 10px 0 0; }
.brand { display: flex; align-items: center; gap: 12px; text-align: right; padding: 12px 16px; width: 58%; }
.brand h1 { font-size: 22px; color: var(--bill-title); }
.brand-subtitle { color: #566176; font-size: 10px; }
.eyebrow { background: transparent; color: var(--bill-accent); padding: 0; font-size: 10px; font-weight: bold; border-radius: 0; }
.contact { width: 42%; background: var(--bill-primary); color: #fff; padding: 12px 20px; gap: 3px; font-size: 9px; }
.contact::before { display: none; }
.contact > div { padding-right: 0; }
.noor-logo { position: relative; display: block; width: 96px; height: 73px; flex-shrink: 0; overflow: hidden; border-radius: 6px; background: #fff; }
.noor-logo img { position: absolute; width: 324px; max-width: none; height: 216px; left: -34px; top: -10px; }
.product-strip { display: grid; grid-template-columns: repeat(9,1fr); padding: 7px 8px; gap: 3px; background: #fff; border: 1px solid #dce1ea; border-top: 0; }
.product-category { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 8px; text-align: center; color: #475066; }
.product-icon { position: relative; display: block; width: 36px; height: 36px; overflow: hidden; }
.product-icon img { position: absolute; width: 432px; height: 288px; max-width: none; }
th, th:last-child { background: var(--bill-primary); color: #fff; padding: 6px 8px; }
th, td { border-color: #d5dae5; }
tbody td:nth-child(2n) { background: white; }
.date-label, .customer-line .label { background: var(--bill-primary); }
.customer-line { border-color: #d5dae5; }
.bill-info .date-label { background: var(--bill-primary); }
.net { color: var(--bill-primary); background: #f1f4f9; }
.balance { color: var(--bill-accent); background: #f6f7fa; }
.blank-row td { height: 24px; }
footer { border-bottom-color: var(--bill-accent); padding: 8px 12px; }
.footer-contact { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 18px; }
.signatures { margin: 24px 0 16px; }
.contact-line { display: flex; align-items: center; gap: 6px; }
.contact-symbol { position: relative; display: inline-block; width: 19px; height: 20px; flex-shrink: 0; overflow: hidden; border-radius: 50%; }
.contact-symbol img { position: absolute; width: 313.2px; height: 208.8px; max-width: none; }
.customer-summary { display: grid; grid-template-columns: 1.05fr 1.7fr 1fr; gap: 14px; margin: 12px 0 8px; font-size: 9px; line-height: 1.6; }
.customer-summary.no-address { grid-template-columns: 1fr 1fr; }
.customer-field { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.customer-field > span:first-child { white-space: nowrap; color: #556078; }
.customer-value { flex: 1; min-width: 0; border-bottom: 1px solid #9ba7bc; padding: 0 2px 4px; overflow-wrap: anywhere; }
.customer-name { font-weight: 600; }
.invoice-status { display: flex; flex-wrap: wrap; gap: 6px 14px; justify-content: space-between; font-size: 9px; color: #626d80; }
footer { margin-top: 20px; padding: 12px 14px; background: #f8faff; border-top: 2px solid var(--bill-primary); }
.footer-layout { display: grid; grid-template-columns: minmax(0,1fr); gap: 20px; align-items: center; text-align: right; }
.footer-layout.has-qr { grid-template-columns: minmax(0,1fr) 116px; }
.footer-main { min-width: 0; }
.footer-main > strong { display: block; color: var(--bill-primary); margin-bottom: 8px; }
.footer-contact { display: grid; justify-content: stretch; gap: 5px; font-size: 9px; }
.footer-qr { text-align: center; background: white; padding: 5px; border: 1px solid #dce2ed; border-radius: 6px; }
.footer-qr > img { display: block; width: 102px; height: 102px; object-fit: contain; background: white; margin: 0 auto; }
.footer-qr > p { font-size: 8px; color: #526078; margin-top: 4px; line-height: 1.6; overflow-wrap: anywhere; }
.seller-signature { width: 180px; margin-top: 23px; padding-top: 4px; border-top: 1px solid #9ba7bc; text-align: center; font-size: 9px; color: #596579; }
/* Repeating document header; the summary is a separate, unbroken final row. */
.bill-document { width: 100%; border: 0; border-collapse: collapse; margin: 0; table-layout: fixed; }
.bill-document > thead { display: table-header-group; }
.bill-document > tfoot { display: table-footer-group; }
.bill-document > thead > tr > td, .bill-document > tbody > .final-row > td, .bill-document > tfoot > tr > td { border: 0; padding: 0; background: white; }
.bill-document > tbody > tr { break-inside: avoid; }
.bill-document > tbody > .final-row { break-inside: avoid; page-break-inside: avoid; }
.bill-document > tbody > .final-row > td { padding-top: 14px; }
.bill-document > thead > tr > td { padding-bottom: 4px; }
.bill-document footer { margin-top: 12px; padding: 8px 10px; }
.footer-layout { gap: 12px; }
.footer-layout.has-qr { grid-template-columns: minmax(0,1fr) 96px; }
.footer-main > strong { font-size: 10px; margin-bottom: 4px; }
.footer-contact { gap: 3px; font-size: 8px; line-height: 1.6; }
.footer-qr { padding: 4px; }
.footer-qr > img { width: 84px; height: 84px; }
.footer-qr > p { font-size: 7px; margin-top: 2px; }
.print-note { font-size: 8px; margin-top: 4px; }
.return-note { font-size: 9px; font-weight: 600; margin-top: 5px; color: var(--bill-primary); }
.seller-signature { width: 150px; margin-top: 14px; font-size: 8px; padding-top: 3px; }
/* Keep the complete repeating thead below a quarter of an A4 print area. */
.bill-document > thead { break-inside: avoid; }
.bill-document header { margin-bottom: 6px; }
.bill-document .masthead { min-height: 72px; }
.bill-document .brand { padding: 6px 12px; gap: 10px; }
.bill-document .brand h1 { font-size: 20px; line-height: 1.4; }
.bill-document .eyebrow { font-size: 8px; line-height: 1.2; margin-bottom: 2px; }
.bill-document .brand-subtitle { font-size: 8px; line-height: 1.5; margin-top: 2px; }
.bill-document .noor-logo { width: 74px; height: 56px; }
.bill-document .noor-logo img { width: 248.4px; height: 165.6px; left: -26px; top: -7.7px; }
.bill-document .contact { padding: 6px 12px; font-size: 8px; line-height: 1.6; }
.bill-document .product-strip { padding: 4px 6px; }
.bill-document .product-category { font-size: 7px; line-height: 1.5; }
.bill-document .product-icon { transform: scale(.72); margin: -5px; }
.bill-document .meta { margin-bottom: 4px; }
.bill-document .bill-info { margin-bottom: 3px; }
.bill-document .customer-summary { margin: 6px 0 3px; }

.bill-document > .settlement-items { break-inside: avoid; page-break-inside: avoid; }

/* Product and payment grids share a quiet, legible row rhythm. */
.bill-document > tbody > tr:not(.final-row):nth-child(even) > td,
.payment-table > tbody > tr:nth-child(even) > td { background: #f4f6fa; }
.bill-document > tbody > tr:not(.final-row) > td { vertical-align: middle; border-color: #dce2ec; }
.bill-document > tbody > tr:not(.final-row) > td:first-child { text-align: center; color: #66738a; font-size: 10px; }
.bill-document > tbody > tr:not(.final-row) > td:last-child { font-weight: 700; color: var(--bill-primary); }
.bill-document .numbers { text-align: left; font-variant-numeric: tabular-nums; }
.payment-table th, .payment-table th:last-child { background: #eef2f8; color: var(--bill-primary); border-color: #dce2ec; font-size: 9px; }
.payment-table td { border-color: #dce2ec; vertical-align: middle; }
.totals { border-color: #dce2ec; }
.pair { border-bottom-color: #e4e8f0; }
`;
