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
  Loader2, AlertTriangle, RefreshCw, Trash2, Database,
  BarChart3, FlaskConical, Beaker, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
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
  totalPurchasedScansBalance: number;
  totalScansToday: number;
  totalScansThisWeek: number;
  totalScansThisMonth: number;
}

interface UserRecord {
  id: number;
  replitId: string;
  email: string;
  name: string;
  dailyFreeScansUsed: number;
  purchasedScanBalance: number;
  createdAt: string;
  scansToday: number;
  scansThisWeek: number;
  scansThisMonth: number;
  totalScans: number;
  isTestUser?: boolean;
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
  const [showTestUsers, setShowTestUsers] = useState(false);
  const [sortField, setSortField] = useState<keyof UserRecord>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const typedUser = user as AuthUser | null;
  const isAdmin = typedUser?.id === ADMIN_USER_ID;

  const { data: adminData, isLoading, error, refetch } = useQuery<AdminData>({
    queryKey: ['/api/admin/dashboard', { showTestUsers }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/dashboard?showTestUsers=${showTestUsers}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      return res.json();
    },
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

  const { data: ingredientCache, refetch: refetchIngredientCache } = useQuery<IngredientCacheData>({
    queryKey: ['/api/admin/ingredient-cache'],
    enabled: isAdmin,
  });

  const [cacheSearchQuery, setCacheSearchQuery] = useState("");

  const grantScansMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      return apiRequest('POST', '/api/admin/grant-scans', { userId, amount });
    },
    onSuccess: (_, variables) => {
      toast({ title: `${variables.amount} scans granted to purchasedScanBalance` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
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

  const filteredUsers = (adminData?.recentUsers?.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.replitId?.includes(searchQuery)
  ) || []).sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (aVal === null || aVal === undefined) return sortDirection === "asc" ? -1 : 1;
    if (bVal === null || bVal === undefined) return sortDirection === "asc" ? 1 : -1;
    
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });

  const handleSort = (field: keyof UserRecord) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: keyof UserRecord }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="w-3 h-3 ml-1" /> 
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
                <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Purchased Scans Balance</p>
                <p className="text-xl font-semibold" data-testid="stat-purchased-scans">
                  {adminData?.stats?.totalPurchasedScansBalance ?? '-'}
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
            <TabsTrigger value="cache" data-testid="tab-cache">Ingredients</TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      User Management
                    </CardTitle>
                    <CardDescription>View and manage users</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-test-users" className="text-sm text-muted-foreground flex items-center gap-1.5">
                      {showTestUsers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      Test accounts
                    </Label>
                    <Switch
                      id="show-test-users"
                      checked={showTestUsers}
                      onCheckedChange={setShowTestUsers}
                      data-testid="toggle-test-users"
                    />
                  </div>
                </div>
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
                ) : filteredUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No users found</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                            onClick={() => handleSort("name")}
                            data-testid="sort-name"
                          >
                            <div className="flex items-center">
                              Name
                              <SortIcon field="name" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                            onClick={() => handleSort("email")}
                            data-testid="sort-email"
                          >
                            <div className="flex items-center">
                              Email
                              <SortIcon field="email" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap text-right"
                            onClick={() => handleSort("dailyFreeScansUsed")}
                            data-testid="sort-daily-scans"
                          >
                            <div className="flex items-center justify-end">
                              Daily Scans
                              <SortIcon field="dailyFreeScansUsed" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap text-right"
                            onClick={() => handleSort("purchasedScanBalance")}
                            data-testid="sort-purchased-balance"
                          >
                            <div className="flex items-center justify-end">
                              Purchased Balance
                              <SortIcon field="purchasedScanBalance" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap text-right"
                            onClick={() => handleSort("scansToday")}
                            data-testid="sort-today"
                          >
                            <div className="flex items-center justify-end">
                              Today
                              <SortIcon field="scansToday" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap text-right"
                            onClick={() => handleSort("scansThisWeek")}
                            data-testid="sort-week"
                          >
                            <div className="flex items-center justify-end">
                              Week
                              <SortIcon field="scansThisWeek" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap text-right"
                            onClick={() => handleSort("scansThisMonth")}
                            data-testid="sort-month"
                          >
                            <div className="flex items-center justify-end">
                              Month
                              <SortIcon field="scansThisMonth" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap text-right"
                            onClick={() => handleSort("totalScans")}
                            data-testid="sort-total"
                          >
                            <div className="flex items-center justify-end">
                              Total
                              <SortIcon field="totalScans" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                            onClick={() => handleSort("createdAt")}
                            data-testid="sort-signup"
                          >
                            <div className="flex items-center">
                              Signup
                              <SortIcon field="createdAt" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u) => (
                          <TableRow key={u.id} data-testid={`user-row-${u.replitId}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[150px]">{u.name || 'Unknown'}</span>
                                {u.isTestUser && (
                                  <Badge className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs shrink-0">
                                    <FlaskConical className="w-2.5 h-2.5" />
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <span className="truncate max-w-[180px] block">{u.email}</span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{u.dailyFreeScansUsed}/2</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {u.purchasedScanBalance > 0 ? (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Zap className="w-2.5 h-2.5" />
                                  {u.purchasedScanBalance}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/50">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{u.scansToday}</TableCell>
                            <TableCell className="text-right tabular-nums">{u.scansThisWeek}</TableCell>
                            <TableCell className="text-right tabular-nums">{u.scansThisMonth}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{u.totalScans}</TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => grantScansMutation.mutate({ userId: u.replitId, amount: 10 })}
                                  disabled={grantScansMutation.isPending}
                                  data-testid={`button-grant-scans-${u.replitId}`}
                                >
                                  {grantScansMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Zap className="w-3 h-3" />
                                  )}
                                  +10
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
