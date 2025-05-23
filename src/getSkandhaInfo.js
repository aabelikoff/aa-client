(async()=>{
    const returnedValue = await fetch('https://testnet-rpc.etherspot.io/v2/421614?api-key=etherspot_3ZetzuND3H4GZrXNMhpJdzLj', {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    },
    // Batch together multiple calls like so
    body: JSON.stringify([
        { "method": "skandha_config" }, 
        { "method": "eth_chainId" },
        { "method": "eth_supportedEntryPoints" },
        {     "method": "skandha_feeHistory",
            "params": [
                "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
                "15",
                "latest"
        ]}])
})
    .then((res) => {
        return res.json()
    }).catch((err) => {
        console.log(err);
        // throw new Error(JSON.stringify(err.response))
    });
console.log('Value returned: ', returnedValue);
})();