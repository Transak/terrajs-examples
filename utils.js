
const ethers = require("ethers")
const _ = require("lodash")
const fetch = require("isomorphic-fetch")
const config = require("./config")

const consoleError = ({ message, err, tags }) => {
    const error = new Error(message)
    error.extra = err.response ? err.response.data : err
    error.tags = {
        area: "crypto_coverage",
        blockchain: "terra",
        ...(tags || {}),
    }
    console.error(error)
}

// return Coins
const getGasPrice = async (network) => {
    let gasPrices
    try {
        gasPrices = await (await fetch(_getNetworkDetails(network).gasStation)).json()
    } catch (err) {
        consoleError({
            message: `pricing API ${_getNetworkDetails(network).gasStation} for ${network} is failing see extra for error`,
            err,
        })
        gasPrices = { uluna: "0.15" }
    }
    return Number(gasPrices.uluna)
}

const _getNetworkDetails = (network) => (network === "main" ? config.networks.main : config.networks.testnet)

// returns Number
const _toDecimal = (amount, decimals) => ethers.utils.formatUnits(amount, decimals)
// returns ethers.BigNumber
const _toCrypto = (amount, decimals) => (typeof amount === "string" ? ethers.utils.parseUnits(amount, decimals) : ethers.utils.parseUnits(amount.toString(), decimals))

// return Number
const _fetchFeeFromTx = (tx) => _toDecimal(`${_.get(tx, "auth_info.fee.amount._coins.uluna.amount", 0)}`, 6)

//return object { to, from, value(inCrypto),denom , fee, nonce }
const _fetchTrasactionData = (tx) => {
    const { to_address, from_address, amount } = tx.body.messages[0]
    const fee = _fetchFeeFromTx(tx)
    const nonce = _.get(tx, "auth_info.signer_infos")[0].sequence
    let value, denom
    for (const coin in amount._coins) {
        denom = coin
        value = _toDecimal(`${amount._coins[coin].amount}`, 6)
    }
    return {
        to: to_address,
        from: from_address,
        value,
        denom,
        fee,
        nonce,
    }
}
// fetch status from trasnactionLogs
const _fetchStatusFromLogs = (txLogs) => {
    if (txLogs.length === 0) return false
    const transferLog = _.get(txLogs[0].eventsByType, "transfer", null)
    if (!transferLog) return false
    const transferKeys = ["recipient", "sender", "amount"]
    return transferKeys.every((key) => transferLog.hasOwnProperty(key) && transferLog[key].length === 1)
}

module.exports = {
    consoleError,
    getGasPrice,
    _getNetworkDetails,
    _fetchStatusFromLogs,
    _fetchTrasactionData,
    _fetchFeeFromTx,
    _toCrypto,
    _toDecimal,
}
