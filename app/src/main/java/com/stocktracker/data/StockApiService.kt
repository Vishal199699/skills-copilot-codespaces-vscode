package com.stocktracker.data

import retrofit2.http.GET
import retrofit2.http.Query

interface StockApiService {

    /**
     * Fetch real-time quotes for a comma-separated list of symbols.
     * Example URL:
     *   https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL,MSFT&lang=en-US&region=US
     */
    @GET("v7/finance/quote")
    suspend fun getQuotes(
        @Query("symbols") symbols: String,
        @Query("lang")    lang: String   = "en-US",
        @Query("region")  region: String = "US"
    ): QuoteResponse
}
