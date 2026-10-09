<?php

namespace Tests\Feature;

use App\Services\BackupWorkbook;
use PHPUnit\Framework\Attributes\TestWith;
use RuntimeException;
use Tests\Fixtures\BackupWorkbookFixture;
use Tests\TestCase;
use ZipArchive;

class BackupWorkbookTest extends TestCase
{
    use \Illuminate\Foundation\Testing\RefreshDatabase;

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

    public function test_reads_current_users_from_year_sheet_and_ignores_revision_template(): void
    {
        $path = $this->fixture();
        $this->travelTo(new \DateTimeImmutable('2026-10-07 12:00:00 Asia/Manila'));

        $result = (new BackupWorkbook($path))->read();

        $this->assertSame([2026], $result['years']);
        $this->assertSame('2026-10', $result['default_period']);
        $this->assertCount(2, $result['records']);
        $this->assertSame('SERVER', $result['records'][0]['code']);
        $this->assertSame('K. DIXON', $result['records'][0]['user']);
        $this->assertSame('Current User', $result['records'][1]['user']);
        $this->assertSame('2026', $result['records'][1]['sheet']);
    }

    public function test_blank_cells_are_not_recorded_and_original_entries_are_preserved(): void
    {
        $path = $this->fixture(['E5' => ['value' => 'Review this entry'], 'F5' => ['value' => 'wip'], 'G5' => ['value' => '0', 'type' => 'n']]);

        $months = (new BackupWorkbook($path))->read()['records'][0]['months'];

        $this->assertSame(['cell' => 'D5', 'value' => '', 'display' => '', 'status' => 'Not recorded'], $months['2026-01']);
        $this->assertSame('Recorded', $months['2026-02']['status']);
        $this->assertSame('Review this entry', $months['2026-02']['value']);
        $this->assertSame('Recorded', $months['2026-03']['status']);
        $this->assertSame('Recorded', $months['2026-04']['status']);
    }

    public function test_checkmarks_boolean_values_and_supported_text_have_correct_statuses(): void
    {
        $path = $this->fixture([
            'D5' => ['value' => '✓'], 'E5' => ['value' => '✔'], 'F5' => ['value' => 'Done'],
            'G5' => ['value' => '1', 'type' => 'b'], 'H5' => ['value' => '0', 'type' => 'b'],
            'I5' => ['value' => 'Pending'], 'J5' => ['value' => '2026-07-07'], 'K5' => ['value' => '2026-02-30'],
        ]);

        $months = (new BackupWorkbook($path))->read()['records'][0]['months'];

        $this->assertSame('Completed', $months['2026-01']['status']);
        $this->assertSame('Completed', $months['2026-02']['status']);
        $this->assertSame('Completed', $months['2026-03']['status']);
        $this->assertSame('Completed', $months['2026-04']['status']);
        $this->assertSame('Pending', $months['2026-05']['status']);
        $this->assertSame('Pending', $months['2026-06']['status']);
        $this->assertSame('Completed', $months['2026-07']['status']);
        $this->assertSame('Recorded', $months['2026-08']['status']);
    }

    public function test_single_character_shortcuts_have_completed_status(): void
    {
        $path = $this->fixture([
            'D5' => ['value' => 'x'], 'E5' => ['value' => 'v'], 'F5' => ['value' => '/'],
            'G5' => ['value' => 'y'], 'H5' => ['value' => 'c'], 'I5' => ['value' => 'X'],
        ]);

        $months = (new BackupWorkbook($path))->read()['records'][0]['months'];

        $this->assertSame('Completed', $months['2026-01']['status']);
        $this->assertSame('Completed', $months['2026-02']['status']);
        $this->assertSame('Completed', $months['2026-03']['status']);
        $this->assertSame('Completed', $months['2026-04']['status']);
        $this->assertSame('Completed', $months['2026-05']['status']);
        $this->assertSame('Completed', $months['2026-06']['status']);
    }

    public function test_formats_numeric_excel_dates_with_builtin_and_custom_date_styles(): void
    {
        $path = $this->fixture(['D5' => ['value' => '46023', 'type' => 'n', 'style' => 1], 'E5' => ['value' => '46024', 'type' => 'n', 'style' => 2], 'F5' => ['value' => '46025', 'type' => 'n']]);

        $months = (new BackupWorkbook($path))->read()['records'][0]['months'];

        $this->assertSame('2026-01-01', $months['2026-01']['display']);
        $this->assertSame('Completed', $months['2026-01']['status']);
        $this->assertSame('2026-01-02', $months['2026-02']['display']);
        $this->assertSame('Completed', $months['2026-02']['status']);
        $this->assertSame('Recorded', $months['2026-03']['status']);
    }

    public function test_reads_newly_saved_workbook_values_without_using_stale_cache(): void
    {
        $path = $this->fixture();
        $reader = new BackupWorkbook($path);
        $reader->read();
        $zip = new ZipArchive;
        $zip->open($path);
        $zip->addFromString('xl/worksheets/sheet2.xml', BackupWorkbookFixture::worksheet('Updated User', ['M5' => ['value' => 'Completed']]));
        $zip->close();

        $result = $reader->read();

        $this->assertSame('Updated User', $result['records'][1]['user']);
        $this->assertSame('Completed', $result['records'][0]['months']['2026-10']['status']);
    }

    public function test_date_formatted_text_and_error_cells_are_not_confirmed_as_backups(): void
    {
        $path = $this->fixture([
            'D5' => ['value' => '46023', 'style' => 1],
            'E5' => ['value' => '2', 'type' => 's', 'style' => 1],
            'F5' => ['value' => '46025', 'type' => 'e', 'style' => 1],
        ]);

        $months = (new BackupWorkbook($path))->read()['records'][0]['months'];

        $this->assertSame('46023', $months['2026-01']['display']);
        $this->assertSame('Recorded', $months['2026-01']['status']);
        $this->assertSame('46024', $months['2026-02']['display']);
        $this->assertSame('Recorded', $months['2026-02']['status']);
        $this->assertSame('Recorded', $months['2026-03']['status']);
    }

    #[TestWith(['1'])]
    #[TestWith(['true'])]
    public function test_recognizes_both_supported_1904_date_system_flags(string $flag): void
    {
        $path = BackupWorkbookFixture::create(['D5' => ['value' => '44561', 'type' => 'n', 'style' => 1]], $flag);
        $this->files[] = $path;

        $entry = (new BackupWorkbook($path))->read()['records'][0]['months']['2026-01'];

        $this->assertSame('2026-01-01', $entry['display']);
        $this->assertSame('Completed', $entry['status']);
    }

    public function test_time_only_formats_are_not_confirmed_as_backup_dates(): void
    {
        $path = $this->fixture([
            'D5' => ['value' => '46023', 'type' => 'n', 'style' => 3],
            'E5' => ['value' => '46024', 'type' => 'n', 'style' => 4],
        ]);

        $months = (new BackupWorkbook($path))->read()['records'][0]['months'];

        $this->assertSame('46023', $months['2026-01']['display']);
        $this->assertSame('Recorded', $months['2026-01']['status']);
        $this->assertSame('46024', $months['2026-02']['display']);
        $this->assertSame('Recorded', $months['2026-02']['status']);
    }

    public function test_uses_the_configured_timezone_for_the_reporting_month(): void
    {
        $path = $this->fixture();
        config(['misdb.timezone' => 'Asia/Manila']);
        $this->travelTo(new \DateTimeImmutable('2026-09-30 20:00:00 UTC'));

        $result = (new BackupWorkbook($path))->read();

        $this->assertSame('2026-10', $result['default_period']);
        $this->assertSame('2026-10-01T04:00:00+08:00', $result['source']['checked_at']);
    }

    public function test_rejects_workbooks_with_missing_month_headers(): void
    {
        $path = $this->fixture();
        $zip = new ZipArchive;
        $zip->open($path);
        $zip->addFromString('xl/worksheets/sheet2.xml', str_replace('Computer code', 'Wrong header', BackupWorkbookFixture::worksheet('User')));
        $zip->close();
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('headers do not match');

        (new BackupWorkbook($path))->read();
    }

    public function test_rejects_corrupt_workbook_documents(): void
    {
        $path = $this->fixture();
        $zip = new ZipArchive;
        $zip->open($path);
        $zip->addFromString('xl/workbook.xml', '<workbook><invalid>');
        $zip->close();
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('invalid XML');

        (new BackupWorkbook($path))->read();
    }

    public function test_rejects_xml_documents_containing_doctype(): void
    {
        $path = $this->fixture();
        $zip = new ZipArchive;
        $zip->open($path);
        $zip->addFromString('xl/workbook.xml', '<!DOCTYPE workbook [<!ENTITY unsafe SYSTEM "file:///not-allowed">]><workbook/>');
        $zip->close();
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('missing or unsupported');

        (new BackupWorkbook($path))->read();
    }

    /** @param array<string, array{value: string, type?: string, style?: int}> $entries */
    private function fixture(array $entries = []): string
    {
        $path = BackupWorkbookFixture::create($entries);
        $this->files[] = $path;

        return $path;
    }
}
