const config = require("./config.js")
const { LCDClient, MnemonicKey, MsgSend, isTxError, Coin } = require("@terra-money/terra.js")
const { consoleError, _fetchStatusFromLogs, _fetchTrasactionData, _fetchFeeFromTx, _toCrypto, _toDecimal } = require("./utils.js")

const validWallet = /terra1[a-z0-9]{38}/g
const _ = require("lodash")

const _getNetworkDetails = (network) => (network === "main" ? config.networks.main : config.networks.testnet)

const getTerra = (network) =>
    new LCDClient({
        URL: _getNetworkDetails(network).provider,
        chainID: _getNetworkDetails(network).networkName,
        gasAdjustment: 1.5,
    })

const getTransactionLink = (txId, network) => _getNetworkDetails(network).transactionLink(txId)

const getWalletLink = (txId, network) => _getNetworkDetails(network).walletLink(txId)

const _getBalance = (address, network) => getTerra(network).bank.balance(address)

const getBalance = async (address, network, denom = "uluna") => {
    try {
        const balances = await _getBalance(address, network)
        return Number(_toDecimal(balances[0]._coins[denom].amount.toString(), 6))
    } catch (err) {
        consoleError({
            message: `some error occured fetching balance for address ${address} on network ${network} for original error look into extra field`,
            err,
        })
        return false
    }
}

// returns Boolean
const isValidWalletAddress = (address) => validWallet.test(address)

// return number 
const getNonce = async ({network, mnemonic}) => {
    return await getTerra(network).wallet(new MnemonicKey({mnemonic})).sequence()
}
 
// return Object
const sendTransaction = async ({ to, amount, network, mnemonic, nonce, denom = "uluna" }) => {
    try {
        //Get Provider
        const terra = getTerra(network)

        // format amount in base currecy (eg. uluna for LUNA) format
        const amoutnInCrypto = _toCrypto(amount, 6).toString()

        // get wallet for signing
        const mk = new MnemonicKey({
            mnemonic,
        })
        const wallet = terra.wallet(mk)

        // crypto transfer message
        const send = new MsgSend(wallet.key.accAddress, to, {
            [denom]: amoutnInCrypto,
        })
        // sign transaction
        const transaction = await wallet.createAndSignTx({
            msgs: [send],
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

const getTransaction = async (txId, network) => {
    try {
        const txInfo = await getTerra(network).tx.txInfo(txId)
        const status = _fetchStatusFromLogs(txInfo.logs)
        const { to, from, value, denom, fee, nonce } = _fetchTrasactionData(txInfo.tx)
        const gasPrice = Number((Number(_toCrypto(fee, 6).toString()) / txInfo.gas_wanted).toFixed(6))
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
                gasCostInCrypto: Number(fee),
                gasCostCryptoCurrency: "LUNA",
                amount: Number(value),
                from,
                to,
                nonce,
                status,
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
    getNonce
}
