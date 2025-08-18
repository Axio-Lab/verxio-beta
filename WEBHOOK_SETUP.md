# Helius Webhook Setup for Solana Pay

This document explains how to set up the Helius webhook system to track Solana payments in real-time.

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Helius API Configuration
HELIUS_API_KEY=your_helius_api_key_here

# Base URL for webhooks (your domain)
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Optional: Custom webhook secret for authentication
WEBHOOK_SECRET=your_webhook_secret_here
```

## How It Works

1. **Payment Creation**: When a merchant creates a payment, the system:
   - Generates a Solana Pay URL
   - Registers a webhook with Helius to track the merchant's wallet address
   - Stores the webhook ID for cleanup

2. **Webhook Registration**: The system automatically creates a Helius webhook that:
   - Monitors the merchant's wallet address for transactions
   - Sends notifications to `/api/webhook/helius` when transactions occur
   - Uses enhanced webhook type for detailed transaction data

3. **Payment Detection**: When a customer makes a payment:
   - Helius detects the transaction
   - Sends webhook notification to your endpoint
   - System processes the payment and awards loyalty points
   - Merchant receives real-time confirmation

## API Endpoints

### POST `/api/pay`
Creates a payment and registers a webhook.

**Request Body:**
```json
{
  "recipientAddress": "wallet_address",
  "amount": 1.0,
  "label": "Verxio Checkout",
  "message": "Thank you for your purchase!",
  "memo": "Payment for PAY_123",
  "paymentId": "PAY_123"
}
```

**Response:**
```json
{
  "url": "solana:...",
  "ref": "reference_key",
  "recipient": "wallet_address",
  "amount": 1.0,
  "paymentId": "PAY_123"
}
```

### POST `/api/webhook/helius`
Receives webhook notifications from Helius.

**Webhook Payload Structure:**
```json
{
  "type": "TRANSACTION",
  "accountData": [...],
  "signature": "transaction_signature",
  "slot": 123456789,
  "timestamp": 1234567890,
  "fee": 5000,
  "nativeTransfers": [...],
  "tokenTransfers": [...]
}
```

## Webhook Configuration

The system automatically configures Helius webhooks with these settings:

- **Webhook Type**: `enhanced` (provides detailed transaction data)
- **Transaction Types**: `ANY` (monitors all transaction types)
- **Status**: `confirmed` (notifies when transaction is confirmed)
- **Encoding**: `base58` (standard Solana address encoding)

## Security Considerations

1. **API Key Protection**: Keep your Helius API key secure
2. **Webhook Validation**: Consider implementing signature verification
3. **Rate Limiting**: Helius has rate limits for webhook creation
4. **Cleanup**: Webhooks are stored in memory (implement database storage for production)

## Testing

1. Create a payment using the checkout flow
2. Check console logs for webhook registration
3. Make a test payment to the merchant wallet
4. Monitor webhook endpoint for incoming notifications
5. Verify payment completion in logs

## Production Deployment

1. **Database Storage**: Replace in-memory storage with a database
2. **Webhook Cleanup**: Implement automatic webhook cleanup for completed payments
3. **Error Handling**: Add comprehensive error handling and retry logic
4. **Monitoring**: Add logging and monitoring for webhook health
5. **Authentication**: Implement webhook signature verification

## Troubleshooting

### Webhook Not Receiving Notifications
- Verify Helius API key is valid
- Check webhook URL is accessible
- Ensure wallet address is correct
- Monitor Helius dashboard for webhook status

### Payment Not Detected
- Verify webhook registration was successful
- Check transaction involves the monitored wallet
- Ensure webhook endpoint is responding correctly
- Monitor server logs for errors

### API Errors
- Check environment variables are set correctly
- Verify Helius API key permissions
- Monitor rate limits
- Check network connectivity to Helius API 