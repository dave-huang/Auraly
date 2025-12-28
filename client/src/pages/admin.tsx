import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, Users, Crown, Zap, TrendingUp, Search, 
  Loader2, AlertTriangle, Gift, Ban, RefreshCw, Trash2, Database,
  BarChart3, FlaskConical, Calendar, Beaker
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_USER_ID = "48931740";

interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface UserStats {
  totalUsers: number;
  premiumUsers: number;
  trialUsers: number;
  freeUsers: number;
  totalScansToday: number;
  totalScansThisWeek: number;
  totalScansThisMonth: number;
}

interface UserRecord {
  id: number;
  replitId: string;
  email: string;
  name: string;
  subscriptionStatus: string | null;
  scanPackBalance: number;
  monthlyFreeScansUsed: number;
  createdAt: string;
  scansToday: number;
  scansThisWeek: number;
  scansThisMonth: number;
  totalScans: number;
}

interface AdminData {
  stats: UserStats;
  recentUsers: UserRecord[];
}

interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: string;
}

interface DailyStats {
  date: string;
  scans: number;
  logins: number;
}

interface DailyUsageData {
  dailyStats: DailyStats[];
}

interface SubscriptionFunnelData {
  statusCounts: {
    free: number;
    trial: number;
    active: number;
    cancelled: number;
    past_due: number;
  };
  trialBreakdown: {
    active: number;
    expired: number;
  };
  conversionRates: {
    toTrial: string;
    toPaid: string;
  };
  totalUsers: number;
}

interface CacheEntry {
  key: string;
  ingredient: string;
  category: string;
  language: string;
  analysis: string;
  createdAt: number;
  lastUpdated: number;
}

interface IngredientCacheData {
  totalEntries: number;
  entries: CacheEntry[];
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantScans, setGrantScans] = useState("10");

  const typedUser = user as AuthUser | null;
  const isAdmin = typedUser?.id === ADMIN_USER_ID;

  const { data: adminData, isLoading, error, refetch } = useQuery<AdminData>({
    queryKey: ['/api/admin/dashboard'],
    enabled: isAdmin,
  });

  const { data: cacheStats, refetch: refetchCache } = useQuery<CacheStats>({
    queryKey: ['/api/cache-stats'],
    enabled: isAdmin,
  });

  const { data: dailyUsage } = useQuery<DailyUsageData>({
    queryKey: ['/api/admin/daily-usage'],
    enabled: isAdmin,
  });

  const { data: subscriptionFunnel } = useQuery<SubscriptionFunnelData>({
    queryKey: ['/api/admin/subscription-funnel'],
    enabled: isAdmin,
  });

  const { data: ingredientCache, refetch: refetchIngredientCache } = useQuery<IngredientCacheData>({
    queryKey: ['/api/admin/ingredient-cache'],
    enabled: isAdmin,
  });

  const [cacheSearchQuery, setCacheSearchQuery] = useState("");

  const grantSubscriptionMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', '/api/admin/grant-subscription', { userId });
    },
    onSuccess: () => {
      toast({ title: "Subscription granted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      setGrantUserId("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to grant subscription", description: error.message, variant: "destructive" });
    }
  });

  const revokeSubscriptionMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', '/api/admin/revoke-subscription', { userId });
    },
    onSuccess: () => {
      toast({ title: "Subscription revoked" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to revoke subscription", description: error.message, variant: "destructive" });
    }
  });

  const grantScansMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      return apiRequest('POST', '/api/admin/grant-scans', { userId, amount });
    },
    onSuccess: () => {
      toast({ title: `${grantScans} scans granted successfully` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      setGrantUserId("");
      setGrantScans("10");
    },
    onError: (error: any) => {
      toast({ title: "Failed to grant scans", description: error.message, variant: "destructive" });
    }
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/admin/clear-cache', {});
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Cache cleared", 
        description: `${data.clearedCount} ingredient analyses removed` 
      });
      refetchCache();
    },
    onError: (error: any) => {
      toast({ title: "Failed to clear cache", description: error.message, variant: "destructive" });
    }
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-display mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-4">You do not have permission to access this page.</p>
        <Link href="/">
          <Button variant="outline">Return Home</Button>
        </Link>
      </div>
    );
  }

  const filteredUsers = adminData?.recentUsers?.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.replitId?.includes(searchQuery)
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                <span className="font-light">Back</span>
              </Button>
            </Link>
            <Badge variant="secondary" className="bg-primary/10 text-primary gap-1">
              <Crown className="w-3 h-3" />
              Admin
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl mb-8">Admin Dashboard</h1>

        {error && (
          <Card className="p-4 mb-6 border-destructive/50 bg-destructive/5">
            <p className="text-destructive">Error loading admin data: {(error as Error).message}</p>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Users</p>
                <p className="text-xl font-semibold" data-testid="stat-total-users">
                  {adminData?.stats?.totalUsers ?? '-'}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Premium</p>
                <p className="text-xl font-semibold" data-testid="stat-premium-users">
                  {adminData?.stats?.premiumUsers ?? '-'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trial</p>
                <p className="text-xl font-semibold" data-testid="stat-trial-users">
                  {adminData?.stats?.trialUsers ?? '-'}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scans Today</p>
                <p className="text-xl font-semibold" data-testid="stat-scans-today">
                  {adminData?.stats?.totalScansToday ?? '-'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">This Week</p>
                <p className="text-xl font-semibold" data-testid="stat-scans-week">
                  {adminData?.stats?.totalScansThisWeek ?? '-'}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className="text-xl font-semibold" data-testid="stat-scans-month">
                  {adminData?.stats?.totalScansThisMonth ?? '-'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
            <TabsTrigger value="funnel" data-testid="tab-funnel">Funnel</TabsTrigger>
            <TabsTrigger value="cache" data-testid="tab-cache">Ingredients</TabsTrigger>
            <TabsTrigger value="grants" data-testid="tab-grants">Grant Access</TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Management
                </CardTitle>
                <CardDescription>View and manage user subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email, name, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-users"
                  />
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredUsers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No users found</p>
                    ) : (
                      filteredUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50" data-testid={`user-row-${u.replitId}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{u.name || u.email || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">ID: {u.replitId}</Badge>
                              {u.subscriptionStatus === 'active' && (
                                <Badge className="bg-primary/10 text-primary text-xs gap-1">
                                  <Crown className="w-2.5 h-2.5" />
                                  Premium
                                </Badge>
                              )}
                              {u.subscriptionStatus === 'trial' && (
                                <Badge className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs gap-1">
                                  <Calendar className="w-2.5 h-2.5" />
                                  Trial
                                </Badge>
                              )}
                              {u.scanPackBalance > 0 && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Zap className="w-2.5 h-2.5" />
                                  {u.scanPackBalance} packs
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>Today: <strong className="text-foreground">{u.scansToday}</strong></span>
                              <span>Week: <strong className="text-foreground">{u.scansThisWeek}</strong></span>
                              <span>Month: <strong className="text-foreground">{u.scansThisMonth}</strong></span>
                              <span>Total: <strong className="text-foreground">{u.totalScans}</strong></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {u.subscriptionStatus === 'active' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => revokeSubscriptionMutation.mutate(u.replitId)}
                                disabled={revokeSubscriptionMutation.isPending}
                                data-testid={`button-revoke-${u.replitId}`}
                              >
                                <Ban className="w-3 h-3 mr-1" />
                                Revoke
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => grantSubscriptionMutation.mutate(u.replitId)}
                                disabled={grantSubscriptionMutation.isPending}
                                data-testid={`button-grant-sub-${u.replitId}`}
                              >
                                <Crown className="w-3 h-3 mr-1" />
                                Grant Premium
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Daily Usage (Last 30 Days)
                </CardTitle>
                <CardDescription>Track logins and scans over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyUsage?.dailyStats && dailyUsage.dailyStats.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyUsage.dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                          }}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="scans" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={false}
                          name="Scans"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="logins" 
                          stroke="hsl(142 76% 36%)" 
                          strokeWidth={2}
                          dot={false}
                          name="Logins"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex justify-center py-8 text-muted-foreground">
                    No usage data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funnel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Subscription Funnel
                </CardTitle>
                <CardDescription>User distribution and conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptionFunnel ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-2xl font-bold text-foreground">{subscriptionFunnel.statusCounts.free}</p>
                        <p className="text-sm text-muted-foreground">Free</p>
                      </div>
                      <div className="p-4 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-center">
                        <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{subscriptionFunnel.statusCounts.trial}</p>
                        <p className="text-sm text-muted-foreground">Trial</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ({subscriptionFunnel.trialBreakdown.active} active, {subscriptionFunnel.trialBreakdown.expired} expired)
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-center">
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{subscriptionFunnel.statusCounts.active}</p>
                        <p className="text-sm text-muted-foreground">Premium</p>
                      </div>
                      <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-center">
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">{subscriptionFunnel.statusCounts.cancelled}</p>
                        <p className="text-sm text-muted-foreground">Cancelled</p>
                      </div>
                      <div className="p-4 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-center">
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{subscriptionFunnel.statusCounts.past_due}</p>
                        <p className="text-sm text-muted-foreground">Past Due</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-1">Trial Conversion Rate</p>
                        <p className="text-3xl font-bold text-foreground">{subscriptionFunnel.conversionRates.toTrial}</p>
                        <p className="text-xs text-muted-foreground mt-1">Users who started trial or subscribed</p>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-1">Paid Conversion Rate</p>
                        <p className="text-3xl font-bold text-foreground">{subscriptionFunnel.conversionRates.toPaid}</p>
                        <p className="text-xs text-muted-foreground mt-1">Of all users who converted to paid</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cache" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="w-5 h-5" />
                  Ingredient Cache
                </CardTitle>
                <CardDescription>
                  View cached ingredient analyses ({ingredientCache?.totalEntries ?? 0} entries)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ingredients..."
                    value={cacheSearchQuery}
                    onChange={(e) => setCacheSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-cache"
                  />
                </div>
                
                {ingredientCache?.entries ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-4">
                      {ingredientCache.entries
                        .filter(entry => 
                          entry.ingredient.toLowerCase().includes(cacheSearchQuery.toLowerCase()) ||
                          entry.category.toLowerCase().includes(cacheSearchQuery.toLowerCase())
                        )
                        .slice(0, 100)
                        .map((entry, index) => (
                          <div 
                            key={entry.key} 
                            className="p-3 rounded-lg border bg-card/50"
                            data-testid={`cache-entry-${index}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium capitalize">{entry.ingredient}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs capitalize">{entry.category}</Badge>
                                  <Badge variant="secondary" className="text-xs uppercase">{entry.language}</Badge>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(entry.lastUpdated).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {entry.analysis.substring(0, 200)}...
                            </p>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Grant Access
                </CardTitle>
                <CardDescription>Grant subscription or scan packs to users by Replit ID</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="grant-user-id">Replit User ID</Label>
                    <Input
                      id="grant-user-id"
                      placeholder="Enter Replit user ID..."
                      value={grantUserId}
                      onChange={(e) => setGrantUserId(e.target.value)}
                      data-testid="input-grant-user-id"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Button
                        className="w-full gap-2"
                        onClick={() => grantSubscriptionMutation.mutate(grantUserId)}
                        disabled={!grantUserId || grantSubscriptionMutation.isPending}
                        data-testid="button-grant-subscription"
                      >
                        {grantSubscriptionMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Crown className="w-4 h-4" />
                        )}
                        Grant Premium Subscription
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <Label htmlFor="grant-scans">Scan Pack Amount</Label>
                        <Input
                          id="grant-scans"
                          type="number"
                          min="1"
                          value={grantScans}
                          onChange={(e) => setGrantScans(e.target.value)}
                          data-testid="input-grant-scans"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => grantScansMutation.mutate({ userId: grantUserId, amount: parseInt(grantScans) })}
                        disabled={!grantUserId || !grantScans || grantScansMutation.isPending}
                        data-testid="button-grant-scans"
                      >
                        {grantScansMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        Grant Scans
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Ingredient Cache
                </CardTitle>
                <CardDescription>
                  Manage the ingredient analysis cache. Clear when AI prompts are updated.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Cached Entries</p>
                    <p className="text-2xl font-semibold" data-testid="stat-cache-entries">
                      {cacheStats?.totalEntries ?? '-'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Cache Hits</p>
                    <p className="text-2xl font-semibold" data-testid="stat-cache-hits">
                      {cacheStats?.hitCount ?? '-'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Cache Misses</p>
                    <p className="text-2xl font-semibold" data-testid="stat-cache-misses">
                      {cacheStats?.missCount ?? '-'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Hit Rate</p>
                    <p className="text-2xl font-semibold" data-testid="stat-cache-hit-rate">
                      {cacheStats?.hitRate ?? '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-destructive/5 border-destructive/20">
                  <div>
                    <p className="font-medium">Clear All Cache</p>
                    <p className="text-sm text-muted-foreground">
                      Remove all cached ingredient analyses. Use after updating AI prompts.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => clearCacheMutation.mutate()}
                    disabled={clearCacheMutation.isPending}
                    data-testid="button-clear-cache"
                  >
                    {clearCacheMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Clear Cache
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
