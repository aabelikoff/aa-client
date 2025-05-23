import { withdrawStake } from "./withdrawUtils";
import { config } from "dotenv";
config();


withdrawStake(process.env.OWNER_ADDRESS)
    .then(()=>exit(0))
    .catch(error=>{console.error(error);exit(1)});