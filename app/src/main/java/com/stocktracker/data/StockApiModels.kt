package com.stocktracker.data

import com.google.gson.annotations.SerializedName

// ── Response wrapper ────────────────────────────────────────────────────────

data class QuoteResponse(
    @SerializedName("quoteResponse") val quoteResponse: QuoteResult
)

data class QuoteResult(
    @SerializedName("result") val result: List<QuoteItem>?,
    @SerializedName("error")  val error: Any?
)

data class QuoteItem(
    @SerializedName("symbol")                      val symbol: String,
    @SerializedName("shortName")                   val shortName: String?,
    @SerializedName("longName")                    val longName: String?,
    @SerializedName("regularMarketPrice")          val regularMarketPrice: Double?,
    @SerializedName("regularMarketChange")         val regularMarketChange: Double?,
    @SerializedName("regularMarketChangePercent")  val regularMarketChangePercent: Double?,
    @SerializedName("regularMarketPreviousClose")  val regularMarketPreviousClose: Double?,
    @SerializedName("regularMarketOpen")           val regularMarketOpen: Double?,
    @SerializedName("regularMarketDayHigh")        val regularMarketDayHigh: Double?,
    @SerializedName("regularMarketDayLow")         val regularMarketDayLow: Double?,
    @SerializedName("regularMarketVolume")         val regularMarketVolume: Long?
) {
    fun toStock(): Stock = Stock(
        symbol                    = symbol,
        shortName                 = shortName ?: longName ?: symbol,
        regularMarketPrice        = regularMarketPrice ?: 0.0,
        regularMarketChange       = regularMarketChange ?: 0.0,
        regularMarketChangePercent = regularMarketChangePercent ?: 0.0,
        regularMarketPreviousClose = regularMarketPreviousClose ?: 0.0,
        regularMarketOpen         = regularMarketOpen ?: 0.0,
        regularMarketDayHigh      = regularMarketDayHigh ?: 0.0,
        regularMarketDayLow       = regularMarketDayLow ?: 0.0,
        regularMarketVolume       = regularMarketVolume ?: 0L
    )
}
