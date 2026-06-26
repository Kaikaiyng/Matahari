<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    protected $fillable = [
        'school_id',
        'invoice_id',
        'item_type',
        'source_type',
        'source_id',
        'description',
        'quantity',
        'unit_amount',
        'line_total',
        'sort_order',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
