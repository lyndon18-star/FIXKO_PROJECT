<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('tickets') && ! Schema::hasTable('reports')) {
            Schema::rename('tickets', 'reports');
        }

        $this->renameForeignKeyColumn('reports', 'assigned_to', 'handled_by', false, 'users', 'SET NULL');
        $this->renameForeignKeyColumn('comments', 'ticket_id', 'report_id', true, 'reports', 'CASCADE');
        $this->renameForeignKeyColumn('ticket_status_histories', 'ticket_id', 'report_id', true, 'reports', 'CASCADE');
        $this->renameForeignKeyColumn('feedback', 'ticket_id', 'report_id', true, 'reports', 'CASCADE');
        $this->renameForeignKeyColumn('repair_logs', 'ticket_id', 'report_id', false, 'reports', 'SET NULL');
        $this->renameForeignKeyColumn('notifications', 'related_ticket_id', 'related_report_id', false, 'reports', 'SET NULL');

        if (Schema::hasTable('repair_logs') && ! Schema::hasTable('repair_history')) {
            Schema::rename('repair_logs', 'repair_history');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('repair_history') && ! Schema::hasTable('repair_logs')) {
            Schema::rename('repair_history', 'repair_logs');
        }

        $this->renameForeignKeyColumn('notifications', 'related_report_id', 'related_ticket_id', false, 'reports', 'SET NULL');
        $this->renameForeignKeyColumn('repair_logs', 'report_id', 'ticket_id', false, 'reports', 'SET NULL');
        $this->renameForeignKeyColumn('feedback', 'report_id', 'ticket_id', true, 'reports', 'CASCADE');
        $this->renameForeignKeyColumn('ticket_status_histories', 'report_id', 'ticket_id', true, 'reports', 'CASCADE');
        $this->renameForeignKeyColumn('comments', 'report_id', 'ticket_id', true, 'reports', 'CASCADE');
        $this->renameForeignKeyColumn('reports', 'handled_by', 'assigned_to', false, 'users', 'SET NULL');

        if (Schema::hasTable('reports') && ! Schema::hasTable('tickets')) {
            Schema::rename('reports', 'tickets');
        }
    }

    private function renameForeignKeyColumn(
        string $table,
        string $from,
        string $to,
        bool $notNull,
        string $referencedTable,
        string $onDelete
    ): void
    {
        if (Schema::hasTable($table) && Schema::hasColumn($table, $from) && ! Schema::hasColumn($table, $to)) {
            $database = DB::getDatabaseName();
            $constraints = DB::select(
                'SELECT DISTINCT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
                 WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
                 AND REFERENCED_TABLE_NAME IS NOT NULL',
                [$database, $table, $from]
            );
            foreach ($constraints as $constraint) {
                DB::statement(sprintf(
                    'ALTER TABLE `%s` DROP FOREIGN KEY `%s`',
                    str_replace('`', '``', $table),
                    str_replace('`', '``', $constraint->CONSTRAINT_NAME)
                ));
            }

            $nullability = $notNull ? 'NOT NULL' : 'NULL';
            DB::statement(sprintf(
                'ALTER TABLE `%s` CHANGE `%s` `%s` BIGINT UNSIGNED %s',
                str_replace('`', '``', $table),
                str_replace('`', '``', $from),
                str_replace('`', '``', $to),
                $nullability
            ));

            $constraintName = "{$table}_{$to}_foreign";
            DB::statement(sprintf(
                'ALTER TABLE `%s` ADD CONSTRAINT `%s` FOREIGN KEY (`%s`) REFERENCES `%s` (`id`) ON DELETE %s',
                str_replace('`', '``', $table),
                str_replace('`', '``', $constraintName),
                str_replace('`', '``', $to),
                str_replace('`', '``', $referencedTable),
                $onDelete
            ));
        }
    }
};
