import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserPlus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  user_id: string;
  email?: string;
}

const AdminDelegateTab = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchAdmins = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("id, user_id")
      .eq("role", "admin");
    setAdmins(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);

    const { data, error } = await supabase.functions.invoke("manage-admin", {
      body: { action: "add", email: newEmail.trim() },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Kunde inte lägga till admin");
    } else {
      const msg = data?.created
        ? `Konto skapat för ${newEmail} med lösenord Admin1234! och admin-rättigheter tilldelade.`
        : `${newEmail} har fått admin-rättigheter.`;
      toast.success(msg);
      setNewEmail("");
      fetchAdmins();
    }
    setAdding(false);
  };

  const handleRemoveAdmin = async (admin: AdminUser) => {
    setRemoving(admin.id);
    const { data, error } = await supabase.functions.invoke("manage-admin", {
      body: { action: "remove", roleId: admin.id },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Kunde inte ta bort admin");
    } else {
      toast.success("Admin borttagen");
      fetchAdmins();
    }
    setRemoving(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5" />
          Administratörer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAddAdmin} className="flex gap-2">
          <Input
            type="email"
            placeholder="E-postadress för ny admin"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={adding} className="shrink-0">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span className="ml-1 hidden sm:inline">Lägg till</span>
          </Button>
        </form>

        <div className="space-y-2">
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
            >
              <p className="text-sm font-mono">{admin.user_id.slice(0, 8)}…</p>
              <Button
                variant="destructive"
                size="sm"
                disabled={removing === admin.id}
                onClick={() => handleRemoveAdmin(admin)}
              >
                {removing === admin.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Ange e-postadressen för den nya adminen. Om inget konto finns skapas ett automatiskt med lösenordet <strong>Admin1234!</strong>
        </p>
      </CardContent>
    </Card>
  );
};

export default AdminDelegateTab;
