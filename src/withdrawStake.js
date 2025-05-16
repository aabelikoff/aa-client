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
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT_ADDRESS;
const FACTORY_ADDRESS = process.env.ACCOUNT_FACTORY_CONTRACT_ADDRESS;
const PAYMASTER_ADDRESS = process.env.PAYMASTER_CONTRACT_ADDRESS;


const main = async () => {
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
        console.log("Try again after: ", Number(depositInfo[4]) - block.timestamp, " seconds");
        return;
    }
    const tx = await paymasterContract.withdrawStakeFromEntryPoint(owner.address);
    const receipt = await tx.wait();
    console.log("Transaction hash:", tx.hash);


}

main()
    .then(() => {
        console.log("Stake withdrawn successfully");
    })
    .catch((error) => {
        console.error("Error withdrawing stake:", error);
    });