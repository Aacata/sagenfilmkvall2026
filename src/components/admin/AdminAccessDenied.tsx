import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, LogOut } from "lucide-react";

interface AdminAccessDeniedProps {
  email: string;
  onLogout: () => void;
}

const AdminAccessDenied = ({ email, onLogout }: AdminAccessDeniedProps) => (
  <div className="min-h-screen bg-background flex items-center justify-center px-4">
    <Card className="w-full max-w-sm text-center">
      <CardContent className="pt-6 flex flex-col items-center gap-4">
        <XCircle className="w-12 h-12 text-destructive" />
        <p className="font-medium">Åtkomst nekad</p>
        <p className="text-sm text-muted-foreground">
          {email} har inte admin-behörighet.
        </p>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Logga ut
        </Button>
      </CardContent>
    </Card>
  </div>
);

export default AdminAccessDenied;
