import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openWhatsApp } from "@/lib/whatsapp";

interface WhatsAppButtonProps {
  phone: string;
  message?: string;
  name?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "ghost" | "outline";
  className?: string;
}

export function WhatsAppButton({
  phone,
  message,
  name,
  size = "icon",
  variant = "ghost",
  className,
}: WhatsAppButtonProps) {
  if (!phone) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openWhatsApp(phone, message);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          onClick={handleClick}
        >
          <MessageCircle className="h-4 w-4 text-green-600" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>שלח הודעת WhatsApp{name ? ` ל${name}` : ""}</p>
      </TooltipContent>
    </Tooltip>
  );
}
