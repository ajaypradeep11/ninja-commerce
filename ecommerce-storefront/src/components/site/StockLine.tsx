export function StockLine({ stockQty }: { stockQty: number }) {
  if (stockQty === 0) {
    return <p className="text-madder">Out of stock</p>;
  }
  if (stockQty <= 5) {
    return <p className="font-mono text-madder">Only {stockQty} left</p>;
  }
  return <p className="text-ink/60">In stock</p>;
}
