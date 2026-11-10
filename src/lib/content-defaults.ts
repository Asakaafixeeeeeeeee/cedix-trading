// Client-safe content registry (no server imports). The single source of truth
// for editable keys, their categories, labels and built-in default text.

export type ContentCategory =
  | 'Home'
  | 'Trading'
  | 'Deposit'
  | 'Withdraw'
  | 'P2P'
  | 'Automated messages'
  | 'Authentication'
  | 'Messages'
  | 'General';

export type ContentDef = { category: ContentCategory; label: string; default: string; multiline?: boolean };

export const CONTENT = {
  // ── Home ──
  'home.guest.title': { category: 'Home', label: 'Guest hero title', default: 'A New Alternative' },
  'home.guest.subtitle': { category: 'Home', label: 'Guest hero subtitle', default: 'Trade crypto with Ghana Cedis. Buy, sell and grow — all in one place.', multiline: true },
  'home.guest.cta.register': { category: 'Home', label: 'Guest “Sign up” button', default: 'Sign up' },
  'home.guest.cta.login': { category: 'Home', label: 'Guest “Log in” button', default: 'Log in' },
  'home.portfolio.label': { category: 'Home', label: 'Portfolio value label', default: 'Total Value' },
  'home.search': { category: 'Home', label: 'Search placeholder', default: 'Search coins and pairs' },
  'home.estTotal': { category: 'Home', label: 'Estimated total value label', default: 'Est total value' },
  'home.todayPnl': { category: 'Home', label: "Today's PnL label", default: "Today's PnL" },
  'home.deposit': { category: 'Home', label: 'Deposit button', default: 'Deposit crypto' },
  'home.p2p': { category: 'Home', label: 'P2P button', default: 'P2P trading' },
  'home.hero.title': { category: 'Home', label: 'Logged-out hero title', default: 'Trade Crypto with Confidence' },
  'home.hero.subtitle': { category: 'Home', label: 'Logged-out hero subtitle', default: 'Live markets, powerful tools and secure asset management in one platform.', multiline: true },
  'home.tab.favorites': { category: 'Home', label: 'Tab: Favorites', default: 'Favorites' },
  'home.tab.crypto': { category: 'Home', label: 'Tab: Crypto', default: 'Crypto' },
  'home.tab.new': { category: 'Home', label: 'Tab: New', default: 'New' },
  'home.tab.stock': { category: 'Home', label: 'Tab: Stocks', default: 'Stocks' },
  'home.tab.etf': { category: 'Home', label: 'Tab: ETFs', default: 'ETFs' },
  'home.menu.settings': { category: 'Home', label: 'Menu: Settings', default: 'Settings' },
  'home.menu.history': { category: 'Home', label: 'Menu: Transaction history', default: 'Transaction history' },
  'home.menu.login': { category: 'Home', label: 'Menu: Log in / Sign up', default: 'Log in / Sign up' },

  // ── Trading ──
  'trade.buy.label': { category: 'Trading', label: 'BUY button', default: 'Buy' },
  'trade.sell.label': { category: 'Trading', label: 'SELL button', default: 'Sell' },
  'trade.positions.empty': { category: 'Trading', label: 'No positions message', default: 'No open positions', multiline: true },
  'trade.positions.emptySub': { category: 'Trading', label: 'No positions subtext', default: 'Buy an asset to open a position and track its live profit/loss.', multiline: true },
  'trade.orders.empty': { category: 'Trading', label: 'No orders message', default: 'No open orders' },

  // ── Deposit ──
  'deposit.title': { category: 'Deposit', label: 'Deposit page title', default: 'Deposit' },
  'deposit.instructions': { category: 'Deposit', label: 'Deposit instructions', default: 'Pay with MoMo, card or bank via Payteller — receive crypto instantly.', multiline: true },
  'deposit.minPrefix': { category: 'Deposit', label: 'Minimum deposit prefix', default: 'Minimum deposit:' },
  'deposit.amountLabel': { category: 'Deposit', label: 'Amount field label', default: 'Deposit amount (USD)' },
  'deposit.method.momo': { category: 'Deposit', label: 'Method: Mobile Money', default: 'MobileMoney' },
  'deposit.method.card': { category: 'Deposit', label: 'Method: Card', default: 'Card' },
  'deposit.method.bank': { category: 'Deposit', label: 'Method: Bank', default: 'Bank' },
  'deposit.supportedNetworks': { category: 'Deposit', label: 'Supported networks label', default: 'Supported networks:' },
  'deposit.phonePlaceholder': { category: 'Deposit', label: 'MoMo number placeholder', default: 'MoMo number — 024 123 4567' },
  'deposit.row.amount': { category: 'Deposit', label: 'Summary: Deposit amount', default: 'Deposit amount' },
  'deposit.row.rate': { category: 'Deposit', label: 'Summary: Exchange rate', default: 'Exchange rate' },
  'deposit.row.payable': { category: 'Deposit', label: 'Summary: Amount payable', default: 'Amount payable' },
  'deposit.row.receive': { category: 'Deposit', label: 'Summary: You receive', default: 'You receive' },
  'deposit.payButton': { category: 'Deposit', label: 'Pay button text', default: 'Pay with Payteller' },
  'deposit.connecting': { category: 'Deposit', label: 'Pay button (connecting)', default: 'Connecting…' },
  'deposit.login': { category: 'Deposit', label: 'Logged-out prompt', default: 'Log in to deposit.' },
  'deposit.loginButton': { category: 'Deposit', label: 'Logged-out button', default: 'Log in' },

  // ── Withdraw ──
  'withdraw.title': { category: 'Withdraw', label: 'Withdraw page title', default: 'Withdraw to GH₵' },
  'withdraw.history': { category: 'Withdraw', label: 'History link', default: 'History' },
  'withdraw.instructions': { category: 'Withdraw', label: 'Withdraw instructions', default: 'Cash out any crypto straight to MoMo or bank — requests are reviewed before payment.', multiline: true },
  'withdraw.minPrefix': { category: 'Withdraw', label: 'Minimum withdrawal prefix', default: 'Minimum withdrawal:' },
  'withdraw.availableBalance': { category: 'Withdraw', label: 'Available balance label', default: 'Available balance' },
  'withdraw.max': { category: 'Withdraw', label: 'Max button prefix', default: 'Max' },
  'withdraw.method.momo': { category: 'Withdraw', label: 'Method: Mobile Money', default: 'MobileMoney' },
  'withdraw.method.bank': { category: 'Withdraw', label: 'Method: Bank', default: 'Bank' },
  'withdraw.dest.momo': { category: 'Withdraw', label: 'MoMo number placeholder', default: 'MoMo number' },
  'withdraw.dest.bank': { category: 'Withdraw', label: 'Bank account placeholder', default: 'Bank account number' },
  'withdraw.recipientName': { category: 'Withdraw', label: 'Recipient name placeholder', default: 'Recipient name (as registered)' },
  'withdraw.row.estGHS': { category: 'Withdraw', label: 'Summary: Estimated GHS amount', default: 'Estimated GHS amount' },
  'withdraw.row.rate': { category: 'Withdraw', label: 'Summary: Exchange rate', default: 'Exchange rate' },
  'withdraw.row.fee': { category: 'Withdraw', label: 'Summary: Fee label', default: 'Fee' },
  'withdraw.row.final': { category: 'Withdraw', label: 'Summary: Final amount to receive', default: 'Final amount to receive' },
  'withdraw.confirm': { category: 'Withdraw', label: 'Confirm button', default: 'Confirm withdrawal request' },
  'withdraw.reviewNote': { category: 'Withdraw', label: 'Review note', default: 'Requests are reviewed by our team. You will be notified when a decision is made.', multiline: true },
  'withdraw.login': { category: 'Withdraw', label: 'Logged-out prompt', default: 'Log in to withdraw.' },
  'withdraw.loginButton': { category: 'Withdraw', label: 'Logged-out button', default: 'Log in' },
  'withdraw.submitted': { category: 'Withdraw', label: 'Withdrawal submitted message', default: 'Your withdrawal request for {amount} has been received. Our team will review your account and notify you when a decision has been made.', multiline: true },
  'withdraw.processing.title': { category: 'Withdraw', label: 'Processing screen title', default: 'Processing Your Withdrawal Request' },
  'withdraw.processing.sub': { category: 'Withdraw', label: 'Processing screen subtitle', default: 'Please wait…' },
  'withdraw.submitted.title': { category: 'Withdraw', label: 'Submitted screen title', default: 'Withdrawal Request Submitted' },
  'withdraw.submitted.status': { category: 'Withdraw', label: 'Submitted status pill', default: 'Status: Pending Review' },
  'withdraw.submitted.viewStatus': { category: 'Withdraw', label: 'View status button', default: 'View Withdrawal Status' },
  'withdraw.submitted.new': { category: 'Withdraw', label: 'New withdrawal button', default: 'New withdrawal' },

  // ── P2P ──
  'p2p.market.emptyBuy': { category: 'P2P', label: 'No buy ads message', default: 'No sell ads match your filters yet.', multiline: true },
  'p2p.express.note': { category: 'P2P', label: 'Express footer note', default: 'Express matches you with the best-priced live ad. Payment goes through the official CediX checkout and your crypto is released after the provider confirms payment.', multiline: true },

  // ── Automated messages (P2P assistant) ──
  'bot.p2p.welcome': { category: 'Automated messages', label: 'Assistant welcome', default: 'Welcome to CediX P2P. Your order is ready. For your security, payments are accepted only through the official payment checkout provided in this conversation.', multiline: true },
  'bot.p2p.chooseNetwork': { category: 'Automated messages', label: 'Assistant network prompt', default: 'Which network would you like to use?' },

  // ── Authentication ──
  'auth.login.title': { category: 'Authentication', label: 'Login page title', default: 'Welcome back' },
  'auth.register.title': { category: 'Authentication', label: 'Register page title', default: 'Create your account' },

  // ── Messages ──
  'messages.welcome.title': { category: 'Messages', label: 'Messages welcome title', default: 'Messages' },

  // ── General ──
  'general.error.generic': { category: 'General', label: 'Generic error message', default: 'Something went wrong. Please try again.', multiline: true },
  'general.success.saved': { category: 'General', label: 'Generic success message', default: 'Saved successfully.' },
} satisfies Record<string, ContentDef>;

export type ContentKey = keyof typeof CONTENT;
