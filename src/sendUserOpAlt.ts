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
  toBytes,
} from "viem";
//   import { arbitrumSepolia } from "@aa-sdk/core";
import * as dotenv from "dotenv";
import { json } from "stream/consumers";
import { arbitrumSepolia } from "viem/chains";
import { Sign } from "crypto";


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



async function main() {
  // === Step 1: compute expected smart account address ===
  const owner = LocalAccountSigner.privateKeyToAccountSigner(
    `0x${OWNER_PRIVATE_KEY}`);
  const sender = computeAccountAddress({
    factoryAddress: FACTORY_ADDRESS,
    accountBytecode: contracts.default.Account.bytecode as `0x${string}`,
    ownerAddress: await owner.getAddress(),
  });

  console.log('Owner address: ', await owner.getAddress());
  console.log('Sender address: ', sender);

  // === Step 2: build user operation ===
  const encodedTargetCall = encodeFunctionData({
    abi: targetAbi,
    functionName: TARGET_CONTRACT_METHOD,
    args: TARGET_METHOD_PARAMS,
  });

  const executeCallData = encodeFunctionData({
    abi: accountAbi,
    functionName: "execute",
    args: [TARGET_CONTRACT_ADDRESS, 0n, encodedTargetCall],
  });

  const getAccountInitCode = async()=>{
    return (FACTORY_ADDRESS +
        encodeFunctionData({
          abi: accountFactoryAbi,
          functionName: "createAccount",
          args: [await owner.getAddress()],
        }).slice(2)) as `0x${string}`
  }

  const account = await toSmartContractAccount({
    source: "Account",
    transport: http(rpcUrl),
    chain: arbitrumSepolia,
    entryPoint,
    accountAddress: sender,
    getAccountInitCode,
    getDummySignature: ()=> {
      const userOpHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
      return owner.signMessage({ raw: userOpHash })
    },
    encodeExecute: async (uo)=>executeCallData,
    signMessage: async ({message}: {message: SignableMessage})=>{
      return await owner.signMessage(message);
    },
    signTypedData: async (typedData) => {
        return await owner.signTypedData(typedData);
    },
  });

  // === Creating client
  const client = createSmartAccountClient({
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
    account,
  });

  // console.log("Client: ", client);

  const uoStruct = await client.buildUserOperation({
    uo: {
      target: sender,
      data: executeCallData,
      value: 0n,
    }
  });

  console.log("UserOp: ", uoStruct);

  const uoHash = await client.sendUserOperation({
   uo: {
     target: sender,
     data: executeCallData,
     value: 0n
   }

  })

 

  // Ждем подтверждения
  const txHash = await client.waitForUserOperationTransaction({ hash: uoHash });
  console.log('Transaction hash:', txHash);
}




main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error in sendUserOpAlt: ',error)
    process.exit(1)
  })

