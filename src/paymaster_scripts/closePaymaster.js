import { closePaymaster } from "./withdrawUtils.js";
import { config } from "dotenv";
config();


closePaymaster(process.env.OWNER_ADDRESS)
    .then(()=>exit(0))
    .catch(error=>{console.error(error);exit(1)});