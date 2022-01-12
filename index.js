const { LCDClient, MnemonicKey, MsgSend, isTxError, Coin, MsgExecuteContract } = require("@terra-money/terra.js")
const { consoleError, getGasPrice, _fetchStatusFromLogs, _fetchTrasactionData, _fetchFeeFromTx, _toCrypto, _toDecimal, _getNetworkDetails } = require("./utils.js")

const validWallet = /terra1[a-z0-9]{38}/g
const _ = require("lodash")

const getTerra = (network) => {
    return new LCDClient({
        URL: _getNetworkDetails(network).provider,
        chainID: _getNetworkDetails(network).networkName,
        gasAdjustment: 1.5,
        gas: 10000000,
    })
}

const getTransactionLink = (txId, network) => _getNetworkDetails(network).transactionLink(txId)

const getWalletLink = (walletAddress, network) => _getNetworkDetails(network).walletLink(walletAddress)

const _getBalance = (address, network) => getTerra(network).bank.balance(address)
const _getCW20Balance = ({ walletAddress, contractAddress, network }) => {
    return getTerra(network).wasm.contractQuery(contractAddress, { balance: { address: walletAddress } })
    // return fetch(`${_getNetworkDetails(network).provider}/wasm/contract/${contractAddress}/store?query_msg={"balance":{"address":"${walletAddress}"}}`)
}
const getBalance = async (address, network, denom, contractAddress = null, decimals = 6) => {
    try {
        let balanceInDec
        if (!contractAddress) {
            const balances = await _getBalance(address, network)
            console.log(balances)
            const balance = _.get(balances[0]._coins, denom, {}).amount || 0
            balanceInDec = Number(_toDecimal(balance.toString(), decimals))
        } else {
            const balance = (await _getCW20Balance({ walletAddress: address, contractAddress, network })).balance
            balanceInDec = balance ? Number(_toDecimal(balance, decimals)) : 0
        }
        return balanceInDec
    } catch (err) {
        consoleError({
            message: `some error occured fetching balance for address ${address} on network ${network} for original error look into extra field`,
            err,
        })
        return false
    }
}

// returns Boolean
const isValidWalletAddress = (address) => new RegExp(validWallet).test(address)

// return number
const getNonce = async ({ network, mnemonic }) => {
    return await getTerra(network).wallet(new MnemonicKey({ mnemonic })).sequence()
}

// return Object
const sendTransaction = async ({ to, amount, network, mnemonic, nonce, denom, gasPrice, contractAddress, decimals = 6 }) => {
    try {
        //Get Provider
        const terra = getTerra(network)

        // format amount in base currecy (eg. uluna for LUNA) format
        const amoutnInCrypto = _toCrypto(amount, decimals).toString()

        // get wallet for signing
        const mk = new MnemonicKey({
            mnemonic,
        })
        const wallet = terra.wallet(mk)

        // crypto transfer message

        const send = !contractAddress
            ? new MsgSend(wallet.key.accAddress, to, {
                  [denom]: amoutnInCrypto,
              })
            : new MsgExecuteContract(
                  wallet.key.accAddress,
                  contractAddress, // CW20 token address.
                  {
                      transfer: {
                          amount: amoutnInCrypto,
                          recipient: wallet.key.accAddress,
                      },
                  }
              )

        // sign transaction
        const transaction = await wallet.createAndSignTx({
            msgs: [send],
            gasPrices: [new Coin("uluna", gasPrice || "0.15")],
            ...(nonce ? { nonce } : {}),
        })
        const sendRes = await terra.tx.broadcast(transaction)
        if (isTxError(sendRes)) {
            throw new Error(`encountered an error while running the transaction: ${sendRes.code} ${sendRes.codespace}`)
        }
        return {
            transactionData: sendRes,
            receipt: {
                date: new Date(),
                transactionHash: sendRes.txhash,
                transactionLink: _getNetworkDetails(network).transactionLink(sendRes.txhash),
                network: _getNetworkDetails(network).networkName,
                gasPrice: Number((Number(_.get(transaction, "auth_info.fee.amount._coins.uluna.amount", 0)) / sendRes.gas_wanted).toFixed(6)),
                gasLimit: sendRes.gas_wanted,
                gasUsed: sendRes.gas_wanted,
                gasCostInCrypto: Number(_fetchFeeFromTx(transaction)),
                gasCostCryptoCurrency: "LUNA",
                amount: amount,
                from: wallet.key.accAddress,
                to: to,
                nonce: _.get(transaction, "auth_info.signer_infos")[0].sequence,
            },
        }
    } catch (err) {
        consoleError({
            message: `some error occured sending transaction to ${to} of amount ${amount} for original error look into extra field`,
            err,
        })
        throw err
    }
}

const getTransaction = async (txId, network, decimals = 6) => {
    try {
        const txInfo = await getTerra(network).tx.txInfo(txId)
        const status = txInfo.code === 0
        const isSuccessful = txInfo.code === 0
        const { to, from, value, denom, fee, nonce } = _fetchTrasactionData(txInfo.tx)
        const gasPrice = Number((Number(_toCrypto(fee, decimals).toString()) / txInfo.gas_wanted).toFixed(decimals))
        response = {
            transactionData: txInfo,
            date: new Date(),
            transactionHash: txInfo.txhash,
            transactionLink: getTransactionLink(txInfo.txhash, network),
            network: _getNetworkDetails(network).networkName,
            gasPrice,
            amount: value,
            from,
            to,
            nonce,
            gasLimit: txInfo.gas_wanted,
            feeCurrency: "LUNA",
            receipt: {
                date: new Date(),
                transactionHash: txInfo.txhash,
                transactionLink: getTransactionLink(txInfo.txhash, network),
                network: _getNetworkDetails(network).networkName,
                gasPrice,
                gasLimit: txInfo.gas_wanted,
                gasUsed: txInfo.gas_wanted, // unsused gas is not refunded in terra .
                gasCostInCrypto: Number(fee),
                gasCostCryptoCurrency: "LUNA",
                amount: Number(value),
                from,
                to,
                nonce,
                status,
                isSuccessful,
                ...(status ? {} : { error: txInfo.raw_log }),
            },
        }
        return response
    } catch (err) {
        consoleError({
            message: `Error encountered fetching transaction with hash ${txId} on ${network} for original error look into extra field`,
            err,
        })
        return false
    }
}

module.exports = {
    getTransactionLink,
    getWalletLink,
    getTransaction,
    isValidWalletAddress,
    sendTransaction,
    getBalance,
    getNonce,
    getGasPrice,
}
