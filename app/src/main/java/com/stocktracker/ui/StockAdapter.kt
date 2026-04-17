package com.stocktracker.ui

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.stocktracker.R
import com.stocktracker.data.Stock
import com.stocktracker.databinding.ItemStockBinding
import java.util.Locale
import kotlin.math.abs

class StockAdapter(
    private val onRemoveClick: (Stock) -> Unit
) : ListAdapter<Stock, StockAdapter.StockViewHolder>(DIFF_CALLBACK) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StockViewHolder {
        val binding = ItemStockBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return StockViewHolder(binding)
    }

    override fun onBindViewHolder(holder: StockViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class StockViewHolder(
        private val binding: ItemStockBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(stock: Stock) {
            binding.apply {
                tvSymbol.text    = stock.symbol
                tvName.text      = stock.shortName
                tvPrice.text     = String.format(Locale.US, "$%.2f", stock.regularMarketPrice)

                val change        = stock.regularMarketChange
                val changePercent = stock.regularMarketChangePercent
                val changeText    = String.format(
                    Locale.US, "%+.2f (%+.2f%%)", change, changePercent
                )
                tvChange.text = changeText

                val color = when {
                    change > 0  -> Color.parseColor("#2E7D32") // dark green
                    change < 0  -> Color.parseColor("#C62828") // dark red
                    else        -> Color.parseColor("#757575") // grey
                }
                tvChange.setTextColor(color)
                tvPrice.setTextColor(color)

                // Extra detail row
                tvDayRange.text = String.format(
                    Locale.US,
                    "L: $%.2f  H: $%.2f  Vol: %,d",
                    stock.regularMarketDayLow,
                    stock.regularMarketDayHigh,
                    stock.regularMarketVolume
                )

                btnRemove.setOnClickListener { onRemoveClick(stock) }
            }
        }
    }

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<Stock>() {
            override fun areItemsTheSame(oldItem: Stock, newItem: Stock) =
                oldItem.symbol == newItem.symbol

            override fun areContentsTheSame(oldItem: Stock, newItem: Stock) =
                oldItem == newItem
        }
    }
}
