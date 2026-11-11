# PLEDGELANE

PLEDGELANE is an original all-or-nothing crowdfunding interface for BOT Chain. Creators publish a target and deadline, contributors fund the campaign, and the contract permits one of two outcomes after the deadline: the creator claims when the target was reached, or contributors refund themselves when it was missed.

## Included

- Original responsive Vite/TypeScript interface.
- EIP-6963 and legacy injected-wallet discovery.
- BOT Mainnet add/switch flow (chain ID 677).
- Read-only campaign loading through the BOT public RPC.
- Solidity 0.8.24 crowdfunding contract with claim, refund and cancellation paths.
- Clearly labelled preview data before a live address is configured.

## Local build

```bash
cd frontend
npm install
npm run build
```

## Environment variable

```text
VITE_PLEDGELANE_ADDRESS=0xYourDeployedContractAddress
```

The contract address is public configuration, not a secret. Never upload a wallet private key or seed phrase.

## Safety

This is experimental software and has not received a professional security audit. Test with small amounts first.
