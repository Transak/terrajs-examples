module.exports = {
    networks: {
        main: {
            provider: "https://lcd.terra.dev",
            gasStation: "https://fcd.terra.dev/v1/txs/gas_prices",
            transactionLink: (hash) => `https://finder.terra.money/columbus-5/tx/${hash}`,
            walletLink: (address) => `https://finder.terra.money/columbus-5/address/${address}`,
            networkName: "columbus-5",
        },
        testnet: {
            provider: "https://bombay-lcd.terra.dev",
            gasStation: "https://bombay-fcd.terra.dev/v1/txs/gas_prices",
            transactionLink: (hash) => `https://finder.terra.money/bombay-12/tx/${hash}`,
            walletLink: (address) => `https://finder.terra.money/bombay-12/address/${address}`,
            networkName: "bombay-12",
        },
    },
}
