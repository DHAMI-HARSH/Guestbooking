export type RoomConfiguration = "Double Bed" | "Triple Bed" | "Twin Sharing";

export interface RoomMasterItem {
  roomNumber: string;
  floor: string;
  configuration: RoomConfiguration;
  rate: number;
}

export const ROOM_MASTER: RoomMasterItem[] = [
  { roomNumber: "101", floor: "Ground Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "102", floor: "Ground Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "103", floor: "Ground Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "104", floor: "Ground Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "105", floor: "Ground Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "106", floor: "Ground Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "107", floor: "Ground Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "108", floor: "Ground Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "109", floor: "Ground Floor", configuration: "Triple Bed", rate: 3000 },
  { roomNumber: "110", floor: "Ground Floor", configuration: "Triple Bed", rate: 3000 },
  { roomNumber: "111", floor: "Ground Floor", configuration: "Triple Bed", rate: 3000 },
  { roomNumber: "201", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "202", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "203", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "204", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "205", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "206", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "207", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "208", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "209", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "210", floor: "1st Floor", configuration: "Double Bed", rate: 2000 },
  { roomNumber: "214", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "215", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "216", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "217", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "218", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "219", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "220", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "221", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "222", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
  { roomNumber: "223", floor: "1st Floor", configuration: "Twin Sharing", rate: 2000 },
];
