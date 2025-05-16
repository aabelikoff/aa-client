import { ethers, formatEther } from "ethers";
import * as contracts from "./contracts/index.js";
import { config } from "dotenv";
import {
  getEntryPoint,
  EntryPointAbi_v7,
} from "@aa-sdk/core";
import { getUserOperationHash } from "viem/account-abstraction";
import { arbitrumSepolia } from "viem/chains";

config();

const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const provider = new ethers.JsonRpcProvider(rpcUrl);
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const chainId = provider._network.chainId;

const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT_ADDRESS;
const FACTORY_ADDRESS = process.env.ACCOUNT_FACTORY_CONTRACT_ADDRESS;
const PAYMASTER_ADDRESS = process.env.PAYMASTER_CONTRACT_ADDRESS;
const TARGET_CONTRACT_ADDRESS = process.env.COMPANY_CONTRACT_ADDRESS;
const TARGET_CONTRACT_NAME = 'CompanyContract';
const TARGET_CONTRACT_METHOD = 'addCompanyInfo';
const TARGET_METHOD_PARAMS = ['SuperCompany LTD', 'hello world !!!!!'];

const epAddress = getEntryPoint(arbitrumSepolia, {version: '0.7.0'});
console.log('EP address 0.7.0:', epAddress.address);
console.log('EP address from env:', ENTRY_POINT_ADDRESS);

const minimumStake = formatEther(BigInt('0x16345785d8a0000'));
const minimumUnstakeDelay = BigInt('0x15180');

const postOpGasLimit = 150_000n;

const owner = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);


export async function getDepositInfo(paymasterContract){
      const [ deposit, isStaked, stakeSum, unstakeDelaySec, withdrawTime ] = await paymasterContract.getDepositInfo();
      return {
        deposit, 
        isStaked,
        stakeSum,
        unstakeDelaySec,
        withdrawTime
      }
}

export async function getInitCodeAndSender(factory, entryPoint, ownerAddress) {
  const initCode = FACTORY_ADDRESS +
    factory.interface.encodeFunctionData('createAccount', [ownerAddress]).slice(2);

  try {
    await entryPoint.getSenderAddress(initCode);
  } catch (ex) {
    const sender = '0x' + ex.data.slice(-40);
    return { initCode, sender };
  }
}

export default async function sendUserOp(entryPointAddress, paymasterAddress, targetContractAddress, targetContractName, targetContractMethod, targetMethodParams, provider, owner) {
     const entryPointContract  = new ethers.Contract(
        entryPointAddress,
        EntryPointAbi_v7,
        owner
    )

    const AccountFactory = new ethers.ContractFactory(
      contracts.default.AccountFactory.abi,
      contracts.default.AccountFactory.bytecode,
      owner
    );

    const {initCode, sender} = await getInitCodeAndSender(AccountFactory, entryPointContract, owner.address);

    //preparing callData
    const targetContract = new ethers.Contract(
        targetContractAddress,
        contracts.default[targetContractName].abi,
        provider
    )
    const targetMethodCallData = targetContract.interface.encodeFunctionData(
        targetContractMethod,
        targetMethodParams
    )

    const smartAccount = new ethers.Contract(
        sender,
        contracts.default.Account.abi,
        provider
    );
    const callData = smartAccount.interface.encodeFunctionData(
        'execute',
      [
        targetContractAddress,
        0n,
        targetMethodCallData
      ]
  );
  const nonce = await entryPointContract.getNonce(sender, 0);

    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas;
    const maxPriorityFeePerGas = await provider.send('rundler_maxPriorityFeePerGas')

  
  //creating userOp for bundler
  const userOp = {
    sender,
    nonce: ethers.toBeHex(nonce),
    initCode,
    callData,
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
    maxPriorityFeePerGas,
    paymaster: paymasterAddress,
    paymasterPostOpGasLimit: ethers.toBeHex(postOpGasLimit),

    }

    //esеtimating userOp gas limits
  const dummySignature = await owner.signMessage( ethers.getBytes(ethers.id('dummy')));
  userOpBundler.signature = dummySignature;

  const gasEstimates = await provider.send('eth_estimateUserOperationGas', [
    userOp,
    ENTRY_POINT_ADDRESS
  ]);

  Object.assign(userOp, {
    callGasLimit: gasEstimates.callGasLimit,
    verificationGasLimit: gasEstimates.verificationGasLimit,
    preVerificationGas: gasEstimates.preVerificationGas,
    paymasterVerificationGasLimit: gasEstimates.paymasterVerificationGasLimit
  });
  
 //getting userOpHash from bundler
  const userOpHash = getUserOperationHash({
    chainId,
    entryPointAddress: entryPointAddress,
    entryPointVersion: '0.7',
    userOperation: userOp
  });
  //signing userOp for bundler
  const signature = await owner.signMessage(ethers.getBytes(userOpHash));
  userOpBundler.signature = signature;
  
  
  console.log('=============================\n')
  console.log("UserOpHash: ", userOpHash);
  console.log('Signature: ',signature);
  console.log('UserOp: ',userOp);
  console.log('\n=============================')


  const tx = await provider.send('eth_sendUserOperation', [userOp,entryPointAddress]);
  const receipt = await tx.wait();
  console.log(receipt);
}

async function main() {
    console.log('Owner address:', owner.address);

     const entryPointContract  = new ethers.Contract(
        ENTRY_POINT_ADDRESS,
        EntryPointAbi_v7,
        owner
    )

    const paymasterContract = new ethers.Contract(
        PAYMASTER_ADDRESS,
        contracts.default.PaymasterContract.abi,
        owner
    )

    //checking deposit and stake
    const depositInfo = await getDepositInfo(paymasterContract);
    if(!depositInfo.deposit){
      await paymasterContract.depositToEntryPoint({value: ethers.parseEther('0.005')});
      console.log('Deposited to EntryPoint');
    }
    if(!depositInfo.isStaked){
      await paymasterContract.addStakeToEntryPoint(minimumUnstakeDelay, {value: ethers.parseEther(minimumStake)});
      console.log('Staked to EntryPoint');
    }


    const AccountFactory = new ethers.ContractFactory(
      contracts.default.AccountFactory.abi,
      contracts.default.AccountFactory.bytecode,
      owner
    );

    const {initCode, sender} = await getInitCodeAndSender(AccountFactory, entryPointContract, owner.address);
  console.log({sender});
  console.log({initCode});

  //preparing callData
  const targetContract = new ethers.Contract(
      TARGET_CONTRACT_ADDRESS,
      contracts.default[TARGET_CONTRACT_NAME].abi,
      provider
  )
  const targetMethodCallData = targetContract.interface.encodeFunctionData(
      TARGET_CONTRACT_METHOD,
      TARGET_METHOD_PARAMS
  )
  
  const smartAccount = new ethers.Contract(
      sender,
      contracts.default.Account.abi,
      provider
  );
  const callData = smartAccount.interface.encodeFunctionData(
      'execute',
      [
        TARGET_CONTRACT_ADDRESS,
        0n,
        targetMethodCallData
      ]
  );
  const nonce = await entryPointContract.getNonce(sender, 0);
  console.log("Nonce: ", nonce.toString());

  //checking staking balance
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas;
    const maxPriorityFeePerGas = await provider.send('rundler_maxPriorityFeePerGas')

    console.log(maxFeePerGas);
    console.log(maxPriorityFeePerGas);

  
  //creating userOp for bundler
  const userOp = {
    sender,
    nonce: ethers.toBeHex(nonce),
    initCode,
    callData,
    // callGasLimit: ethers.toBeHex(callGasLimit),
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
    maxPriorityFeePerGas,
    paymaster: PAYMASTER_ADDRESS,
    paymasterPostOpGasLimit: ethers.toBeHex(postOpGasLimit),
    // preVerificationGas: ethers.toBeHex(preVerificationGas),
    // verificationGasLimit: ethers.toBeHex(verificationGasLimit),
  }

 //esеtimating userOp gas limits
  const dummySignature = await owner.signMessage( ethers.getBytes(ethers.id('dummy')));
  userOpBundler.signature = dummySignature;

  const gasEstimates = await provider.send('eth_estimateUserOperationGas', [
    userOp,
    ENTRY_POINT_ADDRESS
  ]);

  Object.assign(userOp, {
    callGasLimit: gasEstimates.callGasLimit,
    verificationGasLimit: gasEstimates.verificationGasLimit,
    preVerificationGas: gasEstimates.preVerificationGas,
    paymasterVerificationGasLimit: gasEstimates.paymasterVerificationGasLimit
  });
  
 //getting userOpHash from bundler
  
  const userOpHash = getUserOperationHash({
    chainId,
    entryPointAddress: ENTRY_POINT_ADDRESS,
    entryPointVersion: '0.7',
    userOperation: userOp
  });
  //signing userOp for bundler
  const signature = await owner.signMessage(ethers.getBytes(userOpHash));
  userOpBundler.signature = signature;
  
  
  console.log('=============================\n')
  console.log("UserOpHash: ", userOpHash);
  console.log('Signature: ',signature);
  console.log('UserOp: ',userOp);
  console.log('\n=============================')

  console.log('UserOp Bundler: ', userOpBundler);

  const res = await provider.send('eth_sendUserOperation', [userOp,ENTRY_POINT_ADDRESS]);
  console.log(res);
}



main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
