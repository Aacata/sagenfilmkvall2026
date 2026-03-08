import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Ticket } from "lucide-react";

const Booking = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Ticket className="w-6 h-6 text-primary" />
            Din biljett
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={id || ""} size={200} />
          </div>
          <p className="text-muted-foreground text-sm">
            Visa denna QR-kod vid ingången
          </p>
          <p className="text-xs text-muted-foreground break-all font-mono">
            Boknings-ID: {id}
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tillbaka
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Booking;
