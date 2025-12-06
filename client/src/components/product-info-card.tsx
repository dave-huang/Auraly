import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Loader2, UtensilsCrossed, Sparkles, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ProductInfoCardProps {
  productName: string;
  productType: 'food' | 'personal_care' | string;
  imageUrl?: string | null;
  createdAt?: Date | string | null;
  onRename?: (newName: string) => void;
  isRenaming?: boolean;
}

export function ProductInfoCard({
  productName,
  productType,
  imageUrl,
  createdAt,
  onRename,
  isRenaming = false,
}: ProductInfoCardProps) {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(productName || '');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  const handleSave = () => {
    if (editedName.trim() && onRename) {
      onRename(editedName.trim());
      setIsEditingName(false);
    }
  };

  const handleCancel = () => {
    setEditedName(productName || '');
    setIsEditingName(false);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const normalizedType = productType === 'food' ? 'food' : 'personal_care';
  const CategoryIcon = normalizedType === 'food' ? UtensilsCrossed : Sparkles;

  return (
    <Card className="p-6 mb-8">
      <div className="flex gap-5">
        {imageUrl && (
          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted/50 border border-border/30">
            <img 
              src={imageUrl} 
              alt={productName}
              className="w-full h-full object-cover"
              data-testid="img-product"
            />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-3">
              <Input
                ref={nameInputRef}
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder={t('results.productName.placeholder')}
                className="font-display text-lg h-auto py-1.5"
                data-testid="input-product-name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSave();
                  } else if (e.key === 'Escape') {
                    handleCancel();
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSave}
                disabled={isRenaming || !editedName.trim()}
                data-testid="button-save-name"
              >
                {isRenaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                disabled={isRenaming}
                data-testid="button-cancel-name"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditedName(productName || '');
                setIsEditingName(true);
              }}
              className="group flex items-center gap-2 text-left hover-elevate rounded-md px-2 py-1 -ml-2 mb-2"
              data-testid="button-edit-product-name"
            >
              <h1 className="font-display text-xl truncate" data-testid="text-product-name">
                {productName || t('results.productName.placeholder')}
              </h1>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          )}
          
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="outline" className="whitespace-nowrap inline-flex items-center rounded-md px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover-elevate [border-color:var(--badge-outline)] shadow-xs text-xs bg-orange-50/50 dark:bg-orange-950/15 text-orange-700 dark:text-orange-400 border-0 pl-[0px] pr-[0px]">
              <CategoryIcon className="w-3 h-3 mr-1" />
              {t(`history.categories.${normalizedType}`)}
            </Badge>
          </div>
          
          {createdAt && (
            <div className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(createdAt)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
