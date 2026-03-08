export type SeatType = "standard" | "wheelchair" | "vip" | "couple" | "empty";

export interface Seat {
  id: string;
  row: number;
  seatNumber: number;
  type: SeatType;
  isBooked: boolean;
  bookedByEmail: string | null;
  bookingId: string | null;
  checkedIn: boolean;
}

export interface RowConfig {
  row: number;
  seats: { type: SeatType; count: number }[];
  offset: number; // left offset in seat-units for centering
}

export const rowConfigs: RowConfig[] = [
  { row: 1, seats: [{ type: "wheelchair", count: 1 }, { type: "empty", count: 2 }, { type: "vip", count: 7 }], offset: 1 },
  { row: 2, seats: [{ type: "standard", count: 12 }], offset: 0 },
  { row: 3, seats: [{ type: "standard", count: 13 }], offset: 0 },
  { row: 4, seats: [{ type: "standard", count: 12 }], offset: 1 },
  { row: 5, seats: [{ type: "standard", count: 12 }], offset: 1 },
  { row: 6, seats: [{ type: "standard", count: 13 }], offset: 0 },
  { row: 7, seats: [{ type: "standard", count: 13 }], offset: 0 },
  { row: 8, seats: [{ type: "standard", count: 12 }], offset: 0 },
  { row: 9, seats: [{ type: "standard", count: 11 }], offset: 1 },
];

export const coupleSeats: { id: string; side: "left" | "right"; seatNumber: number }[] = [
  { id: "couple-L1", side: "left", seatNumber: 1 },
  { id: "couple-L2", side: "left", seatNumber: 2 },
  { id: "couple-R1", side: "right", seatNumber: 1 },
  { id: "couple-R2", side: "right", seatNumber: 2 },
];

function generateSeats(): Seat[] {
  const seats: Seat[] = [];
  for (const rc of rowConfigs) {
    let seatNum = 1;
    for (const group of rc.seats) {
      for (let i = 0; i < group.count; i++) {
        if (group.type === "empty") {
          seatNum++;
          continue;
        }
        seats.push({
          id: `R${rc.row}-S${seatNum}`,
          row: rc.row,
          seatNumber: seatNum,
          type: group.type,
          isBooked: false,
          bookedByEmail: null,
          bookingId: null,
          checkedIn: false,
        });
        seatNum++;
      }
    }
  }
  // couple seats
  for (const cs of coupleSeats) {
    seats.push({
      id: cs.id,
      row: 10,
      seatNumber: cs.seatNumber,
      type: "couple",
      isBooked: false,
      bookedByEmail: null,
      bookingId: null,
      checkedIn: false,
    });
  }
  return seats;
}

export const initialSeats: Seat[] = generateSeats();
