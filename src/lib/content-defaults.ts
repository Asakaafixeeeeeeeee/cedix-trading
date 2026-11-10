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

  // ── Trading ──
  'trade.buy.label': { category: 'Trading', label: 'BUY button', default: 'Buy' },
  'trade.sell.label': { category: 'Trading', label: 'SELL button', default: 'Sell' },
  'trade.positions.empty': { category: 'Trading', label: 'No positions message', default: 'No open positions', multiline: true },
  'trade.positions.emptySub': { category: 'Trading', label: 'No positions subtext', default: 'Buy an asset to open a position and track its live profit/loss.', multiline: true },
  'trade.orders.empty': { category: 'Trading', label: 'No orders message', default: 'No open orders' },

  // ── Deposit ──
  'deposit.title': { category: 'Deposit', label: 'Deposit page title', default: 'Deposit' },
  'deposit.instructions': { category: 'Deposit', label: 'Deposit instructions', default: 'Pay with MoMo, card or bank via Payteller — receive crypto instantly.', multiline: true },

  // ── Withdraw ──
  'withdraw.title': { category: 'Withdraw', label: 'Withdraw page title', default: 'Withdraw to GH₵' },
  'withdraw.instructions': { category: 'Withdraw', label: 'Withdraw instructions', default: 'Cash out any crypto straight to MoMo or bank — requests are reviewed before payment.', multiline: true },
  'withdraw.submitted': { category: 'Withdraw', label: 'Withdrawal submitted message', default: 'Your withdrawal request has been received. Our team will review your account and notify you when a decision has been made.', multiline: true },

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
