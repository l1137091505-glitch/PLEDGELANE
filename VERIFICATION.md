# Verification

## Contract

- Compiler: Solidity 0.8.24
- Constructor arguments: none
- Network: BOT Mainnet, chain ID 677
- Source: `contracts/src/PledgeLane.sol`

## Frontend checks

- Connect does not request a signature or transaction.
- EIP-6963 providers are listed separately when available.
- Legacy `window.ethereum` remains supported.
- Chain switch falls back to `wallet_addEthereumChain` when chain 677 is unknown.
- Every write action explains its intent before the wallet confirmation.
- Without a configured address, the app shows labelled preview records and blocks write actions.

## Risk note

The contract is intentionally small but unaudited. Review and test it before using material funds.
