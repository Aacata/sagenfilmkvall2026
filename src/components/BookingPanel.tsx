import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Seat } from "@/data/seatLayout";
import { Ticket } from "lucide-react";

interface BookingPanelProps {
  selectedSeats: Seat[];
  onBook: (email: string) => void;
  onClear: () => void;
}

const BookingPanel = ({ selectedSeats, onBook, onClear }: BookingPanelProps) => {
  const [email, setEmail] = useState("");

  if (selectedSeats.length === 0) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onBook(email.trim());
    setEmail("");
  };

  return (
    <Card className="w-full max-w-xl mx-auto mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ticket className="w-5 h-5 text-primary" />
          Boka {selectedSeats.length} plats{selectedSeats.length > 1 ? "er" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedSeats.map((s) => (
            <span
              key={s.id}
              className="px-2 py-1 rounded bg-[hsl(var(--seat-selected))]/20 text-[hsl(var(--seat-selected))] text-xs font-medium"
            >
              Rad {s.row}, Plats {s.seatNumber}
              {s.type === "vip" && " ★"}
            </span>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            placeholder="Din e-postadress"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit">Boka</Button>
          <Button type="button" variant="outline" onClick={onClear}>
            Rensa
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BookingPanel;
