<?php

namespace App\Services;

use App\Exceptions\InventoryWorkbookException;
use Closure;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Validation\ValidationException;
use ZipArchive;

class InventoryWorkbook
{
    private const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const SHEETS = ['PC INVENTORY' => 'pc', 'LAPTOP INVENTORY' => 'laptop'];

    private const SPECIFICATIONS = ['OS' => 'os', 'RAM' => 'ram', 'PROCESSOR' => 'processor', 'STORAGE' => 'storage', 'GPU' => 'gpu'];

    public function __construct(private readonly ?string $path = null, private readonly ?string $backupDirectory = null) {}

    /** @return array<string, mixed> */
    public function read(): array
    {
        return $this->locked(false, fn (string $path): array => $this->snapshot($path));
    }

    /** @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        return $this->mutate('create', null, $data);
    }

    /** @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function update(string $id, array $data): array
    {
        return $this->mutate('update', $id, $data);
    }

    /** @return array<string, mixed> */
    public function delete(string $id, string $version): array
    {
        return $this->mutate('delete', $id, ['version' => $version]);
    }

    /** @param Closure(string): array<string, mixed> $operation
     * @return array<string, mixed>
     */
    private function locked(bool $write, Closure $operation): array
    {
        $path = $this->path ?? config('misdb.inventory_workbook');
        if (! is_string($path) || ! is_file($path) || ! is_readable($path)) {
            throw new InventoryWorkbookException('The inventory Excel file is missing or unreadable.');
        }
        $lock = @fopen($path.'.misdb.lock', 'c+');
        if ($lock === false) {
            throw new InventoryWorkbookException('The inventory file cannot be locked. Check its folder permissions.');
        }
        if (! flock($lock, ($write ? LOCK_EX : LOCK_SH) | LOCK_NB)) {
            fclose($lock);
            throw new InventoryWorkbookException('Inventory is being saved by another request. Please try again.', 409);
        }
        try {
            return $operation($path);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** @return array<string, mixed> */
    private function snapshot(string $path): array
    {
        $version = $this->version($path);
        $documents = $this->documents($path);
        $records = $this->records($documents);
        if ($version !== $this->version($path)) {
            throw new InventoryWorkbookException('The Excel file changed while it was being read. Refresh inventory and try again.', 409);
        }
        clearstatcache(true, $path);

        return [
            'version' => $version,
            'source' => [
                'file' => basename($path),
                'period' => $this->cells($documents['sheets']['pc']['document'], $documents['strings'])[2]['B'] ?? '',
                'modified_at' => gmdate(DATE_ATOM, (int) filemtime($path)),
                'checked_at' => now(config('misdb.timezone'))->toIso8601String(),
            ],
            'records' => $records,
        ];
    }

    /** @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function mutate(string $action, ?string $id, array $data): array
    {
        return $this->locked(true, function (string $path) use ($action, $id, $data): array {
            $version = $this->version($path);
            if (! hash_equals($version, $data['version'])) {
                throw new InventoryWorkbookException('Inventory has changed since you opened it. Refresh Excel before saving again.', 409);
            }
            $ownerNames = ['~$'.basename($path), '~$'.mb_substr(basename($path), 2)];
            foreach ($ownerNames as $ownerName) {
                if (is_file(dirname($path).DIRECTORY_SEPARATOR.$ownerName)) {
                    throw new InventoryWorkbookException('The inventory workbook is open in Excel. Close it, then try saving again.', 409);
                }
            }
            if (! is_writable($path)) {
                throw new InventoryWorkbookException('The inventory workbook is read-only. Check its file permissions.');
            }
            $documents = $this->documents($path);
            $records = $this->records($documents);
            $existing = null;
            foreach ($records as $record) {
                if ($record['id'] === $id) {
                    $existing = $record;
                    break;
                }
            }
            if ($action !== 'create' && $existing === null) {
                throw new InventoryWorkbookException('This inventory record no longer exists. Refresh inventory.', 404);
            }
            $kind = $existing['kind'] ?? $data['kind'];
            if ($action !== 'delete' && $kind !== $data['kind']) {
                throw ValidationException::withMessages(['kind' => 'Equipment type cannot be changed. Create a separate record for the other sheet.']);
            }
            if ($action !== 'delete' && $kind === 'pc' && ($data['code'] ?? '') !== '') {
                foreach ($records as $record) {
                    if ($record['kind'] === 'pc' && $record['id'] !== $id && mb_strtolower($record['label']) === mb_strtolower(trim($data['code']))) {
                        throw ValidationException::withMessages(['code' => 'This computer label already exists in the inventory.']);
                    }
                }
            }
            $sheet = $documents['sheets'][$kind];
            $document = $sheet['document'];
            if ($existing !== null) {
                $this->clearRecord($document, $existing);
            }
            if ($action !== 'delete') {
                $size = $kind === 'pc' ? count($data['components']) : count(self::SPECIFICATIONS);
                $start = $existing !== null && $size <= $existing['end_row'] - $existing['row'] + 1 ? $existing['row'] : $this->lastRow($document) + 1;
                $numbers = array_column(array_filter($records, fn (array $record): bool => $record['kind'] === $kind), 'number');
                $number = $existing['number'] ?? (($numbers === [] ? 0 : max($numbers)) + 1);
                $this->writeRecord($document, $kind, $start, $number, $data);
            }
            $this->extendDimension($document);
            $this->extendPrintArea($documents['workbook'], $sheet['index'], $this->lastRow($document));
            $backup = $this->save($path, $version, [
                $sheet['entry'] => $document->saveXML(),
                'xl/workbook.xml' => $documents['workbook']->saveXML(),
            ]);
            $result = $this->snapshot($path);
            $result['source']['backup_created'] = $backup;

            return $result;
        });
    }

    /** @return array<string, mixed> */
    private function documents(string $path): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            throw new InventoryWorkbookException('The inventory file is not a readable XLSX workbook.');
        }
        try {
            $workbook = $this->xml($zip->getFromName('xl/workbook.xml'));
            $relationships = $this->xml($zip->getFromName('xl/_rels/workbook.xml.rels'));
            $targets = [];
            foreach ($relationships->documentElement->childNodes as $relationship) {
                if ($relationship instanceof DOMElement) {
                    $targets[$relationship->getAttribute('Id')] = $relationship->getAttribute('Target');
                }
            }
            $strings = [];
            if ($zip->locateName('xl/sharedStrings.xml') !== false) {
                $shared = $this->xml($zip->getFromName('xl/sharedStrings.xml'));
                foreach ($this->query($shared, '/m:sst/m:si') as $item) {
                    $value = '';
                    foreach ($this->query($shared, './/m:t', $item) as $text) {
                        $value .= $text->textContent;
                    }
                    $strings[] = $value;
                }
            }
            $sheets = [];
            $index = 0;
            foreach ($this->query($workbook, '/m:workbook/m:sheets/m:sheet') as $sheet) {
                $name = $sheet->getAttribute('name');
                if (isset(self::SHEETS[$name])) {
                    $id = $sheet->getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
                    $target = $targets[$id] ?? '';
                    if ($target === '' || str_contains($target, '..') || str_contains($target, '\\')) {
                        throw new InventoryWorkbookException('The inventory workbook contains an invalid sheet reference.');
                    }
                    $entry = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/'.$target;
                    $sheets[self::SHEETS[$name]] = ['name' => $name, 'entry' => $entry, 'index' => $index, 'document' => $this->xml($zip->getFromName($entry))];
                }
                $index++;
            }
            if (! isset($sheets['pc'], $sheets['laptop'])) {
                throw new InventoryWorkbookException('The inventory workbook needs PC INVENTORY and LAPTOP INVENTORY sheets.');
            }

            return ['workbook' => $workbook, 'sheets' => $sheets, 'strings' => $strings];
        } finally {
            $zip->close();
        }
    }

    private function xml(string|false $content): DOMDocument
    {
        if ($content === false || str_contains(strtoupper($content), '<!DOCTYPE')) {
            throw new InventoryWorkbookException('A required inventory workbook document is missing or unsupported.');
        }
        $previous = libxml_use_internal_errors(true);
        try {
            $document = new DOMDocument;
            if (! $document->loadXML($content, LIBXML_NONET)) {
                throw new InventoryWorkbookException('The inventory workbook contains invalid XML.');
            }

            return $document;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    /** @return \DOMNodeList<\DOMNode> */
    private function query(DOMDocument $document, string $expression, ?\DOMNode $context = null): \DOMNodeList
    {
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('m', self::NS);

        return $xpath->query($expression, $context);
    }

    /** @param list<string> $strings
     * @return array<int, array<string, string>>
     */
    private function cells(DOMDocument $document, array $strings): array
    {
        $rows = [];
        foreach ($this->query($document, '/m:worksheet/m:sheetData/m:row') as $row) {
            $number = (int) $row->getAttribute('r');
            $rows[$number] = [];
            foreach ($row->childNodes as $cell) {
                if (! $cell instanceof DOMElement || ! preg_match('/^([A-Z]+)\d+$/', $cell->getAttribute('r'), $match)) {
                    continue;
                }
                $type = $cell->getAttribute('t');
                $raw = $this->query($document, './m:v', $cell)->item(0)?->textContent ?? '';
                if ($type === 's') {
                    if (! ctype_digit($raw) || ! array_key_exists((int) $raw, $strings)) {
                        throw new InventoryWorkbookException('The inventory workbook contains an invalid shared-string reference.');
                    }
                    $value = $strings[(int) $raw];
                } elseif ($type === 'inlineStr') {
                    $value = '';
                    foreach ($this->query($document, './m:is//m:t', $cell) as $text) {
                        $value .= $text->textContent;
                    }
                } else {
                    $value = $raw;
                }
                $rows[$number][$match[1]] = trim($value);
            }
        }
        ksort($rows);

        return $rows;
    }

    /** @param array<string, mixed> $documents
     * @return list<array<string, mixed>>
     */
    private function records(array $documents): array
    {
        $records = [];
        foreach ($documents['sheets'] as $kind => $sheet) {
            $rows = $this->cells($sheet['document'], $documents['strings']);
            $headerRow = $kind === 'pc' ? 4 : 1;
            if (mb_strtoupper($rows[$headerRow]['B'] ?? '') !== 'DEPARTMENT SECTION') {
                throw new InventoryWorkbookException('Inventory column headers do not match the expected workbook layout.');
            }
            $starts = array_keys(array_filter($rows, fn (array $cells): bool => ctype_digit($cells['A'] ?? '') && ($cells['B'] ?? '') !== ''));
            foreach ($starts as $index => $start) {
                $limit = $starts[$index + 1] ?? ($this->lastRow($sheet['document']) + 1);
                $components = [];
                $specifications = array_fill_keys(array_values(self::SPECIFICATIONS), '');
                $specificationRemarks = $specifications;
                $end = $start;
                for ($row = $start; $row < $limit; $row++) {
                    $name = $rows[$row]['E'] ?? '';
                    if ($name === '') {
                        continue;
                    }
                    $end = $row;
                    if ($kind === 'pc') {
                        $components[] = ['name' => $name, 'brand' => $rows[$row]['F'] ?? '', 'remarks' => $rows[$row]['G'] ?? ''];
                    } elseif (isset(self::SPECIFICATIONS[mb_strtoupper($name)])) {
                        $key = self::SPECIFICATIONS[mb_strtoupper($name)];
                        $specifications[$key] = $rows[$row]['F'] ?? '';
                        $specificationRemarks[$key] = $rows[$row]['G'] ?? '';
                    }
                }
                $number = (int) $rows[$start]['A'];
                $label = $kind === 'pc' ? ($rows[$start]['D'] ?? '') : '';
                $model = $kind === 'laptop' ? ($rows[$start]['D'] ?? '') : '';
                $brand = $kind === 'laptop' ? ($rows[$start]['C'] ?? '') : '';
                foreach ($components as $component) {
                    if ($brand === '' || mb_strtoupper($component['name']) === 'CPU') {
                        $brand = $component['brand'];
                    }
                }
                $records[] = [
                    'id' => $kind.'-'.$start, 'kind' => $kind, 'number' => $number,
                    'row' => $start, 'end_row' => $end, 'sheet' => $sheet['name'],
                    'label' => $label, 'model' => $model,
                    'code' => ($kind === 'pc' ? $label : $model) ?: ('Unlabeled '.($kind === 'pc' ? 'PC' : 'laptop').' #'.$number),
                    'department' => $rows[$start]['B'],
                    'custodian' => $kind === 'pc' ? ($rows[$start]['C'] ?? '') : '',
                    'brand' => $brand, 'type' => $kind === 'laptop' ? 'Laptop' : (str_contains(mb_strtoupper($label), 'SERVER') ? 'Server' : 'Desktop'),
                    'status' => $this->status($kind === 'pc' ? array_column($components, 'remarks') : array_values($specificationRemarks)),
                    'components' => $components, 'specifications' => $specifications, 'specification_remarks' => $specificationRemarks,
                ];
            }
        }

        return $records;
    }

    /** @param list<string> $remarks */
    private function status(array $remarks): string
    {
        $values = array_map(static fn (string $remark): string => mb_strtoupper(trim($remark)), $remarks);
        foreach ($values as $value) {
            if (preg_match('/DEFECTIVE|NOT FUNCTIONAL|FAULTY|BROKEN/', $value)) {
                return 'Attention';
            }
            if (str_contains($value, 'REPAIR')) {
                return 'Under repair';
            }
            if (str_contains($value, 'MAINTENANCE')) {
                return 'Maintenance';
            }
        }

        return $values !== [] && count(array_filter($values, static fn (string $value): bool => in_array($value, ['GOOD', 'OK', 'OPERATIONAL'], true))) === count($values) ? 'Operational' : 'Not recorded';
    }

    /** @param array<string, mixed> $record */
    private function clearRecord(DOMDocument $document, array $record): void
    {
        for ($row = $record['row']; $row <= $record['end_row']; $row++) {
            foreach (range('A', 'G') as $column) {
                $this->setCell($document, $row, $column, '', false, $record['kind'] === 'pc' ? 5 : 2);
            }
        }
    }

    /** @param array<string, mixed> $data */
    private function writeRecord(DOMDocument $document, string $kind, int $start, int $number, array $data): void
    {
        $templateRow = $kind === 'pc' ? 5 : 2;
        $this->setCell($document, $start, 'A', (string) $number, true, $templateRow);
        $this->setCell($document, $start, 'B', $data['department'], false, $templateRow);
        $this->setCell($document, $start, 'C', $kind === 'pc' ? ($data['custodian'] ?? '') : $data['brand'], false, $templateRow);
        $this->setCell($document, $start, 'D', $kind === 'pc' ? ($data['code'] ?? '') : $data['model'], false, $templateRow);
        $parts = $kind === 'pc' ? $data['components'] : array_map(
            fn (string $name, string $key): array => ['name' => $name, 'brand' => $data['specifications'][$key] ?? '', 'remarks' => $data['specification_remarks'][$key] ?? ''],
            array_keys(self::SPECIFICATIONS), array_values(self::SPECIFICATIONS),
        );
        foreach ($parts as $index => $part) {
            $this->setCell($document, $start + $index, 'E', $part['name'], false, $templateRow);
            $this->setCell($document, $start + $index, 'F', $part['brand'] ?? '', false, $templateRow);
            $this->setCell($document, $start + $index, 'G', $part['remarks'] ?? '', false, $templateRow);
        }
    }

    private function setCell(DOMDocument $document, int $rowNumber, string $column, ?string $value, bool $numeric = false, int $templateRow = 5): void
    {
        $sheetData = $this->query($document, '/m:worksheet/m:sheetData')->item(0);
        $row = $this->query($document, '/m:worksheet/m:sheetData/m:row[@r="'.$rowNumber.'"]')->item(0);
        if (! $row instanceof DOMElement) {
            $template = $this->query($document, '/m:worksheet/m:sheetData/m:row[@r="'.$templateRow.'"]')->item(0);
            $row = $document->createElementNS(self::NS, 'row');
            if ($template instanceof DOMElement) {
                foreach ($template->attributes as $attribute) {
                    if ($attribute->name !== 'r') {
                        $row->setAttribute($attribute->name, $attribute->value);
                    }
                }
            }
            $row->setAttribute('r', (string) $rowNumber);
            $sheetData->appendChild($row);
        }
        $reference = $column.$rowNumber;
        $cell = $this->query($document, './m:c[@r="'.$reference.'"]', $row)->item(0);
        if (! $cell instanceof DOMElement) {
            $cell = $document->createElementNS(self::NS, 'c');
            $cell->setAttribute('r', $reference);
            $template = $this->query($document, '/m:worksheet/m:sheetData/m:row/m:c[@r="'.$column.$templateRow.'"]')->item(0);
            if ($template instanceof DOMElement && $template->hasAttribute('s')) {
                $cell->setAttribute('s', $template->getAttribute('s'));
            }
            $inserted = false;
            foreach ($row->childNodes as $sibling) {
                if ($sibling instanceof DOMElement && strcmp(preg_replace('/\d+$/', '', $sibling->getAttribute('r')), $column) > 0) {
                    $row->insertBefore($cell, $sibling);
                    $inserted = true;
                    break;
                }
            }
            if (! $inserted) {
                $row->appendChild($cell);
            }
        }
        while ($cell->firstChild !== null) {
            $cell->removeChild($cell->firstChild);
        }
        $cell->removeAttribute('t');
        if ($value === null || $value === '') {
            return;
        }
        if ($numeric) {
            $cell->setAttribute('t', 'n');
            $element = $document->createElementNS(self::NS, 'v');
            $element->appendChild($document->createTextNode($value));
            $cell->appendChild($element);
        } else {
            $cell->setAttribute('t', 'inlineStr');
            $inline = $document->createElementNS(self::NS, 'is');
            $text = $document->createElementNS(self::NS, 't');
            $text->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
            $text->appendChild($document->createTextNode($value));
            $inline->appendChild($text);
            $cell->appendChild($inline);
        }
    }

    private function lastRow(DOMDocument $document): int
    {
        $last = 0;
        foreach ($this->query($document, '/m:worksheet/m:sheetData/m:row') as $row) {
            $last = max($last, (int) $row->getAttribute('r'));
        }

        return $last;
    }

    private function extendDimension(DOMDocument $document): void
    {
        $dimension = $this->query($document, '/m:worksheet/m:dimension')->item(0);
        if ($dimension instanceof DOMElement) {
            $dimension->setAttribute('ref', 'A1:G'.$this->lastRow($document));
        }
    }

    private function extendPrintArea(DOMDocument $workbook, int $index, int $lastRow): void
    {
        foreach ($this->query($workbook, '/m:workbook/m:definedNames/m:definedName[@name="_xlnm.Print_Area"]') as $area) {
            if ((int) $area->getAttribute('localSheetId') === $index) {
                $area->textContent = preg_replace_callback('/\$G\$\d+/', static fn (): string => '$G$'.$lastRow, $area->textContent);
            }
        }
    }

    /** @param array<string, string> $entries */
    private function save(string $path, string $version, array $entries): string
    {
        $directory = $this->backupDirectory ?? config('misdb.inventory_backups');
        if (! is_string($directory) || (! is_dir($directory) && ! @mkdir($directory, 0775, true))) {
            throw new InventoryWorkbookException('An inventory backup could not be created. The Excel file has not been changed.');
        }
        $temporary = tempnam(dirname($path), '.misdb-inventory-');
        if ($temporary === false || ! @copy($path, $temporary)) {
            if (is_string($temporary)) {
                @unlink($temporary);
            }
            throw new InventoryWorkbookException('A working copy of the inventory could not be created.');
        }
        try {
            $zip = new ZipArchive;
            if ($zip->open($temporary) !== true) {
                throw new InventoryWorkbookException('The inventory working copy could not be opened.');
            }
            try {
                foreach ($entries as $entry => $content) {
                    if (! $zip->addFromString($entry, $content)) {
                        throw new InventoryWorkbookException('The inventory changes could not be written.');
                    }
                }
            } finally {
                if (! $zip->close()) {
                    throw new InventoryWorkbookException('The inventory working copy could not be saved.');
                }
            }
            if ($version !== $this->version($path)) {
                throw new InventoryWorkbookException('The Excel file was changed by another program. Refresh inventory and try again.', 409);
            }
            $backup = basename($path).'.'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(5)).'.xlsx';
            if (! @copy($path, $directory.DIRECTORY_SEPARATOR.$backup)) {
                throw new InventoryWorkbookException('An inventory backup could not be saved. The Excel file has not been changed.');
            }
            if ($version !== $this->version($path)) {
                throw new InventoryWorkbookException('The Excel file changed before saving. Refresh inventory and try again.', 409);
            }
            if (! @rename($temporary, $path)) {
                throw new InventoryWorkbookException('The inventory workbook could not be replaced. Close Excel and check file permissions, then try again.', 409);
            }

            return $backup;
        } finally {
            if (is_file($temporary)) {
                @unlink($temporary);
            }
        }
    }

    private function version(string $path): string
    {
        $version = @hash_file('sha256', $path);
        if ($version === false) {
            throw new InventoryWorkbookException('The inventory workbook could not be read.');
        }

        return $version;
    }
}
