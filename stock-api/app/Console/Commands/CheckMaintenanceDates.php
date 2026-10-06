<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckMaintenanceDates extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'maintenance:check-dates';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Verifie les dates de maintenance des produits et génère des alertes sur le dashboard Admin';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("Début de la vérification des dates de maintenance...");
        Log::info("Tâche planifiée Laravel : Début de la vérification des dates de maintenance.");

        // Dans une application de production réelle, nous interrogerions la base de données :
        // $productsDue = Product::where('status', '!=', 'En maintenance')
        //                       ->whereDate('next_maintenance_date', '<=', now()->addDays(3))
        //                       ->get();
        
        // Simulation pour la démonstration / Journalisation
        $simulatedProducts = [
            [
                'name' => 'Climatiseur Samsung',
                'next_date' => '2026-07-28',
                'status' => 'En service',
                'note' => 'Entretien filtre périodique requis.'
            ],
            [
                'name' => 'Imprimante Canon DPI',
                'next_date' => '2026-08-12',
                'status' => 'À remplacer',
                'note' => 'Révision de tête critique.'
            ]
        ];

        $today = now();
        $alertCount = 0;

        foreach ($simulatedProducts as $item) {
            $dueDate = \Carbon\Carbon::parse($item['next_date']);
            $daysRemaining = $today->diffInDays($dueDate, false);

            if ($daysRemaining <= 10) {
                // Alerte générée
                $message = sprintf(
                    "ALERTE MAINTENANCE - Le produit '%s' (Statut: %s) arrive à terme dans %d jours (%s). Note: %s",
                    $item['name'],
                    $item['status'],
                    $daysRemaining,
                    $item['next_date'],
                    $item['note']
                );

                $this->warn($message);
                Log::warning("Laravel Scheduler Alert: " . $message);
                $alertCount++;
            }
        }

        $this->info("Vérification terminée. {$alertCount} alertes générées.");
        Log::info("Tâche planifiée Laravel : Vérification terminée. {$alertCount} alertes générées.");

        return Command::SUCCESS;
    }
}
