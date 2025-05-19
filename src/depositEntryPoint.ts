import { createWalletClient, http, parseAbi, encodeFunctionData } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import * as contracts from './contracts/index.js';

dotenv.config();

const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const paymasterAddress = process.env.PAYMASTER_CONTRACT_ADDRESS! as `0x${string}`;
const privateKey = process.env.TEST_PRIVATE_KEY!;

const abi = contracts.default.PaymasterContract.abi;

const client = createWalletClient({
  account: privateKeyToAccount(`0x${privateKey}`),
  chain: arbitrumSepolia,
  transport: http(rpcUrl),
});
const amount = BigInt(1e14); //0.0001 ETH

(async () => {
  const txHash = await client.sendTransaction({
    to: paymasterAddress,
    data: encodeFunctionData({
      abi,
      functionName: 'addStakeToEntryPoint',
      args: [10]
    }),
    value: amount
  });

  console.log('Tx hash:', txHash);
})();
