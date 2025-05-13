import * as contracts from "./contracts/index.js";
import { config } from "dotenv";
import { computeAccountAddress } from "./computeAccountAddress.js";
config();

import {
  createSmartAccountClient,
  toSmartContractAccount,
  LocalAccountSigner,
  getEntryPoint,
  buildUserOperation,
} from "@aa-sdk/core";
import {
  http,
  encodeFunctionData,
  parseAbi,
  type Hex,
  type SignableMessage,
  type TypedDataDefinition,
  toHex,
  createPublicClient,
  createWalletClient,
  encodePacked,
  getAddress,
} from "viem";
//   import { arbitrumSepolia } from "@aa-sdk/core";
import * as dotenv from "dotenv";
import { json } from "stream/consumers";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { parseUnits } from "ethers";

dotenv.config();

const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const privateKey = process.env.OWNER_PRIVATE_KEY!;
const entryPoint = getEntryPoint(arbitrumSepolia, { version: "0.7.0" });
const factoryAddress = process.env
  .ACCOUNT_FACTORY_CONTRACT_ADDRESS! as `0x${string}`;
const paymasterAddress = process.env.PAYMASTER_CONTRACT_ADDRESS!;
const smartAccountIndex = 0n;
const targetContract = process.env.COMPANY_CONTRACT_ADDRESS!;

const companyAbi = contracts.default.CompanyContract.abi;
const accountFactoryAbi = contracts.default.AccountFactory.abi;
const accountAbi = contracts.default.Account.abi;
const entryPointAbi = contracts.default.EntryPointContract.abi;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const client = createWalletClient({
    account: privateKeyToAccount(privateKey as `0x${string}`),
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
});

const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(),
});

(async () => {
  try {

    const verificationGasLimit = 500_000n;
    const callGasLimit = 500_000n;
    const preVerificationGas = 50_000n;
    const maxFeePerGas = parseUnits('1', 'gwei');
    const maxPriorityFeePerGas = parseUnits('0.5', 'gwei');
    const validationGasLimit = 100_000n;
    const postOpGasLimit = 150_000n;
    const dummyData = '0x';

     const accountGasLimits = encodePacked(
        ['uint128', 'uint128'],
        [verificationGasLimit, callGasLimit]
    );

    const gasFees = encodePacked(
        ['uint128', 'uint128'],
        [maxFeePerGas, maxPriorityFeePerGas]
    );

    const initCode = factoryAddress + encodeFunctionData({
        abi: accountFactoryAbi,
        functionName: "createAccount",
        args: [client.account.address],
    }).slice(2);

    const entryPointAddress = getEntryPoint(arbitrumSepolia, { version: "0.7.0" });

    let sender: `0x${string}` = '0x0000000000000000000000000000000000000000';
    try {
        await publicClient.readContract({
            address: entryPointAddress,
            abi: entryPointAbi,
            functionName: 'getSenderAddress',
            args: [initCode],
        });
    } catch (e: any) {
        sender = getAddress(`0x${e?.data?.slice(-40)}`);
    }

    //check if account already exists
    const code = await publicClient.getCode({address: sender});
    

    const actualInitCode = code === '0x' ? '0x' : initCode;

    const nonce = await publicClient.readContract({
        address: entryPointAddress,
        abi: entryPointAbi,
        functionName: 'getNonce',
        args: [sender, 0n],
    });

    const callData = encodeFunctionData({
        abi: accountAbi,
        functionName: "execute",
        args: [
            process.env.COMPANY_CONTRACT_ADDRESS!, 
            0n,
            encodeFunctionData({
                abi: companyAbi,
                functionName: "addCompanyInfo",
                args: ["company", "about company"],
            })
        ]
    });

    const paymasterAndData = encodePacked(
        ['address', 'uint128', 'uint128', 'bytes'],
        [paymasterAddress as `0x${string}`, validationGasLimit,postOpGasLimit, dummyData]
    )

    //creating userOp
    const userOp = {
        sender,
        nonce,
        initCode: actualInitCode,
        callData,
        accountGasLimits,
        preVerificationGas,
        gasFees,
        paymasterAndData,
        signature: '0x',
    };

    console.log(userOp);

  } catch (error) {
    console.error('Error occurred:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Raw error:', JSON.stringify(error, null, 2));
    }
  }
})();