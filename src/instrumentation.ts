export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { matchOpenOrders } = await import('./lib/trading');
    // Periodically match open limit orders against live market prices
    setInterval(() => {
      matchOpenOrders().catch(() => {});
    }, 7000);
  }
}
