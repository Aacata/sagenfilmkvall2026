

# Lovelab Biograf-App – Implementeringsplan

## Layoutanalys från bilden

Bilden visar följande säteslayout:

```text
BIODUK (längst upp / framför rad 1)

Rad 1:  [♿] [·] [·] [V] [V] [V] [V] [V] [V] [V]   ← rullstol + 2 tomma + 7 VIP (rosa)
Rad 2:  [□ □ □ □ □ □ □ □ □ □ □ □]                    ← 12 standardplatser (grå)
Rad 3:  [□ □ □ □ □ □ □ □ □ □ □ □ □]                   ← 13 platser (bredare rad)
Rad 4:     [□ □ □ □ □ □ □ □ □ □ □ □]                  ← indragen rad
Rad 5:     [□ □ □ □ □ □ □ □ □ □ □ □]
Rad 6:  [□ □ □ □ □ □ □ □ □ □ □ □ □]
Rad 7:  [□ □ □ □ □ □ □ □ □ □ □ □ □]
Rad 8:  [□ □ □ □ □ □ □ □ □ □ □ □]
Rad 9:  [□ □ □ □ ✓ ✓ □ □ □ □ □]                      ← bakre rad

Nedre zon: [←→] [🛋🛋] [  INGÅNG  ] [🛋🛋]           ← parplatser + ingång
```

- **Rad 1**: Rullstolsplats (pos 1), 2 tomma ytor, 7 VIP-platser (rosa/magenta)
- **Rad 2-9**: Standardplatser (grå), antal varierar per rad, vissa rader indragna
- **Nedre zonen**: Parplatser (rosa dubbelstolar) på vardera sida om ingången
- **Färger**: Mörk bakgrund (#2d2d2d), grå lediga, rosa/magenta bokade/VIP, vit checkmark = vald

## Vad som byggs

### 1. Datamodell (mock, redo för Supabase)
- `seats[]` array med `id, row, seatNumber, type (standard|wheelchair|vip|couple), isBooked, bookedByEmail, bookingId, checkedIn`
- Layoutkonfiguration som speglar bildens oregelbundna rader (olika antal platser, indragning)

### 2. Säteskartan (`/`)
- Grid som matchar bildens layout exakt: varierande radlängder, indragning, rullstolsikon, VIP-sektion
- Mörkt tema (#2d2d2d bakgrund), grå lediga platser, magenta (#e91e8c) för bokade/VIP
- Klicka för att välja flera platser → bekräftelsepanel med e-postfält → boka
- Parplatser längst ned renderas som dubbel-breda knappar

### 3. Biljettvy (`/booking/:id`)
- QR-kod (via `qrcode.react`) med `bookingId`
- Visar rad, platsnummer, e-post

### 4. Admin (`/admin`)
- Enkel e-postlösenord (hårdkodad lista)
- QR-scanner med `html5-qrcode`
- Grön/röd validering vid skanning
- Platsöversikt: lediga/bokade/incheckade

### 5. Filer att skapa
- `src/data/seatLayout.ts` – layoutconfig + mock-data + typer
- `src/components/SeatGrid.tsx` – säteskartan
- `src/components/BookingPanel.tsx` – valda platser + e-post
- `src/components/SeatIcon.tsx` – enskild stol med ikon/färg
- `src/pages/Index.tsx` – uppdateras med SeatGrid
- `src/pages/Booking.tsx` – biljettvy med QR
- `src/pages/Admin.tsx` – login + scanner + översikt
- `src/components/QrScanner.tsx` – kamera-scanner wrapper

### 6. Beroenden att lägga till
- `qrcode.react` – QR-kodgenerering
- `html5-qrcode` – kamerascanning

