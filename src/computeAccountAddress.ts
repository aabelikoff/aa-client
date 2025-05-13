import { encodePacked, keccak256, encodeAbiParameters, toHex, getCreate2Address, pad, hexToBytes } from 'viem';
import { type Address } from 'viem';

export function computeAccountAddress({
  factoryAddress,
  accountBytecode,
  ownerAddress
}: {
  factoryAddress: Address;
  accountBytecode: `0x${string}`;
  ownerAddress: Address;
}): Address {
  // 1. Use the same salt logic as in your factory: bytes32(uint256(uint160(owner)))
  const salt = pad(hexToBytes(ownerAddress), { size: 32 }); // padLeft to 32 bytes

  // 2. Encode constructor arguments (only `owner` in your case)
  const encodedConstructorArgs = encodeAbiParameters(
    [{ type: 'address' }],
    [ownerAddress]
  );

  // 3. Concatenate bytecode + constructor args
  const fullBytecode = `${accountBytecode}${encodedConstructorArgs.slice(2)}` as `0x${string}`;

  // 4. Hash it
  const bytecodeHash = keccak256(fullBytecode);

  // 5. Compute CREATE2 address
  const computedAddress = getCreate2Address({
    from: factoryAddress,
    salt,
    bytecodeHash
  });

  return computedAddress;
}
