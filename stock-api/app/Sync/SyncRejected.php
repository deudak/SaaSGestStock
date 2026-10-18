<?php

namespace App\Sync;

use RuntimeException;

/** Opération de synchronisation refusée (droits, données invalides) : renvoyée au front dans « rejected ». */
class SyncRejected extends RuntimeException
{
}
