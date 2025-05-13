import { createWalletClient, http, encodeFunctionData, parseAbi } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as contracts from './contracts/index.js';
import { config } from 'dotenv';
config();

const privateKey = `0x${process.env.OWNER_PRIVATE_KEY!}`;
const accountFactoryAddress = process.env.ACCOUNT_FACTORY_CONTRACT_ADDRESS! as `0x${string}`;
const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

// ABI контракта
const accountFactoryAbi = contracts.default.AccountFactory.abi;

(async () => {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  // Кодируем calldata для вызова addCompanyInfo("company", "about company")
  const data = encodeFunctionData({
    abi: accountFactoryAbi,
    functionName: 'createAccount',
    args: [account.address],
  });

  console.log('Calling createAccount  directly from EOA...', account.address);

  try {
    const hash = await client.sendTransaction({
      to: accountFactoryAddress,
      data,
      value: 0n,
    });

    console.log('Tx Hash:', hash);
  } catch (err) {
    console.error('Transaction failed:', err);
  }
})();
