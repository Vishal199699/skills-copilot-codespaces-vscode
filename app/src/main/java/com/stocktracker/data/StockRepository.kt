package com.stocktracker.data

class StockRepository(
    private val api: StockApiService = RetrofitClient.stockApiService
) {

    companion object {
        val DEFAULT_SYMBOLS = listOf(
            "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA",
            "META", "NVDA", "BRK-B", "JPM", "V",
            "JNJ", "WMT", "PG", "MA", "HD"
        )
    }

    /**
     * Fetches quotes for the given list of symbols.
     * Returns [Result.Success] with a list of [Stock] objects,
     * or [Result.Error] if the request fails.
     */
    suspend fun getStocks(symbols: List<String>): Result<List<Stock>> {
        return try {
            val response = api.getQuotes(symbols.joinToString(","))
            val items = response.quoteResponse.result
            if (items != null) {
                Result.Success(items.map { it.toStock() })
            } else {
                Result.Error("No data returned for the requested symbols.")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Unknown error", e)
        }
    }
}
