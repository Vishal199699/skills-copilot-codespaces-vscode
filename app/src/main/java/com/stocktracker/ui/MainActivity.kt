package com.stocktracker.ui

import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SearchView
import androidx.recyclerview.widget.LinearLayoutManager
import com.stocktracker.R
import com.stocktracker.databinding.ActivityMainBinding
import com.stocktracker.viewmodel.StockUiState
import com.stocktracker.viewmodel.StockViewModel

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: StockViewModel by viewModels()
    private lateinit var adapter: StockAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        setupRecyclerView()
        observeViewModel()
        setupSwipeRefresh()
    }

    private fun setupRecyclerView() {
        adapter = StockAdapter { stock ->
            viewModel.removeSymbol(stock.symbol)
        }
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = this@MainActivity.adapter
        }
    }

    private fun observeViewModel() {
        viewModel.uiState.observe(this) { state ->
            binding.swipeRefresh.isRefreshing = false
            when (state) {
                is StockUiState.Loading -> {
                    binding.swipeRefresh.isRefreshing = true
                    binding.tvError.visibility = View.GONE
                }
                is StockUiState.Success -> {
                    binding.tvError.visibility = View.GONE
                    adapter.submitList(state.stocks)
                    binding.tvEmpty.visibility =
                        if (state.stocks.isEmpty()) View.VISIBLE else View.GONE
                }
                is StockUiState.Error -> {
                    binding.tvError.text = state.message
                    binding.tvError.visibility = View.VISIBLE
                    Toast.makeText(this, "Error: ${state.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.fetchStocks()
        }
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.menu_main, menu)

        val searchItem  = menu.findItem(R.id.action_search)
        val searchView  = searchItem?.actionView as? SearchView
        searchView?.queryHint = getString(R.string.search_hint)
        searchView?.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?) = false
            override fun onQueryTextChange(newText: String?): Boolean {
                viewModel.search(newText.orEmpty())
                return true
            }
        })
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_add -> {
                showAddSymbolDialog()
                true
            }
            R.id.action_refresh -> {
                viewModel.fetchStocks()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun showAddSymbolDialog() {
        val input = android.widget.EditText(this).apply {
            hint = getString(R.string.add_symbol_hint)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                        android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            setPadding(48, 24, 48, 24)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.add_symbol_title)
            .setView(input)
            .setPositiveButton(android.R.string.ok) { _, _ ->
                val symbol = input.text.toString().trim()
                if (symbol.isNotEmpty()) viewModel.addSymbol(symbol)
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }
}
