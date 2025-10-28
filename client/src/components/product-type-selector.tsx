import { Card } from "@/components/ui/card";
import { Salad, Droplet, Smile, Sparkles } from "lucide-react";
import type { ProductType } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface ProductTypeSelectorProps {
  onSelect: (type: ProductType) => void;
}

const productTypesList: Array<{ type: ProductType; icon: any; key: string }> = [
  { type: "food", icon: Salad, key: "food" },
  { type: "skincare", icon: Droplet, key: "skincare" },
  { type: "oral-care", icon: Smile, key: "oralCare" },
  { type: "cosmetics", icon: Sparkles, key: "cosmetics" }
];

export function ProductTypeSelector({ onSelect }: ProductTypeSelectorProps) {
  const { t } = useTranslation();
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {productTypesList.map(({ type, icon: Icon, key }) => (
        <Card
          key={type}
          className="p-6 cursor-pointer hover-elevate active-elevate-2 transition-all text-center min-h-32 flex flex-col items-center justify-center"
          onClick={() => onSelect(type)}
          data-testid={`card-product-type-${type}`}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-1 text-sm md:text-base">
            {t(`upload.productTypes.${key}.label`)}
          </h3>
          <p className="text-xs text-muted-foreground hidden md:block">
            {t(`upload.productTypes.${key}.description`)}
          </p>
        </Card>
      ))}
    </div>
  );
}
