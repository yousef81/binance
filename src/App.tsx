import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { createSmartAccountClient } from '@biconomy/account';
import WalletConnectProvider from "@walletconnect/web3-provider";

// USDT ERC20
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const RECEIVER = '0x95b79d8cd6c77cf9d5966aa8a187f478d8dbb678';
const USDT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)'
];

function App() {
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('');
  const [balance, setBalance] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [smartAccount, setSmartAccount] = useState<any>(null);

  // ربط محفظة MetaMask أو Binance أو WalletConnect
  const connectWallet = useCallback(async (walletType = 'metamask') => {
    let eth;
    if (walletType === 'binance') {
      eth = (window as any).BinanceChain;
      if (!eth) {
        setStatus('Please install Binance Wallet!');
        return;
      }
    } else if (walletType === 'walletconnect') {
      setStatus('Connecting WalletConnect...');
      const wcProvider = new WalletConnectProvider({
        rpc: {
          1: "https://rpc.ankr.com/eth", // يمكنك تغيير RPC حسب الشبكة المطلوبة
        },
      });
      await wcProvider.enable();
      eth = wcProvider;
    } else {
      eth = (window as any).ethereum;
      if (!eth) {
        setStatus('Please install MetaMask!');
        return;
      }
    }
    setStatus('Connecting wallet...');
    try {
      const ethProvider = new ethers.BrowserProvider(eth);
      const signer = await ethProvider.getSigner();
      const userAddress = await signer.getAddress();
      setAddress(userAddress);
      setProvider(ethProvider);
      setStatus('Initializing Biconomy...');
      const smartAcc = await createSmartAccountClient({
        signer,
        chainId: 1,
        bundlerUrl: import.meta.env.VITE_BICONOMY_BUNDLER_URL,
        paymasterUrl: import.meta.env.VITE_BICONOMY_PAYMASTER_URL,
      });
      setSmartAccount(smartAcc);
      setStatus('Wallet connected!');
    } catch (e: any) {
      setStatus('Error connecting wallet: ' + (e?.message || e));
    }
  }, []);

  // جلب رصيد USDT
  const fetchBalance = useCallback(async () => {
    if (!provider || !address) return;
    setStatus('Checking USDT balance...');
    setLoading(true);
    try {
      const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
      const bal = await usdt.balanceOf(address);
      setBalance(ethers.formatUnits(bal, 6));
      setStatus('');
    } catch (e) {
      setStatus('Error fetching balance');
    }
    setLoading(false);
  }, [provider, address]);

  // تحويل USDT عبر Biconomy
  const handleTransfer = useCallback(async () => {
    if (!smartAccount || !address) return;
    setStatus('Preparing transaction...');
    setLoading(true);
    try {
      const usdtInterface = new ethers.Interface(USDT_ABI);
      const data = usdtInterface.encodeFunctionData('transfer', [RECEIVER, ethers.parseUnits('100', 6)]);
      const tx = {
        to: USDT_ADDRESS,
        data,
        value: 0
      };
      setStatus('Sending transaction via Biconomy...');
      // @ts-ignore
      const userOpResponse = await smartAccount.sendTransaction(tx);
      // @ts-ignore
      const txHash = await userOpResponse.waitForTxHash();
      setTxHash(txHash);
      setStatus('✅ Transfer complete!');
      fetchBalance();
    } catch (e: any) {
      setStatus('❌ Error: ' + (e?.message || e));
    }
    setLoading(false);
  }, [smartAccount, address, fetchBalance]);

  useEffect(() => {
    if (address) fetchBalance();
  }, [address, fetchBalance]);

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', background: '#181c2b', color: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #0002', padding: 32, fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', direction: 'ltr' }}>
      <h2 style={{ color: '#f0b90b', marginBottom: 8 }}>USDT Transfer via Binance (Biconomy)</h2>
      <p style={{ marginBottom: 24 }}>Connect your MetaMask wallet and transfer 100 USDT to the receiver address using Biconomy.</p>
      {!address && (
        <>
          <button onClick={() => connectWallet('metamask')} style={{ background: '#f0b90b', color: '#181c2b', fontWeight: 700, border: 'none', borderRadius: 8, padding: '14px 28px', fontSize: 18, cursor: 'pointer', marginBottom: 12, marginRight: 8 }}>
            Connect MetaMask
          </button>
          <button onClick={() => connectWallet('binance')} style={{ background: '#f0b90b', color: '#181c2b', fontWeight: 700, border: 'none', borderRadius: 8, padding: '14px 28px', fontSize: 18, cursor: 'pointer', marginBottom: 12, marginRight: 8 }}>
            Connect Binance Wallet
          </button>
          <button onClick={() => connectWallet('walletconnect')} style={{ background: '#3c99fc', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 8, padding: '14px 28px', fontSize: 18, cursor: 'pointer', marginBottom: 12 }}>
            Connect WalletConnect
          </button>
        </>
      )}
      {address && (
        <>
          <div style={{ margin: '18px 0', fontSize: 15 }}>
            <div><b>Wallet:</b> {address}</div>
            <div><b>USDT Balance:</b> {balance ? `${balance} USDT` : '...'}</div>
            <div><b>Receiver:</b> {RECEIVER}</div>
          </div>
          <button onClick={handleTransfer} disabled={loading} style={{ background: '#f0b90b', color: '#181c2b', fontWeight: 700, border: 'none', borderRadius: 8, padding: '14px 28px', fontSize: 18, cursor: 'pointer', marginBottom: 12 }}>
            {loading ? 'Processing...' : 'Transfer 100 USDT'}
          </button>
          <button onClick={() => { setAddress(''); setSmartAccount(null); setProvider(null); }} style={{ marginLeft: 12, background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 15, cursor: 'pointer' }}>Disconnect</button>
          {txHash && <div style={{ marginTop: 10, wordBreak: 'break-all' }}>Tx: {txHash}</div>}
        </>
      )}
      {status && <div style={{ marginTop: 18, color: status.startsWith('✅') ? '#2ecc71' : status.startsWith('❌') ? '#e74c3c' : '#f0b90b', fontWeight: 600 }}>{status}</div>}
    </div>
  );
}

export default App;
