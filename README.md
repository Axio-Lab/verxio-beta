<div align="center">
  
  **Metaplex Core-powered yield-bearing prepaid loyalty cards that grow your cashflow**
  
  [![Verxio Protocol](https://img.shields.io/badge/Built%20with-Verxio%20Protocol-blue)](https://github.com/verxioprotocol)
  [![Solana](https://img.shields.io/badge/Blockchain-Solana-purple)](https://solana.com)
  [![Metaplex Core](https://img.shields.io/badge/Powered%20by-Metaplex%20Core-orange)](https://developers.metaplex.com/)
  <div align="center">  
    
  [![Visit Website](https://img.shields.io/badge/🌐_Visit_Website-37a779?style=for-the-badge)](https://www.verxio.xyz)
  </div>

</div>

---

## Demo

> Watch our demo video to see Verxio's yield bearing prepaid loyalty card and stablecoin checkout in action!

<!-- Add your demo video here when ready -->
[![Verxio's Demo Video](https://github.com/Axio-Lab/verxio-beta/blob/main/public/demo-video-thumbnail.png)](https://youtu.be/RpuL7h0vCZ8)

---

## The Problem

Traditional loyalty programs fail merchants and customers:
- **Merchants**: Points are liabilities on balance sheets, not assets
- **Customers**: Points locked in closed ecosystems, can't be transferred or used flexibly
- **Both**: No cashflow benefit, complex redemption, zero interoperability

## The Solution

Verxio transforms loyalty into **prepaid commerce** using Metaplex Core NFTs as autonomous wallets.

Every loyalty card and voucher is a functional blockchain asset that:
- Holds real tokens (USDC, SPL tokens)
- Earns yield on stablecoin balances (integrated with Reflect Money)
- Signs transactions autonomously
- Updates loyalty data on-chain in real-time
- Works across any Solana application

**The outcome?** Merchants get pre-revenue cashflow from prepaid balances. Customers earn yield while they hold value, spend flexibly, and own their assets.

---

## What is Verxio Protocol?

Open-source, permissionless onchain loyalty infrastructure built on Metaplex Core NFTs.

**Core Innovation**: Dynamic metadata programming + autonomous wallet technology = loyalty assets that function as commerce primitives, not just collectibles.

🔗 [Documentation](https://docs.verxio.xyz) • [GitHub](https://github.com/verxioprotocol)

---

## Features

### 1. Loyalty Programs

**Metaplex Core NFT passes** that combine membership, rewards tracking, and payment capabilities.

#### What merchants can do:
- Create multi-tier programs (bronze → platinum) with automatic progression
- Configure point rewards per purchase, referral, or custom action
- Award points that update on-chain instantly via external plugins
- Generate shareable claim links for customer acquisition
- Track member progress and tier benefits in real-time

#### What customers get:
- NFT loyalty pass = autonomous wallet holding SPL tokens
- Load USDC onto pass → pay at checkout while earning points
- **Earn yield on prepaid balance** (Reflect Money integration)
- Non-custodial ownership of both the NFT and loaded funds
- Tier-based discounts and perks that unlock automatically
- Transferable, composable loyalty asset

**The prepaid model**: Customer loads $50 USDC → merchant gets pre-revenue cashflow → customer earns yield on $50 balance + loyalty points on every spend.

---

### 2. Vouchers

**Token-backed NFT vouchers** with programmable redemption logic.

#### Voucher types:
- `PERCENTAGE_OFF`: Discount vouchers (e.g., 25% off)
- `FIXED_VERXIO_CREDITS`: Platform credit vouchers
- `FREE_ITEM`: Product redemption vouchers
- `TOKEN`: Real asset-backed vouchers (NFT holds actual USDC/SPL tokens)

#### Key capabilities:
- **Autonomous wallets**: Token vouchers hold real assets in their NFT account
- **Partial redemption**: Use 10 USDC from a 50 USDC voucher, keep the rest
- **Programmable expiry**: On-chain enforcement of validity periods
- **Transferability controls**: Merchant configures if vouchers can be transferred
- **Multi-use support**: Single-use or multiple-redemption vouchers

**Example**: Issue a 50 USDC voucher NFT → NFT holds the actual tokens → tokens (USDC) earn yield while held → recipient withdraws or spends at checkout → all on-chain, zero trust required.

---

### 3. Reward Distribution

Shareable reward links with one-click claiming.

- Generate unique URLs for campaigns, referrals, or promotions
- Users claim via email (Privy auth) → instant embedded wallet creation
- Metaplex Core NFT minted and delivered automatically
- Escrow system for secure token distribution
- QR codes for offline/in-person distribution

**Use cases**: Customer acquisition, referral bonuses, promotional campaigns, event giveaways.

---

### 4. Payment & Checkout

Solana Pay integration with NFT-powered payment capabilities.

#### Pay with loyalty NFTs:
- Customer pays using tokens loaded on their loyalty pass NFT
- NFT autonomously signs the transaction
- Points awarded automatically post-payment
- Tier progression happens in real-time

#### Standard payments:
- USDC payments for price stability
- Fee sponsorship for gasless UX
- Multi-voucher stacking (voucher + wallet combo)
- QR code checkout for mobile
- Real-time transaction status

---

## How It Works

### Loyalty Pass Flow

```
1. Merchant creates loyalty program → Metaplex Core collection created
2. Customer makes first purchase → Loyalty pass NFT minted
3. Customer loads $50 USDC onto NFT → Merchant gets cashflow upfront
4. Customer pays at checkout using NFT → Autonomous wallet signs transaction
5. Points awarded → External plugin updates on-chain
6. Tier progression → Metadata updated in real-time
7. Benefits unlocked → Discounts auto-applied on next purchase
```

### Token Voucher Flow

```
1. Merchant creates 50 USDC prepaid loyalty card → transferred to NFT's escrow account
2. Customer claims $50 USDC onto NFT → Merchant gets pre-revenue cashflow
3. Customer receives NFT → Can withdraw, redeem, or pay with it
4. Customer earns yield on $50 balance → Reflect Money integration
4. Customer spends 30 USDC from loyalty card at checkout → Autonomous wallet signs transaction 
5. Custoemr has 20 USDC balance still earning yield from Reflect Money
5. All transactions on-chain → Zero trust, full transparency
```

---

## Architecture

### Metaplex Core NFT as Autonomous Wallet

Every Verxio asset (loyalty pass or voucher) is a Metaplex Core NFT with three layers:

```
┌─────────────────────────────────────────┐
│     Metaplex Core NFT (Loyalty Pass)    │
├─────────────────────────────────────────┤
│  Layer 1: Dynamic Metadata              │
│  • Points, tier, benefits               │
│  • Updates in real-time                 │
├─────────────────────────────────────────┤
│  Layer 2: External Plugin               │
│  • XP count, tier thresholds            │
│  • Reward claims, conditions            │
│  • On-chain programmable logic          │
├─────────────────────────────────────────┤
│  Layer 3: Yield-Bearing Token Account   │
│  • Holds SPL tokens (USDC, etc.)        │
│  • Earns yield via Reflect Money        │
│  • Signs transactions autonomously      │
│  • Functions as independent wallet      │
└─────────────────────────────────────────┘

Update Authority: Merchant (controls points/tiers)
Owner: Customer (holds NFT, controls funds, earns yield)
```

### Why Metaplex Core?

- **External Plugins**: Store loyalty data directly on-chain
- **Lifecycle Hooks**: Trigger point awards on transfers/purchases
- **Update Authority**: Merchants programmatically update loyalty rules
- **Token Accounts**: NFTs hold and manage real assets
- **Transaction Signing**: NFTs authorize payments autonomously

This architecture enables **prepaid loyalty cards** where NFTs are both membership and payment method.

### Yield-Bearing Loyalty Assets

Verxio loyalty cards integrate with **Reflect Money** to make prepaid balances productive assets:

**For Merchants:**
- Get pre-revenue cashflow when customers load prepaid balances
- Convert future spend into immediate working capital
- No liability on balance sheet (customer owns the funds)

**For Customers:**
- Load $50 USDC → earn yield on the full balance while it sits in the loyalty card
- Spend flexibly while continuing to earn on remaining balance
- Earn dual rewards: yield on balance + loyalty points on spending
- Withdraw anytime (non-custodial)

**Example**: Customer loads $50 → merchant receives $50 immediately → customer earns ~5% APY on balance + 2% back in loyalty points on every purchase.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Solana wallet (devnet/mainnet SOL)
- Helius API key
- Privy account (authentication)
- Pinata account (IPFS metadata storage)

### Installation

```bash
# Clone repository
git clone https://github.com/Axio-Lab/verxio-beta/
cd verxio-beta

# Install dependencies
npm install

# Set up environment variables
# Create .env.local file (see env.example)

# Set up database
npx prisma generate
npx prisma migrate deploy

# Run development server
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000)

---

<div align="center">
  
**Built with ❤️ by the Verxio Team**
  
[Website](https://www.verxio.xyz) • [GitHub](https://github.com/Axio-Lab/verxio-beta) • [Twitter](https://twitter.com/verxioprotocol)

</div>
