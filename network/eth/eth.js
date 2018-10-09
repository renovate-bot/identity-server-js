module.exports = ({ network = 'ETH' }) => {

  const CryptoJS = require('crypto-js');
  const EC = require('elliptic').ec;
  const ec = new EC('secp256k1');
  const ethereumUtil = require('ethereumjs-util');
  const EthereumTransaction = require('ethereumjs-tx');
  const { getTicker } = require('./../../services/coinmarketcap');
  const ethereumQuery = require('./ethereum-query');
  const BigNumber = require('bignumber.js');

  const { httpEndpointFromConfig } = require('./ethereum-networkhelper')({ network });
  const { getEtherscanClient } = require('./etherscan-helper')({ network });

  const fromWei = (valueWei) => {
    return (new BigNumber(valueWei).dividedBy(new BigNumber(Math.pow(10, 18)))).toString();
  };

  const toWei = (valueEth) => {
    return (new BigNumber(valueEth).multipliedBy(new BigNumber(Math.pow(10, 18)))).toNumber();
  };

  const toWeiHex = (valueEth) => {
    return `0x${(new BigNumber(valueEth).multipliedBy(new BigNumber(Math.pow(10, 18)))).toString(16)}`;
  };

  const create = async ({ seed, index, networkConfig }) => {
    // return require('./../../services/hdwallet')
    //   .create({ ...networkConfig, network, seed, index, hex: true });
    const args = Object.assign({ network, seed, index, hex: true }, networkConfig);
    return require('./../../services/hdwallet').create(args);
  };

  const addressFromPrivateKey = ({ privateKey, networkConfig }) => {
    const keyPair = ec.genKeyPair();
    keyPair._importPrivate(privateKey, 'hex');
    const compact = false;
    const pubKey = keyPair.getPublic(compact, 'hex').slice(2);
    const pubKeyWordArray = CryptoJS.enc.Hex.parse(pubKey);
    const hash = CryptoJS.SHA3(pubKeyWordArray, { outputLength: 256 });
    return '0x' + hash.toString(CryptoJS.enc.Hex).slice(24);
  };

  const createRandom = async ({ networkConfig }) => {
    //const web3 = getWeb3Client(networkConfig);
    //const privateKey = web3.sha3((new Date().getTime()) + '' + Math.random());
    const privateKey = ethereumUtil.bufferToHex(ethereumUtil.sha3((new Date().getTime()) + '' + Math.random()));
    if (!privateKey) throw new Error('Private Key was not generated for ETH');
    const address = addressFromPrivateKey({ privateKey, networkConfig });
    return { address, privateKey };
  };

  const isValidAddress = ({ address }) => {
    const prefix = '0x';
    const hasNicePrefix = address.substring(0, prefix.length) === prefix;
    const isCorrectLength = address.length === (40 + prefix.length);
    const valid = hasNicePrefix && isCorrectLength;
    const checksum = valid && require('./../../services/eip55').toChecksumAddress(address) === address;
    const res = { valid, checksum };
    if (!valid) {
      // try to give suggestion
      if (address.length === 40 && !hasNicePrefix) {
        res.error = 'Missing 0x in the beginning?';
      } else if (!isCorrectLength && address.length < (40 + prefix.length)) {
        res.error = 'Too few characters';
      } else if (!isCorrectLength && address.length > (40 + prefix.length)) {
        res.error = 'Too many characters';
      } else if (!address.match(/^0x[0-9A-Fa-f]{40}$/g)) {
        res.error = 'Address should be 40 chars of 0x-hexadecimal';
      }
    }
    return res;
  };

  // primary key is same for all configs
  const isValidPrivateKey = ({ privateKey, networkConfig }) => {
    const prefix = '0x';
    const hasZeroXPrefix = privateKey.substring(0, prefix.length) === prefix;
    const isCorrectLength = privateKey.length === 64;
    const valid = isCorrectLength && !hasZeroXPrefix;
    const res = { valid };
    if (!valid) {
      // try to give suggestion
      if (privateKey.length === 66 && hasZeroXPrefix) {
        res.error = 'Private key should not have 0x in the beginning';
      } else if (!isCorrectLength && privateKey.length < 64) {
        res.error = 'Too few characters';
      } else if (!isCorrectLength && privateKey.length > 64) {
        res.error = 'Too many characters';
      } else if (!address.match(/^[0-9A-Fa-f]{64}$/g)) {
        res.error = 'Private key should be 64 chars of hexadecimal';
      }
    }
    res.address = addressFromPrivateKey({ privateKey, networkConfig });
    return res;
  };

  // const encryptPrivateKey = ({ key, password, networkConfig }) => {
  //   if (password) {
  //     const keyPair = ec.genKeyPair();
  //     keyPair._importPrivate(key, 'hex');

  //     var privKeyBuffer = keyPair.priv;
  //     return bip38.encrypt(privKeyBuffer, false, password);
  //   }
  //   return key;
  // };

  // const decryptPrivateKey = ({ key, password, networkConfig }) => {
  //   if (password) {
  //   }
  //   return key;
  // };

  const niceFloat = x => (parseFloat(x).toFixed(6).replace(/0{1,5}$/, ''));

  // const getEth = ({ web3, address }) => {
  //   return new Promise((resolve, reject) => {
  //     web3.eth.getBalance(address, (error, response) => {
  //       if (error) reject(error);
  //       resolve(niceFloat(web3.fromWei(response.toNumber(), "ether")));
  //     });
  //   });
  // };

  const getEth = ({ address, endpoint }) => {
    return ethereumQuery.query({
      method: 'eth_getBalance',
      params: [ address, 'latest' ],
      endpoint
    });
  };

  // const getBalance = async ({ walletPublicConfig }) => {
  //   const { address, networkConfig } = walletPublicConfig;
  //   const web3 = getWeb3Client(networkConfig);
  //   if (!web3.isConnected())
  //      throw new Error('Cannot connect to the network');
  //   return [{ symbol: 'ETH', name: 'Ethereum', value: await getEth({ web3, address }), cmc: getTicker('ETH') }];
  // };

  const getBalance = async ({ walletPublicConfig }) => {
    const { address, networkConfig } = walletPublicConfig;
    const endpoint = httpEndpointFromConfig(networkConfig);
    if (!ethereumQuery.isRPCAccessible({ endpoint }))
       throw new Error('Cannot connect to the network');
    return [
      { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        value: fromWei(await getEth({ address, endpoint })), 
        cmc: getTicker('ETH') 
      }
    ];
  };

  const getAssetsList = async ({ walletPublicConfig }) => {
    // Getting ETH balance here:
    const { address, networkConfig } = walletPublicConfig;
    // const web3 = getWeb3Client(networkConfig);
    // if (!web3.isConnected()) {
    //    throw new Error('Cannot connect to the network');
    // }
    const endpoint = httpEndpointFromConfig(networkConfig);
    if (!ethereumQuery.isRPCAccessible({ endpoint }))
       throw new Error('Cannot connect to the network');

    const assets = [{
      symbol: 'ETH',
      name: 'Ethereum',
      //value: await getEth({ web3, address }),
      value: fromWei(await getEth({ address, endpoint })),
      cmc: getTicker('ETH')
    }];
    const etherscan = getEtherscanClient(networkConfig);
    const contracts = await etherscan.getTokenContracts(address);
    if (contracts) {
      // console.log('address:' + address + ', contracts: ' + JSON.stringify(contracts));
      contracts.forEach(({ contractAddress, tokenSymbol, tokenName, tokenDecimal }) => {
        assets.push({
           symbol: tokenSymbol, name: tokenName, decimal: tokenDecimal,
           contractAddress, cmc: getTicker(tokenSymbol)
        });
      });
    }
    return assets;
  };

  const getErc20Abi = () => {
    const fs = require('fs');
    const jsonPath = __dirname + "/MyToken.json";
    const json = JSON.parse(fs.readFileSync(jsonPath));
    const { abi } = json;
    return abi;
  };

  const contractCache = {};

  // const getAssetValue = async ({ walletPublicConfig, contractAddress }) => {
  //   const { getWeb3Client } = require('./web3-helper')({ network });
  //   if (!contractAddress) {
  //     throw new Error('Cannot get asset without contractAddress');
  //   }
  //   const { address, networkConfig } = walletPublicConfig;
  //   const web3 = getWeb3Client(networkConfig);
  //   if (!web3.isConnected()) {
  //      throw new Error('Cannot connect to the network');
  //   }

  //   if (!contractCache[contractAddress]) contractCache[contractAddress] = {};
  //   const cachedContract = contractCache[contractAddress] || {};

  //   const abi = getErc20Abi();
  //   const contractAbi = web3.eth.contract(abi);
  //   const theContract = contractAbi.at(contractAddress);
  //   const debug = require('debug')('eth.getassetvalue');
  //   debug('contract at', contractAddress, JSON.stringify(Object.keys(theContract)));
  //   const balance = theContract.balanceOf.call(address);

  //   let decimals = 18;
  //   if (typeof cachedContract.decimals === 'undefined') {
  //     decimals = parseInt(theContract.decimals.call().toString(), 10);
  //     contractCache[contractAddress].decimals = decimals;
  //   }
  //   const value = balance.toNumber() / Math.pow(10, decimals);
  //   debug('balance:', balance.toString(), 'decimals:', decimals, 'value:', value);
  //   const asset = { value, decimals, contractAddress };

  //   try {
  //     const symbol = cachedContract.symbol || theContract.symbol();
  //     if (symbol) {
  //       debug('token contract symbol:', symbol);
  //       asset.symbol = symbol;
  //       contractCache[contractAddress].symbol = symbol;
  //     }
  //   } catch (e) {
  //     debug('token symbol extraction error', e.toString());
  //   }

  //   try {
  //     const name = cachedContract.name || theContract.name();
  //     if (name) {
  //       debug('token contract name:', name);
  //       asset.name = name;
  //       contractCache[contractAddress].name = name;
  //     }
  //   } catch (e) {
  //     debug('token name extraction error', e.toString());
  //   }
  //   return asset;
  // };

  const getAssetValue = async ({ walletPublicConfig, contractAddress }) => {
    if (!contractAddress) {
      throw new Error('Cannot get asset without contractAddress');
    }
    const { address, networkConfig } = walletPublicConfig;

    const endpoint = httpEndpointFromConfig(networkConfig);
    if (!ethereumQuery.isRPCAccessible({ endpoint })) {
      throw new Error('Cannot connect to the network');
    }

    if (!contractCache[contractAddress]) contractCache[contractAddress] = {};
    const cachedContract = contractCache[contractAddress] || {};

    const abi = getErc20Abi();

    const debug = require('debug')('eth.getassetvalue');
    debug('contract at', contractAddress);

    const callParams = { address, contractAddress, abi, endpoint };

    const balance = await ethereumQuery.callContract({
      ...callParams,
      contractMethod: 'balanceOf',
      contractParams: [ address ],
    });

    let decimals = 18;
    if (typeof cachedContract.decimals === 'undefined') {
      decimals = await ethereumQuery.callContract({
        ...callParams, contractMethod: 'decimals'
      });
      contractCache[contractAddress].decimals = decimals;
    }
    const value = balance / Math.pow(10, decimals);
    debug('balance:', balance, 'decimals:', decimals, 'value:', value);
    const asset = { value, decimals, contractAddress };

    try {
      let symbol;
      if (cachedContract.symbol) {
        symbol = cachedContract.symbol;
      } else {
        symbol = await ethereumQuery.callContract({
          ...callParams, contractMethod: 'symbol'
        });
      }
      if (symbol) {
        debug('token contract symbol:', symbol);
        asset.symbol = symbol;
        contractCache[contractAddress].symbol = symbol;
      }
    } catch (e) {
      debug('token symbol extraction error', e.toString());
    }

    try {
      let name;
      if (cachedContract.name) {
        name = cachedContract.name;
      } else {
        name = await ethereumQuery.callContract({
          ...callParams, contractMethod: 'name'
        });
      }
      if (name) {
        debug('token contract name:', name);
        asset.name = name;
        contractCache[contractAddress].name = name;
      }
    } catch (e) {
      debug('token name extraction error', e.toString());
    }
    return asset;
  };

  const sendTransaction = async ({ asset = 'ETH', amount, to, fee, contractAddress, walletPrivateConfig }) => {

    const { address, privateKey, networkConfig } = walletPrivateConfig;
    const endpoint = httpEndpointFromConfig(networkConfig);
    const value = toWeiHex(amount);

    try {
      const nonce = await ethereumQuery.query({
        method: 'eth_getTransactionCount', params: [ address, 'latest' ], endpoint
      });
  
      const gasPrice = fee || await ethereumQuery.query({
        method: 'eth_gasPrice', params: [], endpoint
      });

      const txParams = { from: address };
      
      if (contractAddress) {
        // Smart contract transaction
        const abi = getErc20Abi();
        txParams.to = contractAddress;

        // data: method - transfer, _to - address, _value - uint256
        const methodSpec = ethereumQuery.getMethodSpec({ abi, contractMethod: 'transfer' });
        txParams.data = ethereumQuery.encodeParams({ methodSpec, contractParams: [ to, value ] });

      } else {
        // ETH transaction 
        txParams.to = to;
        txParams.value = value;
      }
  
      const gasLimit = await ethereumQuery.query({
        method: 'eth_estimateGas', 
        params: [ { ...txParams } ], 
        endpoint
      });

      txParams.nonce = nonce;
      txParams.gasPrice = gasPrice;
      txParams.gasLimit = gasLimit;
      
      const tx = new EthereumTransaction(txParams);
      const privKeyBuffer = Buffer.from(privateKey.substring(2), 'hex');
      tx.sign(privKeyBuffer);
      const serializedTx = tx.serialize();
      const rawTx = '0x' + serializedTx.toString('hex');
      
      const txHash = await ethereumQuery.query({
        method: 'eth_sendRawTransaction', params: [ rawTx ], endpoint
      });

      // Calculate fee:
      const receipt = await ethereumQuery.query({
        method: 'eth_getTransactionReceipt', params: [ txHash ], endpoint
      });
      const fee = fromWei(receipt.gasUsed * gasPrice);

      return {
        txid: txHash,
        from: address,
        to,
        amount,
        fee
      };

    } catch (e) {
      throw new Error(e.message);
    }
  };

  // get list of pending transactions
  // TODO: pending for particular address only
  const getPending = async ({ walletPublicConfig }) => {
    const { networkConfig, address } = walletPublicConfig;
    const endpoint = httpEndpointFromConfig(networkConfig);

    const filterId = await ethereumQuery.query({ 
      method: 'eth_newPendingTransactionFilter', 
      endpoint
    });

    // const filterId = await ethereumQuery.query({ 
    //   method: 'eth_newFilter',
    //   params: [{ fromBlock: 'earliest', toBlock: 'latest' }],
    //   topics: [ address ],
    //   endpoint
    // }); 

    const changes = await ethereumQuery.query({ 
      method: 'eth_getFilterChanges', 
      params: [ filterId ],
      endpoint 
    });

    await ethereumQuery.query({ 
      method: 'eth_uninstallFilter', 
      params: [ filterId ], 
      endpoint 
    });

    return changes;
  };

  // get list of past transactions. could paging be better?
  const getHistory = async ({ address, networkConfig, start = 0, limit = 100 }) => {;
    const etherscan = getEtherscanClient(networkConfig);
    const result = await etherscan.getAccountHistory(address);

    if (result.length > 0) {
      const history = [];
      result.forEach(txData => {
        history.push({
          txid: txData.hash,
          timestamp: txData.timeStamp, 
          sender: { [txData.from]: fromWei(txData.value) }, 
          receiver: { [txData.to]: fromWei(txData.value) } 
        });
      });
      return history;
    }

    return [];
  };

  // get transaction details
  const getTransactionDetails = ({ walletPublicConfig, txHash }) => {
    return {};
  };

  const estimateFee = async ({ networkConfig }) => {
    const endpoint = httpEndpointFromConfig(networkConfig);
    const gasPrice = await ethereumQuery.query({
      method: 'eth_gasPrice', params: [], endpoint
    });
    // to gwei:
    const fee = (new BigNumber(gasPrice).dividedBy(new BigNumber(Math.pow(10, 9)))).toNumber();
    return { 
      fee: fee,
      min: fee - fee * 0.9, // -90%
      max: fee + fee * 0.9, // +90%
      step: 1,
      units: 'gwei' 
    };
  };

  return {
    create,            // generate keypair for HD wallet
    addressFromPrivateKey, // getting address from private key and network config (optional)
    createRandom,      // generate random keypair
    isValidAddress,    // to be used on wallet addition
    isValidPrivateKey, // to be used on wallet import
    //encryptPrivateKey,
    //decryptPrivateKey,
    getBalance,        // quick getter what is in the wallet
    getAssetsList,     // full retrieval of assets list
    getAssetValue,     // getting asset value (from contract name)
    sendTransaction,
    getPending,
    getHistory,
    getTransactionDetails,
    fromWei,
    toWei,
    toWeiHex,
    estimateFee
  };

};
