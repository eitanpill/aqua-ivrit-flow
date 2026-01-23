import * as React from "react";
import { useDeviceType } from "@/hooks/useDeviceType";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface AdaptiveModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface AdaptiveModalTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface AdaptiveModalContentProps {
  children: React.ReactNode;
  className?: string;
}

interface AdaptiveModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface AdaptiveModalTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface AdaptiveModalDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface AdaptiveModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

interface AdaptiveModalCloseProps {
  children: React.ReactNode;
  asChild?: boolean;
}

const AdaptiveModalContext = React.createContext<{
  isMobile: boolean;
}>({ isMobile: false });

export function AdaptiveModal({ open, onOpenChange, children }: AdaptiveModalProps) {
  const { isMobile } = useDeviceType();

  if (isMobile) {
    return (
      <AdaptiveModalContext.Provider value={{ isMobile: true }}>
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      </AdaptiveModalContext.Provider>
    );
  }

  return (
    <AdaptiveModalContext.Provider value={{ isMobile: false }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </AdaptiveModalContext.Provider>
  );
}

export function AdaptiveModalTrigger({ children, asChild }: AdaptiveModalTriggerProps) {
  const { isMobile } = React.useContext(AdaptiveModalContext);
  
  if (isMobile) {
    return <DrawerTrigger asChild={asChild}>{children}</DrawerTrigger>;
  }
  
  return <DialogTrigger asChild={asChild}>{children}</DialogTrigger>;
}

export function AdaptiveModalContent({ children, className }: AdaptiveModalContentProps) {
  const { isMobile } = React.useContext(AdaptiveModalContext);

  if (isMobile) {
    return (
      <DrawerContent className={cn("max-h-[85vh]", className)}>
        <div className="overflow-auto max-h-[calc(85vh-2rem)] px-4 pb-4">
          {children}
        </div>
      </DrawerContent>
    );
  }

  return (
    <DialogContent className={cn("max-h-[85vh] overflow-auto", className)}>
      {children}
    </DialogContent>
  );
}

export function AdaptiveModalHeader({ children, className }: AdaptiveModalHeaderProps) {
  const { isMobile } = React.useContext(AdaptiveModalContext);

  if (isMobile) {
    return <DrawerHeader className={className}>{children}</DrawerHeader>;
  }

  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function AdaptiveModalTitle({ children, className }: AdaptiveModalTitleProps) {
  const { isMobile } = React.useContext(AdaptiveModalContext);

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>;
  }

  return <DialogTitle className={className}>{children}</DialogTitle>;
}

export function AdaptiveModalDescription({ children, className }: AdaptiveModalDescriptionProps) {
  const { isMobile } = React.useContext(AdaptiveModalContext);

  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>;
  }

  return <DialogDescription className={className}>{children}</DialogDescription>;
}

export function AdaptiveModalFooter({ children, className }: AdaptiveModalFooterProps) {
  const { isMobile } = React.useContext(AdaptiveModalContext);

  if (isMobile) {
    return <DrawerFooter className={className}>{children}</DrawerFooter>;
  }

  return <DialogFooter className={className}>{children}</DialogFooter>;
}

export function AdaptiveModalClose({ children, asChild }: AdaptiveModalCloseProps) {
  const { isMobile } = React.useContext(AdaptiveModalContext);

  if (isMobile) {
    return <DrawerClose asChild={asChild}>{children}</DrawerClose>;
  }

  return <DialogClose asChild={asChild}>{children}</DialogClose>;
}
