import { UtensilsCrossed, Sparkles } from "lucide-react";
import type { ProductType } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface ProductTypeSelectorProps {
  onSelect: (type: ProductType) => void;
}

const categoryOptions: Array<{ type: ProductType; icon: any; key: string }> = [
  { type: "food", icon: UtensilsCrossed, key: "food" },
  { type: "personal_care", icon: Sparkles, key: "personalCare" }
];

export function ProductTypeSelector({ onSelect }: ProductTypeSelectorProps) {
  const { t } = useTranslation();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
      {categoryOptions.map(({ type, icon: Icon, key }) => (
        <button
          key={type}
          className="p-10 cursor-pointer rounded-lg bg-card/60 border border-border/40 hover-elevate active-elevate-2 transition-all duration-300 text-center min-h-52 flex flex-col items-center justify-center group"
          onClick={() => onSelect(type)}
          data-testid={`card-category-${type}`}
        >
          <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center mb-6 border border-primary/10 transition-all duration-300 group-hover:bg-primary/12">
            <Icon className="w-9 h-9 text-primary/70 transition-colors group-hover:text-primary" />
          </div>
          <h3 className="font-medium text-xl mb-3">
            {t(`upload.categories.${key}.label`)}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
            {t(`upload.categories.${key}.description`)}
          </p>
        </button>
      ))}
    </div>
  );
}
