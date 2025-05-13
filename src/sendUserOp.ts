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
} from "viem";
//   import { arbitrumSepolia } from "@aa-sdk/core";
import * as dotenv from "dotenv";
import { json } from "stream/consumers";
import { arbitrumSepolia } from "viem/chains";


const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT_ADDRESS;
const entryPoint = getEntryPoint(arbitrumSepolia, { version: "0.7.0" });
console.log("EP address:", entryPoint.address);
console.log("EP address from env:", ENTRY_POINT_ADDRESS);

const FACTORY_ADDRESS = process.env
  .ACCOUNT_FACTORY_CONTRACT_ADDRESS! as `0x${string}`;

const PAYMASTER_ADDRESS = process.env.PAYMASTER_CONTRACT_ADDRESS;
const TARGET_CONTRACT_ADDRESS = process.env.COMPANY_CONTRACT_ADDRESS;
const TARGET_CONTRACT_NAME = 'CompanyContract';
const TARGET_CONTRACT_METHOD = 'addCompanyInfo';
const TARGET_METHOD_PARAMS = ['name123', 'description123'];

const smartAccountIndex = 0n;


const targetAbi = contracts.default[TARGET_CONTRACT_NAME].abi;
const accountFactoryAbi = contracts.default.AccountFactory.abi;
const accountAbi = contracts.default.Account.abi;

(async () => {
  try {
    const signer = LocalAccountSigner.privateKeyToAccountSigner(
      `0x${OWNER_PRIVATE_KEY}`
    );
    //computed sa address
    const address = computeAccountAddress({
      factoryAddress: FACTORY_ADDRESS,
      accountBytecode: contracts.default.Account.bytecode as `0x${string}`,
      ownerAddress: await signer.getAddress(),
    });
    console.log("Computed address: ", address);

    //init code (factory address & init calldata)
    const encodedCalldata = (FACTORY_ADDRESS +
      encodeFunctionData({
        abi: accountFactoryAbi,
        functionName: "createAccount",
        args: [await signer.getAddress()],
      }).slice(2)) as `0x${string}`;
    console.log("Encoded calldata: ", encodedCalldata);

    //call data for CompanyContract
    const encodedAddTargetnfo = encodeFunctionData({
      abi: targetAbi,
      functionName: TARGET_CONTRACT_METHOD,
      args: TARGET_METHOD_PARAMS,
    });
    console.log("Encoded target method calldata: ", encodedAddTargetnfo);

    //call data for execute in cmart account
    const encodeExecuteCallData = encodeFunctionData({
      abi: accountAbi,
      functionName: "execute",
      args: [TARGET_CONTRACT_ADDRESS, 0n, encodedAddTargetnfo],
    });
    console.log("Encoded execute calldata: ", encodeExecuteCallData);

    const account = await toSmartContractAccount({
      source: "Account",
      transport: http(rpcUrl),
      chain: arbitrumSepolia,
      entryPoint,
      getAccountInitCode: async () => encodedCalldata,
      getDummySignature: () =>
        "0x00fffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
      encodeExecute: async ({ target, data, value }) => {
        return encodeFunctionData({
          abi: accountAbi,
          functionName: "execute",
          args: [target, value ?? 0n, data],
        });
      },
      signMessage: async ({ message }: { message: SignableMessage }) => {
        const signature = await signer.signMessage(message);
        return signature;
      },
      signTypedData: async (typedData) => {
        const signature = await signer.signTypedData(typedData);
        return signature;
      },
      accountAddress: address,
    });

    console.log("Account: ", account.address);
    console.log("Is Account deployed: ", await account.isAccountDeployed());

    const client = createSmartAccountClient({
      chain: arbitrumSepolia,
      transport: http(rpcUrl),
      account: account,
    });

    // console.log('Client: ', client);

    console.log("Factory Address: ", await client.account.getFactoryAddress());
    console.log("EntryPoint Address: ", client.account.getEntryPoint().address);

    const initCode = await client.account.getInitCode();
    console.log("Init Code: ", initCode);

    const userOp = await client.buildUserOperation({
      uo: {
        target: account.address,
        data: encodeExecuteCallData,
        value: 0n,
      },
      account,
    });

    

    // console.log('UserOp: ', userOp);

    // const userOpHash = await client.sendUserOperation({
    //   account,
    //   uo: {
    //     target: account.address,
    //     data: encodeExecuteCallData,
    //     value: 0n
    //   },

    // });

    // console.log("UserOperation Hash:", userOpHash);

    // const txHash = await client.waitForUserOperationTransaction(userOpHash);
    // console.log("Transaction Hash:", txHash);
  } catch (error) {
    console.error("❌ Ошибка во время выполнения sendUserOp.ts:", error);
    process.exit(1);
  }
})();
