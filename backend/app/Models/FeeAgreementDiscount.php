<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class FeeAgreementDiscount extends Model
{
    protected $fillable = [
        'school_id',
        'fee_agreement_id',
        'discount_label',
        'discount_type',
        'scope',
        'value',
        'remark',
        'created_by',
    ];

    public function feeAgreement(): BelongsTo
    {
        return $this->belongsTo(FeeAgreement::class);
    }

    public function selectedItems(): BelongsToMany
    {
        return $this->belongsToMany(
            FeeAgreementItem::class,
            'fee_agreement_discount_items',
            'fee_agreement_discount_id',
            'fee_agreement_item_id',
        )->withTimestamps();
    }
}
