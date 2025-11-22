import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { RiskLevel } from "@shared/schema";

interface StreamedIngredient {
  ingredient: string;
  riskLevel: RiskLevel;
  summary: string;
  fromCache: boolean;
}

interface StreamingResultsProps {
  ingredients: string[];
  category: string;
  userLanguage: string;
  onComplete: () => void;
}

export function StreamingResults({
  ingredients,
  category,
  userLanguage,
  onComplete,
}: StreamingResultsProps) {
  const [results, setResults] = useState<StreamedIngredient[]>([]);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const startStreaming = async () => {
      try {
        const response = await fetch("/api/stream-ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredients,
            category,
            userLanguage,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to start streaming");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            if (line.startsWith("event: ingredientResult")) {
              // Read next line for data
              const nextIdx = lines.indexOf(line) + 1;
              if (nextIdx < lines.length && lines[nextIdx].startsWith("data:")) {
                const jsonStr = lines[nextIdx].substring(5).trim();
                const result = JSON.parse(jsonStr) as StreamedIngredient;
                setResults((prev) => [...prev, result]);
              }
            } else if (line.startsWith("event: ingredientError")) {
              const nextIdx = lines.indexOf(line) + 1;
              if (
                nextIdx < lines.length &&
                lines[nextIdx].startsWith("data:")
              ) {
                const jsonStr = lines[nextIdx].substring(5).trim();
                const error = JSON.parse(jsonStr);
                setErrors(
                  (prev) =>
                    new Map(prev).set(error.ingredient, error.error)
                );
              }
            } else if (line.startsWith("event: done")) {
              setIsComplete(true);
              setIsLoading(false);
              onComplete();
            }
          }
        }
      } catch (error) {
        console.error("Streaming error:", error);
        setIsLoading(false);
      }
    };

    startStreaming();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [ingredients, category, userLanguage, onComplete]);

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case "high":
        return "bg-destructive/20 text-destructive";
      case "moderate":
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case "low":
        return "bg-green-500/20 text-green-700 dark:text-green-400";
    }
  };

  return (
    <div className="space-y-3">
      {/* Streaming Results */}
      {results.map((result, idx) => (
        <Card
          key={`${result.ingredient}-${idx}`}
          className="p-4 animate-in fade-in slide-in-from-top-2 duration-300"
          data-testid={`card-ingredient-${result.ingredient}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3
                  className="font-semibold text-foreground break-words"
                  data-testid={`text-ingredient-name-${result.ingredient}`}
                >
                  {result.ingredient}
                </h3>
                <Badge
                  variant="secondary"
                  className={getRiskColor(result.riskLevel)}
                  data-testid={`badge-risk-${result.ingredient}`}
                >
                  {result.riskLevel}
                </Badge>
                {result.fromCache && (
                  <Badge variant="outline" className="text-xs">
                    cached
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {result.summary}
              </p>
            </div>
          </div>
        </Card>
      ))}

      {/* Error Results */}
      {errors.size > 0 &&
        Array.from(errors.entries()).map(([ingredient, error]) => (
          <Card
            key={`error-${ingredient}`}
            className="p-4 border-destructive/50 bg-destructive/5"
            data-testid={`card-error-${ingredient}`}
          >
            <div className="flex items-start gap-2">
              <div className="text-destructive mt-1">⚠</div>
              <div>
                <h3 className="font-semibold text-foreground">{ingredient}</h3>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          </Card>
        ))}

      {/* Loading State */}
      {isLoading && results.length === 0 && (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-4">
            Processing {ingredients.length} ingredients...
          </p>
        </Card>
      )}

      {/* Loading spinner for more results */}
      {isLoading && results.length > 0 && (
        <Card className="p-4 text-center">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          <span className="text-sm text-muted-foreground">
            Analyzing {ingredients.length - results.length} remaining...
          </span>
        </Card>
      )}

      {/* Completion Message */}
      {isComplete && (
        <Card className="p-4 text-center bg-green-500/10 border-green-500/20">
          <p className="text-green-700 dark:text-green-400 font-semibold">
            ✓ Analysis complete! ({results.length} ingredients analyzed)
          </p>
        </Card>
      )}

      {/* No Results */}
      {!isLoading && results.length === 0 && !isComplete && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No ingredients to analyze</p>
        </Card>
      )}
    </div>
  );
}
