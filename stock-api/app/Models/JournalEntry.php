<?php

namespace App\Models;

class JournalEntry extends TenantModel
{
    protected $table = 'journal_entries';

    protected $casts = ['date' => 'datetime', 'lines' => 'array'];
}
