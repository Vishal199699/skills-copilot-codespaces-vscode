package com.stocktracker.data

data class Stock(
    val symbol: String,
    val shortName: String,
    val regularMarketPrice: Double,
    val regularMarketChange: Double,
    val regularMarketChangePercent: Double,
    val regularMarketPreviousClose: Double,
    val regularMarketOpen: Double,
    val regularMarketDayHigh: Double,
    val regularMarketDayLow: Double,
    val regularMarketVolume: Long
)
