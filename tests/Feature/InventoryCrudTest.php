<?php

namespace Tests\Feature;

use App\Services\InventoryWorkbook;
use Tests\Fixtures\InventoryWorkbookFixture;
use Tests\TestCase;
use ZipArchive;

class InventoryCrudTest extends TestCase
{
    /** @var list<string> */
    private array $directories = [];

    protected function tearDown(): void
    {
        foreach ($this->directories as $directory) {
            foreach (glob($directory.DIRECTORY_SEPARATOR.'backups'.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
                unlink($file);
            }
            if (is_dir($directory.DIRECTORY_SEPARATOR.'backups')) {
                rmdir($directory.DIRECTORY_SEPARATOR.'backups');
            }
            foreach (glob($directory.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            rmdir($directory);
        }
        parent::tearDown();
    }

    public function test_lists_real_pc_parts_and_laptop_specifications_without_changing_excel(): void
    {
        $fixture = $this->fixture();
        $before = hash_file('sha256', $fixture['path']);

        $response = $this->getJson(route('inventory.index'));

        $response->assertOk()->assertJsonCount(3, 'records')
            ->assertJsonPath('records.0.code', 'PC-001')
            ->assertJsonPath('records.0.custodian', 'Original User')
            ->assertJsonPath('records.0.brand', 'Dell')
            ->assertJsonPath('records.0.components.1.name', 'CPU')
            ->assertJsonPath('records.1.status', 'Attention')
            ->assertJsonPath('records.2.model', 'LAP-100')
            ->assertJsonPath('records.2.specifications.ram', '8 GB')
            ->assertJsonPath('records.2.status', 'Not recorded')
            ->assertJsonPath('source.period', 'FOR THE MONTH OF: DECEMBER 2024');
        $this->assertSame($before, hash_file('sha256', $fixture['path']));
    }

    public function test_creates_a_pc_in_native_excel_cells_and_retains_a_backup_and_other_sheets(): void
    {
        $fixture = $this->fixture();
        $before = file_get_contents($fixture['path']);
        $history = $this->entry($fixture['path'], 'xl/worksheets/sheet3.xml');
        $styles = $this->entry($fixture['path'], 'xl/styles.xml');
        $data = $this->pc();
        $data['custodian'] = '=HYPERLINK("example")';

        $response = $this->postJson(route('inventory.store'), $data);

        $response->assertCreated()->assertJsonCount(4, 'records')->assertJsonPath('records.2.code', 'NEW-PC');
        $sheet = $this->entry($fixture['path'], 'xl/worksheets/sheet1.xml');
        $this->assertStringContainsString('r="D9"', $sheet);
        $this->assertStringContainsString('NEW-PC', $sheet);
        $this->assertStringContainsString('t="inlineStr"', $sheet);
        $this->assertStringNotContainsString('<f>', $sheet);
        $this->assertSame($history, $this->entry($fixture['path'], 'xl/worksheets/sheet3.xml'));
        $this->assertSame($styles, $this->entry($fixture['path'], 'xl/styles.xml'));
        $backups = glob($fixture['backups'].DIRECTORY_SEPARATOR.'*.xlsx');
        $this->assertCount(1, $backups);
        $this->assertSame($before, file_get_contents($backups[0]));
        $this->assertStringContainsString('$G$11', $this->entry($fixture['path'], 'xl/workbook.xml'));
    }

    public function test_updates_and_expands_pc_parts_without_overwriting_the_next_equipment(): void
    {
        $this->fixture();
        $data = $this->pc();
        $data['code'] = 'PC-001';
        $data['custodian'] = 'Updated User';
        $data['components'][] = ['name' => 'UPS', 'brand' => 'APC', 'remarks' => 'GOOD'];

        $response = $this->patchJson(route('inventory.update', ['record' => 'pc-5']), $data);

        $response->assertOk()->assertJsonCount(3, 'records');
        $records = $response->json('records');
        $updated = array_values(array_filter($records, fn (array $record): bool => $record['code'] === 'PC-001'))[0];
        $other = array_values(array_filter($records, fn (array $record): bool => $record['code'] === 'PC-002'))[0];
        $this->assertSame('Updated User', $updated['custodian']);
        $this->assertCount(4, $updated['components']);
        $this->assertSame('pc-7', $other['id']);
        $this->assertSame('Second User', $other['custodian']);
    }

    public function test_shorter_pc_parts_remove_old_values_and_keep_cell_styles(): void
    {
        $fixture = $this->fixture();
        $data = $this->pc();
        $data['code'] = 'PC-001';
        $data['components'] = [['name' => 'CPU', 'brand' => 'Updated Brand', 'remarks' => 'Under repair']];

        $response = $this->patchJson(route('inventory.update', ['record' => 'pc-5']), $data);

        $response->assertJsonPath('records.0.components.0.brand', 'Updated Brand')
            ->assertJsonPath('records.0.status', 'Under repair')
            ->assertJsonCount(1, 'records.0.components');
        $xml = simplexml_load_string($this->entry($fixture['path'], 'xl/worksheets/sheet1.xml'));
        $xml->registerXPathNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $this->assertSame('1', (string) $xml->xpath('//m:c[@r="D5"]')[0]['s']);
        $this->assertSame('', (string) ($xml->xpath('//m:c[@r="E6"]/m:is/m:t')[0] ?? ''));
    }

    public function test_creates_and_updates_laptop_brand_model_and_specification_remarks(): void
    {
        $this->fixture();
        $data = [
            'version' => $this->version(), 'kind' => 'laptop', 'department' => 'Design',
            'brand' => 'ASUS', 'model' => 'MODEL-NEW',
            'specifications' => ['os' => 'Windows 11', 'ram' => '16 GB', 'processor' => 'i7', 'storage' => '1 TB SSD', 'gpu' => 'Integrated'],
            'specification_remarks' => ['ram' => 'Upgradable RAM'],
        ];

        $created = $this->postJson(route('inventory.store'), $data);

        $created->assertCreated()->assertJsonCount(4, 'records')
            ->assertJsonPath('records.3.model', 'MODEL-NEW')
            ->assertJsonPath('records.3.specifications.storage', '1 TB SSD');
        $data['version'] = $created->json('version');
        $data['model'] = 'MODEL-UPDATED';
        $data['specification_remarks']['ram'] = 'GOOD';
        $this->patchJson(route('inventory.update', ['record' => $created->json('records.3.id')]), $data)
            ->assertOk()->assertJsonPath('records.3.model', 'MODEL-UPDATED')
            ->assertJsonPath('records.3.specification_remarks.ram', 'GOOD');
    }

    public function test_delete_removes_only_the_selected_equipment_and_keeps_a_backup(): void
    {
        $fixture = $this->fixture();
        $before = file_get_contents($fixture['path']);

        $response = $this->deleteJson(route('inventory.destroy', ['record' => 'pc-5']), ['version' => $this->version()]);

        $response->assertOk()->assertJsonCount(2, 'records')
            ->assertJsonPath('records.0.code', 'PC-002')
            ->assertJsonPath('records.1.kind', 'laptop');
        $backups = glob($fixture['backups'].DIRECTORY_SEPARATOR.'*.xlsx');
        $this->assertSame($before, file_get_contents($backups[0]));
    }

    public function test_rejects_stale_versions_without_changing_the_excel_file(): void
    {
        $fixture = $this->fixture();
        $data = $this->pc();
        $zip = new ZipArchive;
        $zip->open($fixture['path']);
        $zip->addFromString('docProps/changed.xml', '<changed>External Excel edit</changed>');
        $zip->close();
        $afterExternalEdit = file_get_contents($fixture['path']);

        $response = $this->postJson(route('inventory.store'), $data);

        $response->assertStatus(409)->assertJsonPath('message', 'Inventory has changed since you opened it. Refresh Excel before saving again.');
        $this->assertSame($afterExternalEdit, file_get_contents($fixture['path']));
        $this->assertFalse(is_dir($fixture['backups']));
    }

    public function test_rejects_duplicate_pc_labels_case_insensitively(): void
    {
        $fixture = $this->fixture();
        $before = hash_file('sha256', $fixture['path']);
        $data = $this->pc();
        $data['code'] = 'pc-001';

        $this->postJson(route('inventory.store'), $data)->assertUnprocessable()->assertJsonValidationErrors('code');

        $this->assertSame($before, hash_file('sha256', $fixture['path']));
    }

    public function test_validation_rejects_missing_parts_and_unknown_nested_keys(): void
    {
        $fixture = $this->fixture();
        $before = hash_file('sha256', $fixture['path']);
        $data = $this->pc();
        $data['components'] = [['brand' => 'Dell', 'path' => 'not-allowed']];

        $this->postJson(route('inventory.store'), $data)->assertUnprocessable()
            ->assertJsonValidationErrors(['components.0', 'components.0.name']);

        $this->assertSame($before, hash_file('sha256', $fixture['path']));
    }

    public function test_mutations_require_a_valid_inventory_version(): void
    {
        $this->fixture();
        $data = $this->pc();
        unset($data['version']);

        $this->postJson(route('inventory.store'), $data)->assertUnprocessable()->assertJsonValidationErrors('version');
    }

    public function test_rejects_xml_control_characters_without_modifying_excel(): void
    {
        $fixture = $this->fixture();
        $before = hash_file('sha256', $fixture['path']);
        $data = $this->pc();
        $data['department'] = "Bad\x01department";

        $this->postJson(route('inventory.store'), $data)->assertUnprocessable()->assertJsonValidationErrors('department');

        $this->assertSame($before, hash_file('sha256', $fixture['path']));
    }

    public function test_missing_record_returns_404_without_writing_a_backup(): void
    {
        $fixture = $this->fixture();

        $this->deleteJson(route('inventory.destroy', ['record' => 'pc-999']), ['version' => $this->version()])
            ->assertNotFound();

        $this->assertFalse(is_dir($fixture['backups']));
    }

    public function test_excel_owner_file_blocks_saving_without_modifying_inventory(): void
    {
        $fixture = $this->fixture();
        file_put_contents($fixture['directory'].DIRECTORY_SEPARATOR.'~$inventory.xlsx', 'Excel owner');
        $before = hash_file('sha256', $fixture['path']);

        $this->postJson(route('inventory.store'), $this->pc())->assertStatus(409);

        $this->assertSame($before, hash_file('sha256', $fixture['path']));
    }

    public function test_another_web_writer_blocks_saving(): void
    {
        $fixture = $this->fixture();
        $data = $this->pc();
        $handle = fopen($fixture['path'].'.misdb.lock', 'c+');
        flock($handle, LOCK_EX | LOCK_NB);

        try {
            $this->postJson(route('inventory.store'), $data)->assertStatus(409);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    public function test_backup_failure_does_not_change_original_workbook(): void
    {
        $fixture = $this->fixture();
        $data = $this->pc();
        $blocked = $fixture['directory'].DIRECTORY_SEPARATOR.'blocked-backup-directory';
        file_put_contents($blocked, 'This is a file');
        $this->app->instance(InventoryWorkbook::class, new InventoryWorkbook($fixture['path'], $blocked));
        $before = hash_file('sha256', $fixture['path']);

        $this->postJson(route('inventory.store'), $data)->assertStatus(503);

        $this->assertSame($before, hash_file('sha256', $fixture['path']));
    }

    public function test_extra_top_level_input_cannot_redirect_inventory_writes(): void
    {
        $fixture = $this->fixture();
        $other = $fixture['directory'].DIRECTORY_SEPARATOR.'other.xlsx';
        file_put_contents($other, 'Do not modify');
        $data = $this->pc();
        $data['path'] = $other;

        $this->postJson(route('inventory.store'), $data)->assertCreated();

        $this->assertSame('Do not modify', file_get_contents($other));
    }

    /** @return array{path: string, directory: string, backups: string} */
    private function fixture(): array
    {
        $fixture = InventoryWorkbookFixture::create();
        $this->directories[] = $fixture['directory'];
        $this->app->instance(InventoryWorkbook::class, new InventoryWorkbook($fixture['path'], $fixture['backups']));

        return $fixture;
    }

    private function version(): string
    {
        return $this->getJson(route('inventory.index'))->json('version');
    }

    /** @return array<string, mixed> */
    private function pc(): array
    {
        return [
            'version' => $this->version(), 'kind' => 'pc', 'code' => 'NEW-PC',
            'department' => 'MIS', 'custodian' => 'New User',
            'components' => [
                ['name' => 'MONITOR', 'brand' => 'AOC', 'remarks' => 'GOOD'],
                ['name' => 'CPU', 'brand' => 'Dell', 'remarks' => 'GOOD'],
                ['name' => 'KEYBOARD', 'brand' => 'Logitech', 'remarks' => 'GOOD'],
            ],
        ];
    }

    private function entry(string $path, string $entry): string
    {
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::RDONLY);
        $content = $zip->getFromName($entry);
        $zip->close();

        return $content;
    }
}
