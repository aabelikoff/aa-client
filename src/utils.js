import { ethers } from "ethers";
import * as contracts from "./contracts/index.js";
import { config } from "dotenv";
config();

export function unpackUserOp(userOp) {
  // upacking accountGasLimits (uint128, uint128)
  const verificationGasLimit = BigInt("0x" + userOp.accountGasLimits.slice(2, 34));
  const callGasLimit = BigInt("0x" + userOp.accountGasLimits.slice(34, 66));

  // upacking gasFees (uint128, uint128)
  const maxFeePerGas = BigInt("0x" + userOp.gasFees.slice(2, 34));
  const maxPriorityFeePerGas = BigInt("0x" + userOp.gasFees.slice(34, 66));

  // upacking paymasterAndData
  const paymasterAndData = userOp.paymasterAndData;
  const paymaster = '0x' + paymasterAndData.slice(2, 42); // address: 20 bytes
  const validationGasLimit = BigInt("0x" + paymasterAndData.slice(42, 74)); // uint128
  const postOpGasLimit = BigInt("0x" + paymasterAndData.slice(74, 106)); // uint128
  const dummyData = '0x' + paymasterAndData.slice(106);

  const userOpForRpc = {
    sender: userOp.sender,
    nonce: ethers.toBeHex(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: ethers.toBeHex(callGasLimit),
    verificationGasLimit: ethers.toBeHex(verificationGasLimit),
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
    maxPriorityFeePerGas: ethers.toBeHex(maxPriorityFeePerGas),
    paymaster,
    paymasterData: dummyData,
    paymasterVerificationGasLimit: ethers.toBeHex(validationGasLimit),
    paymasterPostOpGasLimit: ethers.toBeHex(postOpGasLimit),
    preVerificationGas: ethers.toBeHex(userOp.preVerificationGas),
    signature: userOp.signature,
  };

  return userOpForRpc;
}
