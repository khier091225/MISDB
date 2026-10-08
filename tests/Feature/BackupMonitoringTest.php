<?php

namespace Tests\Feature;

use App\Services\BackupWorkbook;
use Tests\Fixtures\BackupWorkbookFixture;
use Tests\TestCase;

class BackupMonitoringTest extends TestCase
{
    /** @var list<string> */
    private array $files = [];

    protected function tearDown(): void
    {
        foreach ($this->files as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }
        parent::tearDown();
    }

    public function test_returns_excel_records_and_does_not_modify_the_source_workbook(): void
    {
        $path = BackupWorkbookFixture::create(['M5' => ['value' => '✓']]);
        $this->files[] = $path;
        $hash = hash_file('sha256', $path);
        $this->app->instance(BackupWorkbook::class, new BackupWorkbook($path));

        $response = $this->getJson(route('backup-monitoring.index'));

        $response->assertOk()
            ->assertJsonCount(2, 'records')
            ->assertJsonPath('records.0.months.2026-10.status', 'Completed')
            ->assertJsonPath('records.1.user', 'Current User')
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->assertSame($hash, hash_file('sha256', $path));
    }

    public function test_returns_503_with_a_helpful_message_when_the_workbook_is_missing(): void
    {
        $path = BackupWorkbookFixture::create();
        unlink($path);
        $this->app->instance(BackupWorkbook::class, new BackupWorkbook($path));

        $response = $this->getJson(route('backup-monitoring.index'));

        $response->assertStatus(503)
            ->assertJsonPath('message', 'The backup Excel file could not be read. Check that it is saved in the forms folder and uses year-named sheets with Computer code, User, and January–December headers.');
    }

    public function test_returns_503_when_the_source_is_not_a_valid_xlsx_file(): void
    {
        $path = BackupWorkbookFixture::create();
        $this->files[] = $path;
        file_put_contents($path, 'invalid workbook');
        $this->app->instance(BackupWorkbook::class, new BackupWorkbook($path));

        $this->getJson(route('backup-monitoring.index'))->assertStatus(503);
    }

    public function test_dashboard_supplies_the_named_excel_endpoint_to_the_frontend(): void
    {
        $this->get('/')->assertSee('data-backup-url="'.route('backup-monitoring.index').'"', false);
    }

    public function test_reads_the_configured_workbook_without_disclosing_its_absolute_path(): void
    {
        $path = BackupWorkbookFixture::create(['M5' => ['value' => 'Completed']]);
        $this->files[] = $path;
        config(['misdb.backup_workbook' => $path]);

        $response = $this->getJson(route('backup-monitoring.index'));

        $response->assertJsonPath('source.file', basename($path))
            ->assertJsonPath('records.0.months.2026-10.status', 'Completed');
        $this->assertSame(['source', 'years', 'default_period', 'records'], array_keys($response->json()));
        $this->assertStringNotContainsString($path, $response->getContent());
    }

    public function test_returns_503_when_the_workbook_path_is_not_configured(): void
    {
        config(['misdb.backup_workbook' => '']);

        $this->getJson(route('backup-monitoring.index'))
            ->assertStatus(503);
    }

    public function test_passes_the_configured_timezone_to_the_dashboard(): void
    {
        config(['misdb.timezone' => 'UTC']);

        $this->get('/')->assertSee('data-timezone="UTC"', false);
    }
}
