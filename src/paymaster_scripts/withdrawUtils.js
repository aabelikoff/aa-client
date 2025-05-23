import { ethers, formatEther } from "ethers";
import * as contracts from "../contracts/index.js";
import { config } from "dotenv";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import { log } from "console";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getEntryPoint,
  EntryPointAbi_v7,
} from "@aa-sdk/core"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dayjs.extend(duration);

config();

const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const PAYMASTER_ADDRESS = process.env.PAYMASTER_CONTRACT_ADDRESS;

export const withdrawStake = async (receiver) => {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const network = await provider.getNetwork(); 
    console.log("Network:", network.name);
    
    const owner = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    console.log("Owner address:", owner.address);
    
    const paymasterContract = new ethers.Contract(
        PAYMASTER_ADDRESS,
        contracts.default.PaymasterContract.abi,
        owner
    );
    console.log("Paymaster address:", paymasterContract.target);

    const depositInfo = await paymasterContract.getDepositInfo();
    console.log("Deposit info:", depositInfo);
    
    const block = await provider.getBlock('latest');
    console.log('Block timestamp: ', block.timestamp);
    
    if(block.timestamp < depositInfo[4]) {
        console.log("You can't withdraw stake yet. Wait until the withdraw time.");
        const seconds = Number(depositInfo[4]) - Number(block.timestamp);
        const dur = dayjs.duration(seconds, 'seconds');
        const h = dur.hours() > 0 ? `${dur.hours()}h ` : '';
        const m = dur.minutes() > 0 ? `${dur.minutes()}m ` : '';
        const s = dur.seconds() > 0 ? `${dur.seconds()}s` : '';

        throw new Error(`Try again after: ${h}${m}${s}`.trim());
    }
    const tx = await paymasterContract.withdrawStakeFromEntryPoint(receiver);
    const receipt = await tx.wait();
    console.log("Transaction hash:", tx.hash);
}

export const closePaymaster = async(receiver)=>{
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const network = await provider.getNetwork(); 
    console.log("Network:", network.name);
    
    const owner = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    console.log("Owner address:", owner.address);
    
    const paymasterContract = new ethers.Contract(
        PAYMASTER_ADDRESS,
        contracts.default.PaymasterContract.abi,
        owner
    );

    let [depositStart, isStaked, stakeSum, unstakeDelaySec, withdrawTime] = await paymasterContract.getDepositInfo();
    console.log(depositStart);

    let tx = await paymasterContract.withdrawFromEntryPoint(receiver, depositStart);
    tx.wait();

    tx = await paymasterContract.unlockEntryPointStake();
    let receipt = await tx.wait();

    const closingBlock = await provider.getBlock(receipt.blockNumber);

    [depositEnd,isStaked,stakeSum,unstakeDelaySec,withdrawTime] = await paymasterContract.getDepositInfo();

    const startTimeToUnstake = Date.now() + withdrawTime - closingBlock.timestamp;
    const startDate = new Date(startTimeToUnstake);
    const formattedDate = startDate.toLocaleString();


    const deploymentsDir = path.join(__dirname, `./withdrawLogs/${networkName}`);

    if(!fs.existsSync(deploymentsDir)){
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const logFile = path.join(deploymentsDir, `withdraw_log_${Date.now()}_${paymasterContract.target}.txt`);

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    logToFileAndConsole(logStream,"PaymasterContract: ", paymasterContract.target);
    logToFileAndConsole(logStream,"Deposit amount returned: ", `${depositStart - depositEnd}`);
    logToFileAndConsole(logStream, "Deposit receiver: ", receiver);
    logToFileAndConsole(logStream, "Unstake time: ", formattedDate);
    logToFileAndConsole(logStream, 'Stake to withdraw: ', stakeSum.toString());

    await new Promise((resolve) => logStream.end(resolve));
    console.log("Log File successfully written.");
}

function logToFileAndConsole(logStream, ...messages) {
    const combined = messages.join(' ');
    console.log(combined);
    logStream.write(combined + '\n');
}

export const withdrawAllSmartAccount = async () => {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const network = await provider.getNetwork(); 
    console.log("Network:", network.name);
    
    const owner = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    console.log("Owner address:", owner.address);

    const smartAccountAddress = await getSmartAccountAddress(owner, process.env.ACCOUNT_FACTORY_CONTRACT_ADDRESS, process.env.ENTRY_POINT_ADDRESS);

    const saBalance = await provider.getBalance(smartAccount);
    console.log("SmartAccount balance: ", saBalance);

    if(saBalance > 0){
        const smartAccount = new ethers.Contract(
            smartAccountAddress,
            contracts.default.Account.abi,
            owner
        );

        const tx = await smartAccount.withdrawAll();
        const receipt = await tx.wait();
        console.log("SmartAccount withdraw transaction hash:", tx.hash);
    }
}

export async function getSmartAccountAddress( owner, af, ep){
    const AccountFactory = new ethers.ContractFactory(contracts.default.AccountFactory.abi, contracts.default.AccountFactory.bytecode, owner);

    const entryPoint  = await ethers.getContractAt('EntryPoint', ep);
    let initCode = 
            af +
            AccountFactory.interface
            .encodeFunctionData('createAccount', [owner])
            .slice(2);


    let sender='';
    try {
        await entryPoint.getSenderAddress(initCode)
    } catch (ex) {
        sender = '0x' + (ex.data.data || ex.data).slice(-40);
    } finally {
        return sender;
    }
    
}