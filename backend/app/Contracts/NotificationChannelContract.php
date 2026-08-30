<?php

namespace App\Contracts;

use App\Services\Notifications\NotificationDispatchResult;
use App\Services\Notifications\NotificationMessage;
use App\Services\Notifications\NotificationTarget;

interface NotificationChannelContract
{
    public function key(): string;

    /** @param list<NotificationTarget> $targets */
    public function deliver(NotificationMessage $message, array $targets): NotificationDispatchResult;
}
