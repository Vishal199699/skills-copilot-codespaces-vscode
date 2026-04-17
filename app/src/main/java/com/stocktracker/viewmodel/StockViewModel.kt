package com.stocktracker.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.stocktracker.data.Result
import com.stocktracker.data.Stock
import com.stocktracker.data.StockRepository
import kotlinx.coroutines.launch

class StockViewModel(
    private val repository: StockRepository = StockRepository()
) : ViewModel() {

    private val _uiState = MutableLiveData<StockUiState>(StockUiState.Loading)
    val uiState: LiveData<StockUiState> = _uiState

    /** The full list of stocks currently loaded (before search filter). */
    private var allStocks: List<Stock> = emptyList()

    /** The symbols currently being tracked. */
    private var watchlistSymbols: List<String> = StockRepository.DEFAULT_SYMBOLS

    init {
        fetchStocks()
    }

    /** Refresh quotes for the current watchlist. */
    fun fetchStocks() {
        _uiState.value = StockUiState.Loading
        viewModelScope.launch {
            when (val result = repository.getStocks(watchlistSymbols)) {
                is Result.Success -> {
                    allStocks = result.data
                    _uiState.value = StockUiState.Success(allStocks)
                }
                is Result.Error -> {
                    _uiState.value = StockUiState.Error(result.message)
                }
                is Result.Loading -> { /* no-op */ }
            }
        }
    }

    /** Filter the displayed list by the given query (matches symbol or company name). */
    fun search(query: String) {
        if (query.isBlank()) {
            _uiState.value = StockUiState.Success(allStocks)
            return
        }
        val lower = query.trim().lowercase()
        val filtered = allStocks.filter { stock ->
            stock.symbol.lowercase().contains(lower) ||
                    stock.shortName.lowercase().contains(lower)
        }
        _uiState.value = StockUiState.Success(filtered)
    }

    /** Add a symbol to the watchlist and refresh. */
    fun addSymbol(symbol: String) {
        val upper = symbol.uppercase().trim()
        if (upper.isNotEmpty() && upper !in watchlistSymbols) {
            watchlistSymbols = watchlistSymbols + upper
            fetchStocks()
        }
    }

    /** Remove a symbol from the watchlist and refresh display. */
    fun removeSymbol(symbol: String) {
        watchlistSymbols = watchlistSymbols.filter { it != symbol }
        allStocks = allStocks.filter { it.symbol != symbol }
        _uiState.value = StockUiState.Success(allStocks)
    }
}

/** UI state sealed class. */
sealed class StockUiState {
    object Loading : StockUiState()
    data class Success(val stocks: List<Stock>) : StockUiState()
    data class Error(val message: String) : StockUiState()
}
