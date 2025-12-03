import { Card } from "@/components/ui/card";
import { UtensilsCrossed, SprayCan } from "lucide-react";
import type { ProductType } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface ProductTypeSelectorProps {
  onSelect: (type: ProductType) => void;
}

const categoryOptions: Array<{ type: ProductType; icon: any; key: string }> = [
  { type: "food", icon: UtensilsCrossed, key: "food" },
  { type: "personal_care", icon: SprayCan, key: "personalCare" }
];

export function ProductTypeSelector({ onSelect }: ProductTypeSelectorProps) {
  const { t } = useTranslation();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
      {categoryOptions.map(({ type, icon: Icon, key }) => (
        <Card
          key={type}
          className="p-8 cursor-pointer hover-elevate active-elevate-2 transition-all text-center min-h-48 flex flex-col items-center justify-center"
          onClick={() => onSelect(type)}
          data-testid={`card-category-${type}`}
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Icon className="w-10 h-10 text-primary" />
          </div>
          <h3 className="font-semibold text-xl mb-2">
            {t(`upload.categories.${key}.label`)}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t(`upload.categories.${key}.description`)}
          </p>
        </Card>
      ))}
    </div>
  );
}
