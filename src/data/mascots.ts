export const MASCOTS = [
  "/mascot.jpg",
  "/mascots/mascot-2.jpg",
  "/mascots/mascot-3.jpg",
  "/mascots/mascot-4.jpg",
  "/mascots/mascot-5.jpg",
  "/mascots/mascot-6.jpg",
  "/mascots/mascot-7.jpg",
] as const;

export function randomMascot(exclude?: string): string {
  const pool = MASCOTS.filter((m) => m !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? MASCOTS[0];
}
