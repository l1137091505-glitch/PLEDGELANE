# PLEDGELANE 部署步骤

1. 在 GitHub 新建一个空的公开仓库，例如 `pledgelane`。不要额外创建 README、License 或 `.gitignore`。
2. 解压 `PLEDGELANE-GITHUB-UPLOAD.zip`，把解压后的全部内容上传到仓库根目录并提交。
3. 在 Remix 新建 `PledgeLane.sol`，复制 `contracts/src/PledgeLane.sol` 的全部内容。
4. 使用 Solidity `0.8.24` 编译，合约选择 `PledgeLane`。
5. 在 Remix 的 Deploy & Run Transactions 中选择 `Browser Extension / MetaMask`，钱包切换到 BOT Mainnet：
   - Chain ID：`677`
   - RPC：`https://rpc.botchain.ai`
   - Explorer：`https://scan.botchain.ai`
6. 部署 `PledgeLane`。构造函数没有参数。钱包确认前核对网络和费用。
7. 复制完整合约地址。
8. 在 Vercel 导入 GitHub 仓库：
   - Root Directory：`frontend`
   - Framework Preset：`Vite`
9. 在 Vercel → Environment Variables 添加 Config 变量：

```text
Key: VITE_PLEDGELANE_ADDRESS
Value: 0x你的完整合约地址
Environment: Production
```

10. 保存后重新部署 Production，并且不要使用旧的 Build Cache。

## 钱包连接说明

- 点击 Connect wallet 后会显示浏览器检测到的钱包；连接本身不会要求签名或付款。
- 首次连接会提示添加或切换到 BOT Mainnet。
- 创建活动、捐助、领取和退款都需要单独在钱包中确认。
- 手机端请在钱包自带浏览器中打开网站，或使用页面中的 MetaMask mobile 入口。

合约地址是公开信息，应使用 Config，不需要设为 Secret。绝对不要把助记词、私钥或钱包密码上传到 GitHub/Vercel。
