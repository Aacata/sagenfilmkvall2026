import { rowConfigs, type Seat } from "@/data/seatLayout";
import SeatIcon from "./SeatIcon";

interface SeatGridProps {
  seats: Seat[];
  selectedIds: string[];
  onToggleSeat: (id: string) => void;
}

const SeatGrid = ({ seats, selectedIds, onToggleSeat }: SeatGridProps) => {
  const maxCols = 14;

  return (
    <div className="flex flex-col items-center gap-1 w-full max-w-xl mx-auto">
      {/* Screen */}
      <div className="w-4/5 h-2 rounded-full bg-gradient-to-r from-transparent via-[hsl(var(--primary))]/60 to-transparent mb-4" />
      <p className="text-muted-foreground text-xs uppercase tracking-widest mb-4">Bioduk</p>

      {/* Seat rows */}
      {rowConfigs.map((rc) => {
        const rowSeats = seats.filter((s) => s.row === rc.row);
        let seatIdx = 0;
        return (
          <div key={rc.row} className="flex items-center justify-center gap-1 w-full">
            <span className="text-muted-foreground text-[10px] w-5 text-right mr-1">{rc.row}</span>
            {rc.seats.map((group, gi) =>
              Array.from({ length: group.count }).map((_, i) => {
                if (group.type === "empty") {
                  return <div key={`empty-${gi}-${i}`} className="w-8 h-8" />;
                }
                const seat = rowSeats[seatIdx++];
                if (!seat) return null;
                return (
                  <SeatIcon
                    key={seat.id}
                    seat={seat}
                    isSelected={selectedIds.includes(seat.id)}
                    onClick={() => onToggleSeat(seat.id)}
                  />
                );
              })
            )}
          </div>
        );
      })}


      {/* Legend */}
      <div className="flex gap-4 mt-6 text-xs text-muted-foreground flex-wrap justify-center">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[hsl(var(--seat-available))]" /> Ledig</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[hsl(var(--seat-selected))]" /> Vald</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[hsl(var(--seat-booked))]" /> Bokad</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[hsl(var(--seat-vip))]/50" /> VIP</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[hsl(var(--seat-wheelchair))]/40" /> Rullstol</span>
      </div>
    </div>
  );
};

export default SeatGrid;
