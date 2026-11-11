import { BrowserProvider, Contract, JsonRpcProvider, formatEther, parseEther } from "ethers";
import "./style.css";

type EipProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type WalletOption = { name: string; icon?: string; rdns?: string; provider: EipProvider };
type Campaign = {
  id: number;
  creator: string;
  title: string;
  description: string;
  goal: bigint;
  deadline: number;
  raised: bigint;
  claimed: boolean;
  cancelled: boolean;
  preview?: boolean;
};

const CHAIN = {
  id: 677,
  hex: "0x2a5",
  name: "BOT Mainnet",
  rpc: "https://rpc.botchain.ai",
  explorer: "https://scan.botchain.ai",
  currency: { name: "BOT", symbol: "BOT", decimals: 18 },
};

const ADDRESS = (import.meta.env.VITE_PLEDGELANE_ADDRESS || "").trim();
const LIVE = /^0x[a-fA-F0-9]{40}$/.test(ADDRESS);
const ABI = [
  "function campaignCount() view returns (uint256)",
  "function campaigns(uint256) view returns (address creator,string title,string description,uint256 goal,uint64 deadline,uint256 raised,bool claimed,bool cancelled)",
  "function contributions(uint256,address) view returns (uint256)",
  "function createCampaign(string title,string description,uint256 goal,uint64 duration) returns (uint256)",
  "function contribute(uint256 campaignId) payable",
  "function claim(uint256 campaignId)",
  "function refund(uint256 campaignId)",
  "function cancel(uint256 campaignId)",
];

const now = Math.floor(Date.now() / 1000);
const bot = (value: string) => parseEther(value);
const samples: Campaign[] = [
  {
    id: 0,
    creator: "0xA16e92B8C49377F1dAb4D04d6A5b702D21D7A831",
    title: "Night library for shift workers",
    description: "Keep a neighbourhood library open until midnight for nurses, couriers and late-shift families. The goal covers six months of staffing, lighting and accessible study desks.",
    goal: bot("1.8"), raised: bot("1.16"), deadline: now + 86400 * 12, claimed: false, cancelled: false, preview: true,
  },
  {
    id: 1,
    creator: "0xC7106fDf84EE3b7d278A58D4AC3a84E4ED742102",
    title: "Repair café tool library",
    description: "A shared bench and lending shelf for people repairing household electronics instead of discarding them. Funds buy testing tools, safety equipment and parts storage.",
    goal: bot("0.9"), raised: bot("0.9"), deadline: now - 86400 * 2, claimed: false, cancelled: false, preview: true,
  },
  {
    id: 2,
    creator: "0x8BD51FAba91975Af740Bf914FB9A53EE427196e0",
    title: "Wetland field classroom",
    description: "Build a small raised teaching deck beside a restored wetland so local schools can study water, insects and seasonal birds without damaging the habitat.",
    goal: bot("2.4"), raised: bot("0.54"), deadline: now + 86400 * 21, claimed: false, cancelled: false, preview: true,
  },
  {
    id: 3,
    creator: "0x4F23CDE86199e37E4f14176679d4F34acA8496bf",
    title: "Mobile ceramics kiln repair",
    description: "Return a community trailer kiln to service so small studios can share firings. The campaign covers a new controller, insulation, transport inspection and the first test cycle.",
    goal: bot("1.25"), raised: bot("0.31"), deadline: now - 86400 * 3, claimed: false, cancelled: false, preview: true,
  },
];

const state = {
  campaigns: [...samples],
  filter: "all",
  account: "",
  chainId: 0,
  activeProvider: null as EipProvider | null,
  browserProvider: null as BrowserProvider | null,
  wallets: [] as WalletOption[],
  selected: null as Campaign | null,
  busy: false,
};

const app = document.querySelector<HTMLDivElement>("#app")!;
const short = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Connect wallet";
const amount = (value: bigint) => Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 3 });
const pct = (c: Campaign) => c.goal === 0n ? 0 : Math.min(100, Math.round(Number(c.raised * 10000n / c.goal) / 100));
const days = (deadline: number) => Math.max(0, Math.ceil((deadline - Date.now() / 1000) / 86400));
const status = (c: Campaign) => {
  if (c.cancelled) return "cancelled";
  if (c.deadline > Date.now() / 1000) return "active";
  return c.raised >= c.goal ? "successful" : "failed";
};
const esc = (value: string) => value.replace(/[&<>'"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[m]!));

function toast(message: string, tone: "ok" | "error" = "ok") {
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div");
  node.className = `toast ${tone}`;
  node.textContent = message;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => node.classList.remove("show"), 4200);
  setTimeout(() => node.remove(), 4600);
}

function visibleCampaigns() {
  return state.campaigns.filter((c) => state.filter === "all" || status(c) === state.filter);
}

function featured() {
  return state.campaigns.find((c) => status(c) === "active") || state.campaigns[0];
}

function render() {
  const list = visibleCampaigns();
  const hero = featured();
  const totalRaised = state.campaigns.reduce((sum, c) => sum + c.raised, 0n);
  const liveCount = state.campaigns.filter((c) => status(c) === "active").length;
  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="#top" aria-label="PLEDGELANE home"><span class="brand-mark"><i></i><i></i><i></i></span><strong>PLEDGELANE</strong></a>
      <nav aria-label="Primary navigation">
        <a href="#campaigns">Campaigns</a><a href="#rules">How it settles</a><a href="#proof">Network proof</a>
      </nav>
      <div class="header-actions">
        <span class="network"><b></b> BOT 677</span>
        <button class="wallet-button" id="walletButton">${state.account ? short(state.account) : "Connect wallet"}</button>
      </div>
    </header>
    <main id="main">
      <section class="hero" id="top" data-enter>
        <div class="hero-copy">
          <p class="eyebrow">ALL-OR-NOTHING FUNDING · BOT CHAIN</p>
          <h1>Back the whole idea.<br><span>Not half a promise.</span></h1>
          <p class="hero-lede">PLEDGELANE keeps every campaign goal, deadline and contribution in one public settlement path. If a project misses its target, contributors reclaim their BOT.</p>
          <div class="hero-actions">
            <button class="primary" data-open-create>Start a campaign <span>↗</span></button>
            <a class="text-link" href="#campaigns">Browse the lane <span>↓</span></a>
          </div>
          <div class="hero-facts">
            <span><strong>${liveCount}</strong> open campaigns</span>
            <span><strong>${amount(totalRaised)} BOT</strong> recorded</span>
            <span><strong>100%</strong> target required</span>
          </div>
        </div>
        <div class="hero-stage" aria-label="Featured campaign interface">
          <div class="lane-map" aria-hidden="true"><span>OPEN</span><b></b><b></b><b></b><span>SETTLE</span></div>
          ${hero ? featuredCard(hero) : ""}
          <div class="settlement-ticket">
            <span>SETTLEMENT RULE</span><strong>Goal met?</strong>
            <div><b>YES</b><i></i><em>Creator claims</em></div>
            <div><b>NO</b><i></i><em>Backers refund</em></div>
          </div>
        </div>
      </section>

      <section class="campaign-section" id="campaigns">
        <div class="section-head">
          <div><p class="eyebrow">PUBLIC CAMPAIGN LEDGER</p><h2>Every promise stays in its lane.</h2></div>
          <button class="primary compact" data-open-create>Start a campaign <span>＋</span></button>
        </div>
        ${!LIVE ? `<div class="preview-note"><b>Preview ledger</b><span>Sample campaigns are shown until you deploy the contract and add <code>VITE_PLEDGELANE_ADDRESS</code>.</span><button data-dismiss-preview aria-label="Dismiss preview notice">×</button></div>` : ""}
        <div class="filters" role="tablist" aria-label="Filter campaigns">
          ${["all", "active", "successful", "failed"].map((f) => `<button role="tab" aria-selected="${state.filter === f}" data-filter="${f}">${f}<sup>${f === "all" ? state.campaigns.length : state.campaigns.filter((c) => status(c) === f).length}</sup></button>`).join("")}
        </div>
        <div class="ledger-list">
          <div class="ledger-labels"><span>Campaign</span><span>Deadline</span><span>Funding</span><span>Status</span><span></span></div>
          ${list.length ? list.map(campaignRow).join("") : `<div class="empty">No campaigns in this lane yet.</div>`}
        </div>
      </section>

      <section class="rules-section" id="rules">
        <div class="rules-title"><p class="eyebrow">ONE CONTRACT, TWO ENDINGS</p><h2>The deadline draws a clean line.</h2></div>
        <div class="rules-track">
          <article><span>01</span><h3>Publish the terms</h3><p>The creator fixes a title, description, target and duration before the first BOT enters.</p></article>
          <article><span>02</span><h3>Back the campaign</h3><p>Contributions accumulate on-chain. No creator withdrawal is available while the deadline is open.</p></article>
          <article class="outcome"><span>03A</span><h3>Target reached</h3><p>After the deadline, the creator can claim the recorded balance once.</p></article>
          <article class="outcome inverse"><span>03B</span><h3>Target missed</h3><p>Each contributor can refund their own recorded contribution once.</p></article>
        </div>
      </section>

      <section class="proof-section" id="proof">
        <div class="proof-statement"><span>PUBLIC TERMS.</span><span>PRIVATE CHOICE.</span><span>CLEAN SETTLEMENT.</span></div>
        <div class="proof-panel">
          <p class="eyebrow">NETWORK PROOF</p>
          <dl><div><dt>Chain</dt><dd>BOT Mainnet</dd></div><div><dt>Chain ID</dt><dd>677 · 0x2a5</dd></div><div><dt>Contract</dt><dd>${LIVE ? `<a href="${CHAIN.explorer}/address/${ADDRESS}" target="_blank" rel="noreferrer">${short(ADDRESS)} ↗</a>` : "Awaiting deployment"}</dd></div><div><dt>Explorer</dt><dd><a href="${CHAIN.explorer}" target="_blank" rel="noreferrer">scan.botchain.ai ↗</a></dd></div></dl>
        </div>
      </section>
    </main>
    <footer><a class="brand footer-brand" href="#top"><span class="brand-mark"><i></i><i></i><i></i></span><strong>PLEDGELANE</strong></a><p>All-or-nothing crowdfunding on BOT Chain.</p><div><a href="https://www.botchain.ai/en/" target="_blank" rel="noreferrer">BOT Chain</a><a href="${CHAIN.explorer}" target="_blank" rel="noreferrer">Explorer</a></div><small>Contract interactions require your confirmation in your wallet.</small></footer>
    <div id="modalRoot"></div>
  `;
  bind();
}

function featuredCard(c: Campaign) {
  return `<article class="featured-card" data-campaign="${c.id}">
    <div class="feature-top"><span class="status-pill">${status(c)}</span><span>${days(c.deadline)} days left</span></div>
    <p class="campaign-number">LANE / ${String(c.id + 1).padStart(3, "0")}</p>
    <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>
    <div class="feature-meter"><i style="width:${pct(c)}%"></i></div>
    <div class="feature-numbers"><strong>${amount(c.raised)} BOT</strong><span>of ${amount(c.goal)} BOT</span><em>${pct(c)}%</em></div>
    <button class="card-action" data-campaign="${c.id}">Open campaign <span>↗</span></button>
  </article>`;
}

function campaignRow(c: Campaign) {
  return `<article class="ledger-row" data-campaign="${c.id}">
    <div class="row-title"><span>${String(c.id + 1).padStart(2, "0")}</span><div><h3>${esc(c.title)}</h3><p>by ${short(c.creator)}</p></div></div>
    <div class="row-deadline"><b>${days(c.deadline)}</b><span>${c.deadline > now ? "days left" : "days closed"}</span></div>
    <div class="row-funding"><div><strong>${amount(c.raised)} / ${amount(c.goal)} BOT</strong><span>${pct(c)}%</span></div><i><b style="width:${pct(c)}%"></b></i></div>
    <span class="row-status ${status(c)}">${status(c)}</span>
    <button class="row-open" data-campaign="${c.id}" aria-label="Open ${esc(c.title)}">↗</button>
  </article>`;
}

function bind() {
  document.querySelector("#walletButton")?.addEventListener("click", () => state.account ? showAccount() : showWallets());
  document.querySelectorAll<HTMLElement>("[data-filter]").forEach((el) => el.addEventListener("click", () => { state.filter = el.dataset.filter || "all"; render(); }));
  document.querySelectorAll<HTMLElement>("[data-open-create]").forEach((el) => el.addEventListener("click", showCreate));
  document.querySelectorAll<HTMLElement>("[data-campaign]").forEach((el) => el.addEventListener("click", (event) => { event.stopPropagation(); const c = state.campaigns.find((x) => x.id === Number(el.dataset.campaign)); if (c) showCampaign(c); }));
  document.querySelector("[data-dismiss-preview]")?.addEventListener("click", (event) => (event.currentTarget as HTMLElement).parentElement?.remove());
}

function modal(content: string, className = "") {
  const root = document.querySelector<HTMLDivElement>("#modalRoot")!;
  root.innerHTML = `<div class="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true"><button class="modal-close" aria-label="Close">×</button>${content}</section></div>`;
  root.querySelector(".modal-close")?.addEventListener("click", closeModal);
  root.querySelector(".modal-backdrop")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener("keydown", closeOnEscape);
}
function closeOnEscape(e: KeyboardEvent) { if (e.key === "Escape") closeModal(); }
function closeModal() { document.querySelector("#modalRoot")!.innerHTML = ""; document.removeEventListener("keydown", closeOnEscape); }

function showWallets() {
  discoverWallets();
  const installed = state.wallets.map((w, i) => `<button class="wallet-choice" data-wallet="${i}">${w.icon ? `<img src="${w.icon}" alt="">` : `<span>${w.name.slice(0, 1)}</span>`}<div><strong>${esc(w.name)}</strong><small>Browser wallet</small></div><b>Connect ↗</b></button>`).join("");
  modal(`<p class="eyebrow">WALLET ACCESS</p><h2>Choose your wallet.</h2><p class="modal-intro">Connecting only reveals your public address. PLEDGELANE never asks for a signature just to connect.</p><div class="wallet-list">${installed || `<div class="no-wallet"><strong>No browser wallet detected.</strong><p>Open this page inside your wallet browser, or install a compatible EVM wallet.</p></div>`}<a class="wallet-choice mobile" href="https://metamask.app.link/dapp/${location.host}${location.pathname}"><span>M</span><div><strong>Open MetaMask mobile</strong><small>Use the in-app browser</small></div><b>Open ↗</b></a></div><p class="security-line">BOT Mainnet · Chain ID 677 · No seed phrase is ever required</p>`, "wallet-modal");
  document.querySelectorAll<HTMLElement>("[data-wallet]").forEach((el) => el.addEventListener("click", () => connectWallet(state.wallets[Number(el.dataset.wallet)])));
}

function showAccount() {
  modal(`<p class="eyebrow">CONNECTED WALLET</p><h2>${short(state.account)}</h2><p class="modal-intro">${state.chainId === CHAIN.id ? "Ready on BOT Mainnet." : "Switch to BOT Mainnet before sending a transaction."}</p><div class="account-actions"><button class="primary" id="switchChain">Switch to BOT Mainnet</button><button class="secondary" id="disconnect">Forget this session</button></div><a class="text-link" href="${CHAIN.explorer}/address/${state.account}" target="_blank" rel="noreferrer">View on explorer ↗</a>`, "account-modal");
  document.querySelector("#switchChain")?.addEventListener("click", ensureChain);
  document.querySelector("#disconnect")?.addEventListener("click", () => { state.account = ""; state.activeProvider = null; state.browserProvider = null; closeModal(); render(); toast("Wallet session cleared."); });
}

function showCreate() {
  modal(`<p class="eyebrow">NEW CAMPAIGN</p><h2>Put the whole promise on one line.</h2><form id="createForm" class="create-form"><label>Campaign title<input name="title" maxlength="80" required placeholder="e.g. Night library for shift workers"></label><label>Public description<textarea name="description" maxlength="700" required placeholder="State what will be delivered and how the target will be used."></textarea></label><div class="form-split"><label>Target amount<input name="goal" type="number" min="0.0001" step="0.0001" required placeholder="1.00"><span>BOT</span></label><label>Campaign length<input name="days" type="number" min="1" max="90" step="1" required value="14"><span>DAYS</span></label></div><div class="form-note"><b>All-or-nothing</b><span>The creator can claim only after the deadline and only if the complete target is reached.</span></div><button class="primary wide" type="submit">Publish campaign <span>↗</span></button></form>`, "create-modal");
  document.querySelector<HTMLFormElement>("#createForm")?.addEventListener("submit", createCampaign);
}

function showCampaign(c: Campaign) {
  state.selected = c;
  const current = status(c);
  modal(`<div class="detail-head"><span class="status-pill">${current}</span><span>LANE / ${String(c.id + 1).padStart(3, "0")}</span></div><h2>${esc(c.title)}</h2><p class="detail-description">${esc(c.description)}</p><div class="detail-progress"><div><strong>${amount(c.raised)} BOT</strong><span>of ${amount(c.goal)} BOT</span><em>${pct(c)}%</em></div><i><b style="width:${pct(c)}%"></b></i></div><dl class="detail-facts"><div><dt>Creator</dt><dd>${short(c.creator)}</dd></div><div><dt>Deadline</dt><dd>${new Date(c.deadline * 1000).toLocaleDateString()}</dd></div><div><dt>Settlement</dt><dd>${current === "active" ? `${days(c.deadline)} days remaining` : current}</dd></div></dl>${c.preview ? `<div class="preview-action"><b>Preview record</b><span>Deploy and configure the contract to send transactions.</span></div>` : actionFor(c)}${LIVE ? `<a class="text-link detail-link" href="${CHAIN.explorer}/address/${ADDRESS}" target="_blank" rel="noreferrer">Inspect contract ↗</a>` : ""}`, "detail-modal");
  document.querySelector<HTMLFormElement>("#contributeForm")?.addEventListener("submit", contribute);
  document.querySelector("#claimButton")?.addEventListener("click", () => write("claim", [c.id], "Campaign funds claimed."));
  document.querySelector("#refundButton")?.addEventListener("click", () => write("refund", [c.id], "Contribution refunded."));
}

function actionFor(c: Campaign) {
  const current = status(c);
  if (current === "active") return `<form id="contributeForm" class="contribute-form"><label>Back this campaign<input name="amount" type="number" min="0.0001" step="0.0001" required placeholder="0.10"><span>BOT</span></label><button class="primary" type="submit">Contribute BOT <span>↗</span></button></form>`;
  if (current === "successful") return `<div class="settle-action"><p>The complete target was reached. The creator can claim after the deadline.</p><button class="primary" id="claimButton">Claim campaign funds</button></div>`;
  if (current === "failed") return `<div class="settle-action"><p>The target was missed. Contributors can reclaim their recorded BOT.</p><button class="primary" id="refundButton">Refund my contribution</button></div>`;
  return "";
}

async function discoverWallets() {
  const seen = new Set(state.wallets.map((w) => w.provider));
  const add = (wallet: WalletOption) => { if (!seen.has(wallet.provider)) { seen.add(wallet.provider); state.wallets.push(wallet); } };
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as { info: { name: string; icon?: string; rdns?: string }; provider: EipProvider };
    if (detail?.provider) add({ ...detail.info, provider: detail.provider });
  };
  window.addEventListener("eip6963:announceProvider", handler as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  const ethereum = (window as Window & { ethereum?: EipProvider & { providers?: EipProvider[]; isMetaMask?: boolean } }).ethereum;
  if (ethereum?.providers?.length) ethereum.providers.forEach((provider, index) => add({ name: index === 0 ? "Injected wallet" : `Browser wallet ${index + 1}`, provider }));
  else if (ethereum) add({ name: ethereum.isMetaMask ? "MetaMask" : "Browser wallet", provider: ethereum });
  setTimeout(() => window.removeEventListener("eip6963:announceProvider", handler as EventListener), 1200);
}

async function connectWallet(wallet: WalletOption) {
  try {
    const accounts = await wallet.provider.request({ method: "eth_requestAccounts" }) as string[];
    if (!accounts?.[0]) throw new Error("No account was returned.");
    state.activeProvider = wallet.provider;
    state.browserProvider = new BrowserProvider(wallet.provider as never);
    state.account = accounts[0];
    state.chainId = Number(await wallet.provider.request({ method: "eth_chainId" }));
    wallet.provider.on?.("accountsChanged", (...args) => { const next = args[0] as string[]; state.account = next?.[0] || ""; render(); });
    wallet.provider.on?.("chainChanged", (...args) => { state.chainId = Number(args[0]); render(); });
    closeModal(); render(); toast(`Connected ${short(state.account)}.`);
    if (state.chainId !== CHAIN.id) await ensureChain();
  } catch (error) { toast(messageOf(error), "error"); }
}

async function ensureChain() {
  if (!state.activeProvider) { showWallets(); return false; }
  try {
    await state.activeProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hex }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) { toast(messageOf(error), "error"); return false; }
    await state.activeProvider.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN.hex, chainName: CHAIN.name, nativeCurrency: CHAIN.currency, rpcUrls: [CHAIN.rpc], blockExplorerUrls: [CHAIN.explorer] }] });
  }
  state.chainId = CHAIN.id; render(); toast("BOT Mainnet is ready."); return true;
}

async function contract(writeAccess = false) {
  if (!LIVE) throw new Error("Deploy the contract and set VITE_PLEDGELANE_ADDRESS first.");
  if (!writeAccess) return new Contract(ADDRESS, ABI, new JsonRpcProvider(CHAIN.rpc));
  if (!state.account || !state.browserProvider) { showWallets(); throw new Error("Connect a wallet first."); }
  if (!(await ensureChain())) throw new Error("BOT Mainnet is required.");
  return new Contract(ADDRESS, ABI, await state.browserProvider.getSigner());
}

async function loadCampaigns() {
  if (!LIVE) return;
  try {
    const read = await contract(false);
    const count = Number(await read.campaignCount());
    const loaded = await Promise.all(Array.from({ length: count }, async (_, id) => {
      const c = await read.campaigns(id);
      return { id, creator: c.creator, title: c.title, description: c.description, goal: c.goal, deadline: Number(c.deadline), raised: c.raised, claimed: c.claimed, cancelled: c.cancelled } as Campaign;
    }));
    state.campaigns = loaded.reverse(); render();
  } catch (error) { toast(`Read-only RPC unavailable: ${messageOf(error)}`, "error"); }
}

async function createCampaign(event: SubmitEvent) {
  event.preventDefault();
  const data = new FormData(event.currentTarget as HTMLFormElement);
  const title = String(data.get("title") || "").trim();
  const description = String(data.get("description") || "").trim();
  const goal = String(data.get("goal") || "0");
  const duration = Number(data.get("days")) * 86400;
  if (!LIVE) { toast("Deploy the contract and set VITE_PLEDGELANE_ADDRESS first.", "error"); return; }
  await write("createCampaign", [title, description, parseEther(goal), duration], "Campaign published.");
}

async function contribute(event: SubmitEvent) {
  event.preventDefault();
  if (!state.selected) return;
  const value = String(new FormData(event.currentTarget as HTMLFormElement).get("amount") || "0");
  await write("contribute", [state.selected.id], "Contribution recorded.", parseEther(value));
}

async function write(method: string, args: unknown[], success: string, value?: bigint) {
  if (state.busy) return;
  try {
    state.busy = true;
    const writeContract = await contract(true);
    toast("Confirm this transaction in your wallet.");
    const tx = await writeContract[method](...args, value === undefined ? {} : { value });
    toast(`Transaction sent: ${short(tx.hash)}`);
    await tx.wait();
    closeModal(); await loadCampaigns(); toast(success);
  } catch (error) { const message = messageOf(error); if (!message.includes("Connect a wallet first")) toast(message, "error"); }
  finally { state.busy = false; }
}

function messageOf(error: unknown) {
  const raw = error as { shortMessage?: string; reason?: string; message?: string; code?: number };
  if (raw.code === 4001) return "The wallet request was cancelled.";
  return raw.shortMessage || raw.reason || raw.message || "The wallet could not complete the request.";
}

render();
discoverWallets();
loadCampaigns();
