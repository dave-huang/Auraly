import { Card } from "@/components/ui/card";
import { Salad, Droplet, Smile, Sparkles } from "lucide-react";
import type { ProductType } from "@shared/schema";

interface ProductTypeSelectorProps {
  onSelect: (type: ProductType) => void;
}

const productTypes = [
  {
    type: "food" as ProductType,
    label: "Food",
    icon: Salad,
    description: "Snacks, meals, beverages"
  },
  {
    type: "skincare" as ProductType,
    label: "Skincare / Haircare",
    icon: Droplet,
    description: "Lotions, shampoos, serums"
  },
  {
    type: "oral-care" as ProductType,
    label: "Oral Care",
    icon: Smile,
    description: "Toothpaste, mouthwash"
  },
  {
    type: "cosmetics" as ProductType,
    label: "Cosmetics / Fragrance",
    icon: Sparkles,
    description: "Makeup, perfumes"
  }
];

export function ProductTypeSelector({ onSelect }: ProductTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {productTypes.map(({ type, label, icon: Icon, description }) => (
        <Card
          key={type}
          className="p-6 cursor-pointer hover-elevate active-elevate-2 transition-all text-center min-h-32 flex flex-col items-center justify-center"
          onClick={() => onSelect(type)}
          data-testid={`card-product-type-${type}`}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-1 text-sm md:text-base">{label}</h3>
          <p className="text-xs text-muted-foreground hidden md:block">{description}</p>
        </Card>
      ))}
    </div>
  );
}
