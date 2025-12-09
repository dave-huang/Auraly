import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NavigationMenu } from "@/components/navigation-menu";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Leaf, 
  Bug, 
  Lightbulb, 
  Heart, 
  Send, 
  Loader2,
  CheckCircle2,
  Home
} from "lucide-react";

type FeedbackType = "bug" | "improvement" | "positive";

export default function FeedbackPage() {
  const { t } = useTranslation();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("improvement");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: async (data: { type: FeedbackType; email?: string; message: string }) => {
      const response = await apiRequest("POST", "/api/feedback", data);
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    feedbackMutation.mutate({
      type: feedbackType,
      email: email.trim() || undefined,
      message: message.trim(),
    });
  };

  const feedbackOptions = [
    { value: "bug" as const, icon: Bug, label: t('feedback.types.bug') },
    { value: "improvement" as const, icon: Lightbulb, label: t('feedback.types.improvement') },
    { value: "positive" as const, icon: Heart, label: t('feedback.types.positive') },
  ];

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-primary/60" />
              <span className="font-display text-lg">{t('app.title')}</span>
            </div>
            <NavigationMenu showHomeLink />
          </div>
        </header>

        <main className="max-w-xl mx-auto px-6 py-16">
          <Card className="p-10 text-center rounded-xl border-border/30 shadow-sm">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl mb-3">{t('feedback.successTitle')}</h1>
            <p className="text-muted-foreground/80 font-light mb-8 leading-relaxed">
              {t('feedback.successMessage')}
            </p>
            <Link href="/">
              <Button className="rounded-xl px-6 gap-2" data-testid="button-back-home">
                <Home className="w-4 h-4" />
                {t('feedback.backHome')}
              </Button>
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                <span className="font-light hidden sm:inline">{t('common.back')}</span>
              </Button>
            </Link>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary/60" />
            <span className="font-display text-lg">{t('app.title')}</span>
          </div>
          <NavigationMenu showHomeLink />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl md:text-3xl mb-2">{t('feedback.title')}</h1>
          <p className="text-muted-foreground/80 font-light">{t('feedback.subtitle')}</p>
        </div>

        <Card className="p-6 md:p-8 rounded-xl border-border/30 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('feedback.typeLabel')}</Label>
              <RadioGroup
                value={feedbackType}
                onValueChange={(v) => setFeedbackType(v as FeedbackType)}
                className="grid grid-cols-1 gap-3"
              >
                {feedbackOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = feedbackType === option.value;
                  return (
                    <div key={option.value}>
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={option.value}
                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary/40 bg-primary/5 shadow-sm"
                            : "border-border/30 hover:border-border/50 hover:bg-muted/30"
                        }`}
                        data-testid={`radio-${option.value}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          isSelected ? "bg-primary/10" : "bg-muted/50"
                        }`}>
                          <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <span className={`font-light ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                          {option.label}
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">{t('feedback.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('feedback.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-card/80 border-border/30 font-light text-sm placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-primary/20 transition-all"
                data-testid="input-email"
              />
              <p className="text-xs text-muted-foreground/60 font-light">{t('feedback.emailHint')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-medium">{t('feedback.messageLabel')}</Label>
              <Textarea
                id="message"
                placeholder={t('feedback.messagePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="rounded-xl bg-card/80 border-border/30 font-light text-sm placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-primary/20 transition-all resize-none"
                data-testid="input-message"
              />
            </div>

            {feedbackMutation.isError && (
              <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                <p className="text-sm text-destructive font-medium">{t('feedback.errorTitle')}</p>
                <p className="text-xs text-destructive/80 font-light mt-1">{t('feedback.errorMessage')}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={!message.trim() || feedbackMutation.isPending}
              className="w-full h-12 rounded-xl text-base font-medium gap-2"
              data-testid="button-submit"
            >
              {feedbackMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('feedback.sending')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('feedback.submit')}
                </>
              )}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
