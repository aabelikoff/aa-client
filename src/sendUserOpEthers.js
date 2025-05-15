import { ethers, formatEther, keccak256 } from "ethers";
import * as contracts from "./contracts/index.js";
import { unpackUserOp } from "./utils.js";
import { config } from "dotenv";
config();

import {
  createSmartAccountClient,
  toSmartContractAccount,
  LocalAccountSigner,
  getEntryPoint,
  buildUserOperation,
  EntryPointAbi_v7,
  
} from "@aa-sdk/core";

import { getUserOperationHash } from "viem/account-abstraction";
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
const TARGET_METHOD_PARAMS = ['SuperCompany', 'hello world'];

const epAddress = getEntryPoint(arbitrumSepolia, {version: '0.7.0'});
const epAddress_6 = getEntryPoint(arbitrumSepolia, {version: '0.6.0'});
console.log('EP address 0.7.0:', epAddress.address);
console.log('EP address 0.6.0:', epAddress_6.address);
console.log('EP address from env:', ENTRY_POINT_ADDRESS);



async function main() {
    const owner = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    console.log('Owner address:', owner.address);

     const entryPoint  = new ethers.Contract(
        ENTRY_POINT_ADDRESS,
        EntryPointAbi_v7,
        owner
    )

    const paymasterContract = new ethers.Contract(
        PAYMASTER_ADDRESS,
        contracts.default.PaymasterContract.abi,
        owner
    )

    async function getDepositInfo(){
      const [ deposit, isStaked, stakeSum, unstakeDelaySec, withdrawTime ] = await paymasterContract.getDepositInfo();
      return {
        deposit, 
        isStaked,
        stakeSum,
        unstakeDelaySec,
        withdrawTime
      }
    }
    const depositInfo = await getDepositInfo();
    console.log('Deposit info:', depositInfo);

    
    const minimumStake = formatEther(BigInt('0x16345785d8a0000'));
    const minimumUnstakeDelay = BigInt('0x15180');
    console.log('Minimum stake:', minimumStake);
    console.log('Minimum unstake delay:', minimumUnstakeDelay);

    if(!depositInfo.deposit){
      await paymasterContract.depositToEntryPoint({value: ethers.parseEther('0.005')});
      console.log('Deposited to EntryPoint');
    }
    if(!depositInfo.isStaked){
      await paymasterContract.addStakeToEntryPoint(minimumUnstakeDelay, {value: ethers.parseEther(minimumStake)});
      console.log('Staked to EntryPoint');
    }
    // const txDepo = await paymasterContract.depositToEntryPoint({value: ethers.parseEther('0.002')});
    // const receiptDepo = await txDepo.wait();

    // const validationGasLimit = 100_000n;
    const postOpGasLimit = 150_000n;

    //checking staking balance


    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas;

    const maxPriorityFeePerGas = await provider.send('rundler_maxPriorityFeePerGas')
    const dummyData = '0x';

    console.log(maxFeePerGas);
    console.log(maxPriorityFeePerGas);
    

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
    await entryPoint.connect(owner).getSenderAddress(initCode);
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
  console.log("Nonce: ", nonce.toString());

  
  //creating userOp for bundler
  const userOpBundler = {
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
 ;
  const dummySignature = await owner.signMessage( ethers.getBytes(ethers.id('dummy')));
  userOpBundler.signature = dummySignature;

  const {preVerificationGas, callGasLimit, verificationGasLimit, paymasterVerificationGasLimit } = await provider.send('eth_estimateUserOperationGas', [
    userOpBundler,
    ENTRY_POINT_ADDRESS,
  ]);


  userOpBundler.callGasLimit = callGasLimit;
  userOpBundler.verificationGasLimit = verificationGasLimit;
  userOpBundler.preVerificationGas = preVerificationGas;
  userOpBundler.paymasterVerificationGasLimit = paymasterVerificationGasLimit;



  
 //getting userOpHash from bundler
  const userOpHashBundler = getUserOperationHash({
    chainId: 421614n,
    entryPointAddress: ENTRY_POINT_ADDRESS,
    entryPointVersion: '0.7',
    userOperation: userOpBundler
  });
  //signing userOp for bundler
  const signature = await owner.signMessage(ethers.getBytes(userOpHashBundler));
  userOpBundler.signature = signature;
  
  
  console.log('=============================\n')
  console.log("UserOpHash Bundler: ", userOpHashBundler);
  console.log('Signature: ',signature);
  console.log('\n=============================')

  console.log('UserOp Bundler: ', userOpBundler);

  const res = await provider.send('eth_sendUserOperation', [userOpBundler,ENTRY_POINT_ADDRESS]);
  console.log(res);

  // sending through EntryPoint directly
  // const tx = await entryPoint.handleOps([userOp], owner.address);
  // const receipt = await tx.wait();
  // console.log(receipt);

}



main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
