# Roadmap

## Done
- [x] Mobile compact text/icons on all database pages (phones)
- [x] Reorganize code into folders + keep it easy to edit by hand
  - split `src/components/shop/ui.tsx` into one-file-per-widget under `src/components/shop/<folder>/`
  - keep a single import path (`@/components/shop`) so pages stay simple
  - add a short Persian README mapping "what to change" → "which file"
- [x] Professional polish pass: real empty states, tidy toolbars, sidebar profile card,
      cohesive card tints, cleaner profit/loss banner, stable money formatting,
      fixed search-box icon overlap, cleaner chart axis

## Open
- [ ] English digits across amounts, quantities, dates and print output
- [ ] Consistent desktop/mobile form pop-ups with accessible scrolling and actions
- [x] AI assistant: ask questions about customer/supplier balances and bills (AI Gateway)
- [x] AI assistant page in sidebar: sales/expenses/profit + customer/supplier accounts
- [x] Sales page: «موجودی دکان» panel + per-line shop stock and last buy price
- [x] Flexible roles & permissions, user invite by email
