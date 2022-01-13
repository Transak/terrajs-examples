const terraMainLib = require("../index")
const { expect, assert } = require("chai")
const bson = require("bson")
const ethers = require("ethers")
const _ = require("lodash")
const { getGasPrice } = require("../utils")
require("dotenv").config({ path: `${__dirname}/.env` })
/*
invalid chain id
*/
// variables
const mainTimeout = 14000
const testData = {
    toWalletAddress: process.env.TOWALLETADDRESS,
    memo: process.env.MEMO,
    network: process.env.NETWORK,
    mnemonic: process.env.MNEMONIC,
    crypto: "uluna",
    decimals: 6,
    amount: 0.00005,
    CW20TokenAddress: "terra1747mad58h0w4y589y3sk84r5efqdev9q4r02pc", //ANC testnet
    CW20Decimals: 6,
}

if (!testData.mnemonic) throw new Error("Invalid menomics!")

const runtime = {}

const keys = {
    sendTransaction: [
        { name: "amount" },
        { name: "date" },
        { name: "from" },
        { name: "gasCostCryptoCurrency" },
        { name: "gasCostInCrypto" },
        { name: "gasLimit" },
        { name: "gasUsed" },
        { name: "gasPrice" },
        { name: "network" },
        { name: "nonce" },
        { name: "to" },
        { name: "transactionHash" },
        { name: "transactionLink" },
    ],
    getTransaction: [
        { name: "amount" },
        { name: "date" },
        { name: "from" },
        { name: "gasCostCryptoCurrency" },
        { name: "gasCostInCrypto" },
        { name: "gasLimit" },
        { name: "gasUsed" },
        { name: "gasPrice" },
        { name: "network" },
        { name: "nonce" },
        { name: "to" },
        { name: "transactionHash" },
        { name: "transactionLink" },
        { name: "status" },
        { name: "isSuccessful" },
    ],
}
const keyTypeObj = {
    amount: "number",
    date: "object",
    from: "string",
    gasCostCryptoCurrency: "string",
    gasCostInCrypto: "number",
    gasLimit: "number",
    gasUsed: "number",
    gasPrice: "number",
    network: "string",
    nonce: "number",
    to: "string",
    transactionHash: "string",
    transactionLink: "string",
    status: "boolean",
    isSuccessful: "boolean",
}

const validateTypesAndKeys = (objectToCheck, keysObject) => {
    keyNames = keysObject.map((valObj) => valObj.name)
    assert.hasAllKeys(objectToCheck, keyNames)
    const errors = {}
    for (k in objectToCheck) {
        type = keyTypeObj[k]
        if (type === "number" && !checkForNumber(objectToCheck[k])) errors[k] = `expected ${type} or Number got ${typeof objectToCheck[k]}`
        if (type !== typeof objectToCheck[k]) errors[k] = `expected ${type} got ${typeof objectToCheck[k]}`
    }
    return errors
}

const checkForNumber = (valueObj) => {
    return _.isNumber(valueObj) && !_.isNaN(valueObj)
}

const isBSONserializable = (res) => {
    try {
        bson.serialize(res)
        return { status: true }
    } catch (err) {
        return { status: false, errorMessage: err }
    }
}

describe("terra-mainet module", () => {
    it("should getBalance", async function () {
        this.timeout(mainTimeout * 3)
        const resultCW20 = await terraMainLib.getBalance(testData.toWalletAddress, testData.network, "", testData.CW20TokenAddress, testData.decimals)
        assert(typeof resultCW20 === "number", "balance should be of type number")
        const result = await terraMainLib.getBalance(testData.toWalletAddress, testData.network, "uusd")
        assert(typeof result === "number", "balance should be of type number")
    })

    it("should isValidWalletAddress", async function () {
        this.timeout(mainTimeout * 3)
        const result = await terraMainLib.isValidWalletAddress(testData.toWalletAddress, testData.network)
        expect(result === true)
    })
    it.skip("should getNonce", async function () {
        this.timeout(mainTimeout * 3)
        const { mnemonic, network } = testData
        const nonce = await terraMainLib.getNonce({ network, mnemonic })
        assert(checkForNumber(nonce), "nonce should be a number type")
    })

    it.skip("should getGasPrice", async function () {
        this.timeout(mainTimeout * 3)
        const { mnemonic, network, crypto, amount, decimals } = testData
        const gasPrice = await terraMainLib.getGasPrice({ network })
        assert(checkForNumber(gasPrice), "gasPrice should be a number type")
        runtime.gasPrice = gasPrice
    })

    it.skip("should sendTransaction", async function () {
        this.timeout(mainTimeout * 3)
        const { toWalletAddress: to, mnemonic, network, amount } = testData
        const gasPrice = runtime.gasPrice
        const result = await terraMainLib.sendTransaction({
            to,
            memo: testData.memo,
            amount,
            network,
            mnemonic,
            gasPrice,
            denom: testData.crypto,
        })
        const { status, errorMessage } = isBSONserializable(result)
        assert(status, "response of sendTransaction should be BSON serializable : error : " + (errorMessage || ""))
        let validation_errors = validateTypesAndKeys(result.receipt, keys.sendTransaction)
        assert(_.isEmpty(validation_errors), "Error validation keys and types \n" + JSON.stringify(validation_errors))
        runtime.transactionHash = result.receipt.transactionHash
    })

    it.skip("should getTransaction", async function () {
        this.timeout(mainTimeout * 3)
        const { network } = testData
        const result = await terraMainLib.getTransaction(runtime.transactionHash, network)
        const { status, errorMessage } = isBSONserializable(result)
        assert(status, "response of getTransaction should be BSON serializable : error : " + (errorMessage || ""))
        let validation_errors = validateTypesAndKeys(result.receipt, keys.getTransaction)
        assert(_.isEmpty(validation_errors), "Error validation keys and types \n" + JSON.stringify(validation_errors))
    })

    it.skip("should sendTransaction CW20", async function () {
        this.timeout(mainTimeout * 3)
        const { toWalletAddress: to, mnemonic, network, amount, CW20TokenAddress, CW20Decimals } = testData
        const gasPrice = runtime.gasPrice
        const result = await terraMainLib.sendTransaction({
            to,
            amount,
            network,
            mnemonic,
            gasPrice,
            contractAddress: CW20TokenAddress,
            decimals: CW20Decimals,
        })
        const { status, errorMessage } = isBSONserializable(result)
        assert(status, "response of sendTransaction should be BSON serializable : error : " + (errorMessage || ""))
        let validation_errors = validateTypesAndKeys(result.receipt, keys.sendTransaction)
        assert(_.isEmpty(validation_errors), "Error validation keys and types \n" + JSON.stringify(validation_errors))
        runtime.transactionHash = result.receipt.transactionHash
    })
})
