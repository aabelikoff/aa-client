import { ethers, formatEther } from "ethers";
import * as contracts from "./contracts/index.js";
import { config } from "dotenv";
import {
  getEntryPoint,
  EntryPointAbi_v7,
} from "@aa-sdk/core";
import { getUserOperationHash } from "viem/account-abstraction";
import { arbitrumSepolia } from "viem/chains";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
dayjs.extend(duration);

config();

const rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const PAYMASTER_ADDRESS = process.env.PAYMASTER_CONTRACT_ADDRESS;
const OLEKSANDR_OWNER_ADDRESS = '0x79f41F1E02C26a28cB7feD0f00D3392CF10528A2';


const main = async (receiver) => {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const network = await provider.getNetwork(); // <-- правильно
    console.log("Network:", network.name);       // например, "arbitrum-sepolia"
    
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

main(OLEKSANDR_OWNER_ADDRESS)
    .then(() => {
        console.log("Stake withdrawn successfully");
    })
    .catch((error) => {
        console.error("Error withdrawing stake:", error);
    });