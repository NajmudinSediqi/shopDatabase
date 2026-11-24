# قطعه‌های این برنامه (راهنمای ساده)

اگر می‌خواهید چیزی را عوض کنید، اول همین جدول را ببینید:

| چه چیزی را می‌خواهید عوض کنید | به کدام فایل بروید |
| --- | --- |
| نام و آدرس صفحه‌ها در منوی کناری | `layout/nav.ts` |
| شکل منوی کناری، سربرگ بالا، واحد نمایش پول | `layout/app-shell.tsx` |
| عنوان بزرگ بالای هر صفحه | `widgets/page-header.tsx` |
| کارت‌های عددی (فروش امروز، ارزش انبار…) | `widgets/stat-card.tsx` |
| قاب سفید جدول و نوار جستجوی بالای آن | `widgets/table-card.tsx` |
| خانه‌های فرم (برچسب + آیکون + کادر) | `widgets/field.tsx` |
| لیست‌های کشی (واحد پول، دسته و…) | `widgets/selects.tsx` |
| انتخابگر تاریخ شمسی | `widgets/jalali-date.tsx` |
| دکمه حذف و پرسش «مطمئنید؟» | `widgets/confirm-delete.tsx` |
| جای خالی جدول‌ها («هنوز چیزی ثبت نشده») | `widgets/empty-state.tsx` |
| کادر جستجوی بالای جدول‌ها | `widgets/search-input.tsx` |
| پیام‌های خطا به فارسی | `widgets/error-message.ts` |
| نمودار روند ۳۰ روز | `charts/trend-chart.tsx` |
| فرم فاکتور فروش/خرید | `invoices/invoice-dialog.tsx` |
| جدول فاکتورهای فروش/خرید | `invoices/invoice-list.tsx` |
| پنل «موجودی دکان» بالای صفحه فروش | `invoices/shop-stock-panel.tsx` |
| صفحه مشتریان و تأمین‌کنندگان | `contacts/party-page.tsx` |

## نکته‌ها

- هر صفحه خودش در `src/routes/_authenticated/` است (مثلاً `products.tsx` = محصولات).
- همه قطعه‌ها را می‌توان این‌طور صدا زد: `import { PageHeader } from "@/components/shop";`
- اندازه نوشته‌ها و فاصله‌ها در گوشی: انتهای فایل `src/styles.css` (بخش «حالت فشرده موبایل»).
- رنگ‌ها و شكل عمومی: همان `src/styles.css` (بخش `:root` و `.dark`).
- اندازه نوشته‌ها در کامپیوتر: کلاس‌هایی که `md:` دارند (مثلاً `md:text-sm`).
