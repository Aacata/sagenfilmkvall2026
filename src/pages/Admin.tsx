import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, LogOut, Loader2 } from "lucide-react";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminAccessDenied from "@/components/admin/AdminAccessDenied";
import ScannerTab from "@/components/admin/ScannerTab";
import BookingsTab from "@/components/admin/BookingsTab";
import AdminDelegateTab from "@/components/admin/AdminDelegateTab";
import ChangePasswordTab from "@/components/admin/ChangePasswordTab";

const Admin = () => {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [stats, setStats] = useState({ available: 0, booked: 0, checkedIn: 0 });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || "" });
        const { data } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
        setIsAdmin(!!data);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || "" });
        const { data } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
        setIsAdmin(!!data);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchStats = useCallback(async () => {
    const { data } = await supabase.from("seats").select("is_booked, checked_in");
    if (!data) return;
    setStats({
      available: data.filter((s) => !s.is_booked).length,
      booked: data.filter((s) => s.is_booked).length,
      checkedIn: data.filter((s) => s.checked_in).length,
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();

    const channel = supabase
      .channel("admin-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, fetchStats]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AdminLogin onLoading={setAuthLoading} />;
  if (!isAdmin) return <AdminAccessDenied email={user.email} onLogout={handleLogout} />;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Admin
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{stats.available}</p><p className="text-xs text-muted-foreground">Lediga</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{stats.booked}</p><p className="text-xs text-muted-foreground">Bokade</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-[hsl(var(--success))]">{stats.checkedIn}</p><p className="text-xs text-muted-foreground">Incheckade</p></CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="scanner" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="scanner" className="flex-1">Insläpp</TabsTrigger>
            <TabsTrigger value="bookings" className="flex-1">Bokningar</TabsTrigger>
            <TabsTrigger value="admins" className="flex-1">Admins</TabsTrigger>
            <TabsTrigger value="password" className="flex-1">Lösenord</TabsTrigger>
          </TabsList>

          <TabsContent value="scanner">
            <ScannerTab onCheckedIn={fetchStats} />
          </TabsContent>

          <TabsContent value="bookings">
            <BookingsTab />
          </TabsContent>

          <TabsContent value="admins">
            <AdminDelegateTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
