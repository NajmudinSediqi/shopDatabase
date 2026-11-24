"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { NotebookPen, X, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const sections = React.Children.toArray(children);
  const isHeader = (child: React.ReactNode) => React.isValidElement(child) && child.type === DialogHeader;
  const isFooter = (child: React.ReactNode) => React.isValidElement(child) && child.type === DialogFooter;
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-slot="dialog-content"
      dir="rtl"
      className={cn(
        "shop-dialog fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-lg border bg-background p-0 text-[13px] shadow-elevated duration-200 md:text-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {sections.filter(isHeader)}
      <div className="shop-dialog-body flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-4 md:gap-5 md:p-6">
        {sections.filter((child) => !isHeader(child) && !isFooter(child))}
      </div>
      {sections.filter(isFooter)}
      <DialogPrimitive.Close className="absolute left-3 top-3 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted ring-offset-background cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none md:left-5 md:top-5">
        <X className="h-4 w-4" />
        <span className="sr-only">بستن</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
);
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="dialog-header" className={cn("flex shrink-0 flex-col gap-1 bg-muted/30 p-4 ps-4 pe-14 text-right md:p-6 md:pe-16", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn("flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/30 p-4 sm:flex-row sm:justify-end md:px-6 md:py-4 [&>button]:min-h-9", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & { icon?: LucideIcon }
>(({ className, children, icon: Icon = NotebookPen, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("flex min-w-0 items-center gap-2 text-sm font-bold leading-relaxed md:gap-3 md:text-lg", className)}
    {...props}
  >
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 md:size-10">
      <Icon className="size-4 md:size-5" />
    </span>
    <span className="min-w-0 break-words">{children}</span>
  </DialogPrimitive.Title>
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
