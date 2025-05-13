import { createWalletClient, http, encodeFunctionData, parseAbi } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as contracts from './contracts/index.js';
import { config } from 'dotenv';
config();

const privateKey = `0x${process.env.OWNER_PRIVATE_KEY!}`;
const companyAddress = process.env.COMPANY_CONTRACT_ADDRESS! as `0x${string}`;
const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

// ABI контракта
const companyAbi = contracts.default.CompanyContract.abi;

(async () => {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  // Кодируем calldata для вызова addCompanyInfo("company", "about company")
  const data = encodeFunctionData({
    abi: companyAbi,
    functionName: 'addCompanyInfo',
    args: ['company', 'about company'],
  });

  console.log('Calling addCompanyInfo directly from EOA...');

  try {
    const hash = await client.sendTransaction({
      to: companyAddress,
      data,
      value: 0n,
    });

    console.log('Tx Hash:', hash);
  } catch (err) {
    console.error('Transaction failed:', err);
  }
})();
