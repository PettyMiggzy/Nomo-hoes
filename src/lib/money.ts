// Credits are dollars (1 credit = 1 USDG): $1.50, $0.25, $0.075. Safe to
// import from client components (no env reads).
export const usd = (n: number) => {
  const subCent = n > 0 && n < 1 && Math.abs(n * 100 - Math.round(n * 100)) > 1e-9;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: subCent ? 3 : 2, maximumFractionDigits: subCent ? 3 : 2 })}`;
};
