export const CHARGES = [
  "Aggravated Diamond Hands",
  "Simping in the First Degree",
  "Excessive Bag Holding",
  "Public Degeneracy",
  "Reckless Ape-ing Into a Rug",
  "Failure to Take Profits",
  "Criminal Amount of Rizz",
  "Disturbing the Charts",
  "Illegal Possession of a Bag",
  "Resisting Arrest of Development",
  "Obstruction of Gains",
  "Conspiracy to Pump and Dump",
  "Assault With a Deadly Meme",
  "Grand Theft of Your Attention",
  "Trespassing on Main Character Energy",
  "Indecent Exposure to Copium",
  "Loitering in a Discord VC",
  "Driving Under the Influence of Hopium",
  "Petty Theft of the Vibe",
  "Unlawful Flex Without a License",
] as const;

export function randomCharges(count = 2): string[] {
  const pool = [...CHARGES];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function randomCaseNumber(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
