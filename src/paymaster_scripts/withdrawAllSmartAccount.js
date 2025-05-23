import { withdrawAllSmartAccount } from "./withdrawUtils";
import { config } from "dotenv";
config();


withdrawAllSmartAccount()
    .then(()=>exit(0))
    .catch(error=>{console.error(error);exit(1)});