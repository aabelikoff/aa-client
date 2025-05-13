import { ethers } from "ethers";
import * as contracts from "./contracts/index.js";
import { config } from "dotenv";
config();

import {
  createSmartAccountClient,
  toSmartContractAccount,
  LocalAccountSigner,
  getEntryPoint,
  buildUserOperation,
} from "@aa-sdk/core";
import { arbitrumSepolia } from "viem/chains";

const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const provider = new ethers.JsonRpcProvider(rpcUrl);
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT_ADDRESS;
const FACTORY_ADDRESS = process.env.ACCOUNT_FACTORY_CONTRACT_ADDRESS;
const PAYMASTER_ADDRESS = process.env.PAYMASTER_CONTRACT_ADDRESS;
const TARGET_CONTRACT_ADDRESS = process.env.COMPANY_CONTRACT_ADDRESS;
const TARGET_CONTRACT_NAME = 'CompanyContract';
const TARGET_CONTRACT_METHOD = 'addCompanyInfo';
const TARGET_METHOD_PARAMS = ['name123', 'description123'];

const epAddress = getEntryPoint(arbitrumSepolia, {version: '0.7.0'});
console.log('EP address:', epAddress.address);
console.log('EP address from env:', ENTRY_POINT_ADDRESS);


async function main() {
   
    
    const owner = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    console.log('Owner address:', owner.address);

     const entryPoint  = new ethers.Contract(
        ENTRY_POINT_ADDRESS,
        contracts.default.EntryPointContract.abi,
        owner
    )

    const verificationGasLimit = 1_500_000n;
    const callGasLimit = 1_500_000n;
    const preVerificationGas = 100_000n;
    const validationGasLimit = 100_000n;
    const postOpGasLimit = 150_000n;

    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas;

    const maxPriorityFeePerGas = await provider.send('rundler_maxPriorityFeePerGas')
    const dummyData = '0x';

    console.log(maxFeePerGas);
    console.log(maxPriorityFeePerGas);
    
    const accountGasLimits = ethers.solidityPacked(
        ["uint128", "uint128"],
        [verificationGasLimit, callGasLimit]
    );

    const gasFees = ethers.solidityPacked(
        ["uint128", "uint128"],
        [maxFeePerGas, maxPriorityFeePerGas]
    );

    
  let paymasterAndData = ethers.solidityPacked(
    ['address', 'uint128', 'uint128', 'bytes'],
    [PAYMASTER_ADDRESS, validationGasLimit, postOpGasLimit, dummyData]
  );

  const AccountFactory = new ethers.ContractFactory(
    contracts.default.AccountFactory.abi,
    contracts.default.AccountFactory.bytecode,
    new ethers.Wallet(OWNER_PRIVATE_KEY, provider)
  );
    
  let initCode = 
    FACTORY_ADDRESS +
    AccountFactory.interface
    .encodeFunctionData('createAccount', [owner.address])
    .slice(2);

  let sender;
  try {
    await entryPoint.connect(owner) .getSenderAddress(initCode);
  } catch (ex) {
    sender = '0x' + ex.data.slice(-40);
  }

  const code = await provider.getCode(sender);

  if(code != '0x'){
    console.log('Account already deployed');      
    initCode = '0x';
  }
  
  console.log({sender});

  const TargetContract = new ethers.Contract(
      TARGET_CONTRACT_ADDRESS,
      contracts.default[TARGET_CONTRACT_NAME].abi,
      provider
  )
  const targetMethodCallData = TargetContract.interface.encodeFunctionData(
      TARGET_CONTRACT_METHOD,
      TARGET_METHOD_PARAMS
  )
  
  const Account = new ethers.Contract(
      sender,
      contracts.default.Account.abi,
      provider
  );
  const callData = Account.interface.encodeFunctionData(
      'execute',
      [
        TARGET_CONTRACT_ADDRESS,
        0n,
        targetMethodCallData
      ]
  );

  const nonce = await entryPoint.getNonce(sender, 0);

   const userOp = {
    sender,
    nonce,
    initCode,
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData,
    signature:
      '0x'
  };

  // sign UserOperation
  const userOpHash = await entryPoint.getUserOpHash(userOp);
  console.log("UserOpHash:", userOpHash);

//   const signature = await owner.signMessage(ethers.getBytes(userOpHash));
  const signature = await owner.signMessage(userOpHash);
  userOp.signature = signature;
  console.log("Signature:", signature);
  
    const userOpForRpc = {
    sender,
    nonce: ethers.toBeHex(userOp.nonce),
    initCode,
    callData,
    callGasLimit: ethers.toBeHex(callGasLimit),
    verificationGasLimit: ethers.toBeHex(verificationGasLimit),
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
    maxPriorityFeePerGas: ethers.toBeHex(maxPriorityFeePerGas),
    paymaster: PAYMASTER_ADDRESS,
    paymasterData: dummyData,
    paymasterVerificationGasLimit: ethers.toBeHex(validationGasLimit),
    preVerificationGas: ethers.toBeHex(preVerificationGas),
    paymasterPostOpGasLimit: ethers.toBeHex(postOpGasLimit),
    signature: userOp.signature,
    // paymasterAndData,
    // gasFees,
  }
//   console.log(userOpForRpc);

  const res = await provider.send('eth_sendUserOperation', [userOpForRpc,ENTRY_POINT_ADDRESS]);
  console.log(res);

//sending through EntryPoint directly
// const tx = await entryPoint.handleOps([userOp], owner.address);
// const receipt = await tx.wait();
// console.log(receipt);

}

 function extractPaymasterAndDataFields(packed) {
        const paymaster = '0x' + packed.slice(2, 42); // address (20 bytes)
        const paymasterData = '0x' + packed.slice(42); // rest (limits + dummyData)
        return { paymaster, paymasterData };
 }

 function extractFactoryAndData(initCode) {
        if (initCode === '0x') return { factory: undefined, factoryData: '0x' };
        const factory = '0x' + initCode.slice(2, 42);
        const factoryData = '0x' + initCode.slice(42);
        return { factory, factoryData };
 }

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
