import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Menu, History, Settings, Globe, LogOut, Check, Home, MessageCircle } from "lucide-react";

interface NavigationMenuProps {
  showHomeLink?: boolean;
}

export function NavigationMenu({ showHomeLink = false }: NavigationMenuProps) {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const currentLang = i18n.language?.substring(0, 2) || 'en';

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'zh', name: '中文' }
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-nav-menu">
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t('nav.menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {showHomeLink && (
          <>
            <DropdownMenuItem asChild data-testid="nav-home">
              <Link href="/" className="flex items-center cursor-pointer">
                <Home className="mr-2 h-4 w-4" />
                {t('nav.home')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem asChild data-testid="nav-history">
          <Link href="/history" className="flex items-center cursor-pointer">
            <History className="mr-2 h-4 w-4" />
            {t('nav.history')}
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild data-testid="nav-settings">
          <Link href="/settings" className="flex items-center cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            {t('nav.settings')}
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild data-testid="nav-feedback">
          <Link href="/feedback" className="flex items-center cursor-pointer">
            <MessageCircle className="mr-2 h-4 w-4" />
            {t('nav.feedback')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="nav-language">
            <Globe className="mr-2 h-4 w-4" />
            {t('nav.language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                data-testid={`nav-lang-${lang.code}`}
              >
                {currentLang === lang.code && (
                  <Check className="mr-2 h-4 w-4" />
                )}
                <span className={currentLang !== lang.code ? "ml-6" : ""}>
                  {lang.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => window.location.href = "/api/logout"}
          data-testid="nav-logout"
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
