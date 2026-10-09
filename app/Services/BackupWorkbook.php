<?php

namespace App\Services;

use App\BackupStatus;
use App\Models\BackupRecord;
use DateTimeImmutable;
use RuntimeException;
use SimpleXMLElement;
use ZipArchive;

class BackupWorkbook
{
    public function __construct(private readonly ?string $path = null) {}

    /**
     * @return array{source: array{file: string, modified_at: string, checked_at: string}, years: list<int>, default_period: string, records: list<array{id: string, number: string, code: string, user: string, year: int, sheet: string, row: int, months: array<string, array{cell: string, value: string, display: string, status: string}>}>}
     */
    public function read(): array
    {
        $path = $this->path ?? config('misdb.backup_workbook');
        if (! is_string($path) || $path === '') {
            throw new RuntimeException('The backup monitoring workbook path is not configured.');
        }
        clearstatcache(true, $path);

        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException('The backup monitoring workbook is missing or unreadable.');
        }

        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            throw new RuntimeException('The backup monitoring workbook is not a readable XLSX file.');
        }

        try {
            $workbook = $this->xml($zip, 'xl/workbook.xml');
            $relationships = $this->xml($zip, 'xl/_rels/workbook.xml.rels');
            $targets = [];
            foreach ($relationships->Relationship as $relationship) {
                $targets[(string) $relationship['Id']] = (string) $relationship['Target'];
            }

            $strings = [];
            if ($zip->locateName('xl/sharedStrings.xml') !== false) {
                foreach ($this->xml($zip, 'xl/sharedStrings.xml')->si as $item) {
                    $strings[] = $this->text($item);
                }
            }
            $dateStyles = $this->dateStyles($zip);
            $date1904 = in_array((string) $workbook->workbookPr['date1904'], ['1', 'true'], true);
            $records = [];
            $years = [];
            foreach ($workbook->sheets->sheet as $sheet) {
                $name = (string) $sheet['name'];
                if (! preg_match('/^(20\d{2})$/', trim($name), $match)) {
                    continue;
                }
                $year = (int) $match[1];
                $id = (string) $sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'];
                $target = $targets[$id] ?? '';
                if ($target === '' || str_contains($target, '..') || str_contains($target, '\\')) {
                    throw new RuntimeException('The workbook contains an invalid worksheet reference.');
                }
                $entry = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/'.$target;
                $rows = $this->rows($this->xml($zip, $entry), $strings);
                $columns = $this->columns($rows);
                foreach ($rows as $rowNumber => $cells) {
                    $number = $cells[$columns['number']]['value'] ?? '';
                    $code = trim($cells[$columns['code']]['value'] ?? '');
                    if (! ctype_digit($number) || $code === '') {
                        continue;
                    }
                    $months = [];
                    foreach ($columns['months'] as $month => $column) {
                        $cell = $cells[$column] ?? ['value' => '', 'style' => 0, 'type' => ''];
                        $value = trim($cell['value']);
                        $display = $value;
                        $isNumericCell = in_array($cell['type'], ['', 'n'], true);
                        $isDate = $isNumericCell && isset($dateStyles[$cell['style']]) && is_numeric($value) && (float) $value >= 1 && (float) $value < 100000;
                        if ($isDate) {
                            $epoch = new DateTimeImmutable($date1904 ? '1904-01-01' : '1899-12-30');
                            $display = $epoch->modify('+'.(int) floor((float) $value).' days')->format('Y-m-d');
                        }
                        $months[sprintf('%d-%02d', $year, $month)] = [
                            'cell' => $column.$rowNumber,
                            'value' => $value,
                            'display' => $display,
                            'status' => $this->status($value, $cell['type'], $isDate)->value,
                        ];
                    }
                    $records[] = [
                        'id' => $year.':'.$rowNumber,
                        'number' => $number,
                        'code' => $code,
                        'user' => trim($cells[$columns['user']]['value'] ?? ''),
                        'year' => $year,
                        'sheet' => $name,
                        'row' => $rowNumber,
                        'months' => $months,
                    ];
                }
                $years[] = $year;
            }
            if ($records === []) {
                throw new RuntimeException('No backup records were found in a year-named worksheet.');
            }
            $years = array_values(array_unique($years));
            rsort($years);
            $current = now(config('misdb.timezone'));
            $year = in_array((int) $current->format('Y'), $years, true) ? (int) $current->format('Y') : $years[0];

            $dbRecords = BackupRecord::all()->groupBy('code');

            foreach ($records as &$record) {
                if (! isset($dbRecords[$record['code']])) {
                    continue;
                }
                foreach ($dbRecords[$record['code']] as $dbRecord) {
                    if (isset($record['months'][$dbRecord->period])) {
                        $record['months'][$dbRecord->period]['status'] = $dbRecord->status;
                    }
                }
            }

            return [
                'source' => [
                    'file' => basename($path),
                    'modified_at' => gmdate(DATE_ATOM, (int) filemtime($path)),
                    'checked_at' => $current->toIso8601String(),
                ],
                'years' => $years,
                'default_period' => sprintf('%d-%s', $year, $current->format('m')),
                'records' => $records,
            ];
        } finally {
            $zip->close();
        }
    }

    private function xml(ZipArchive $zip, string $entry): SimpleXMLElement
    {
        $content = $zip->getFromName($entry);
        if ($content === false || str_contains(strtoupper($content), '<!DOCTYPE')) {
            throw new RuntimeException('A required workbook document is missing or unsupported.');
        }
        $previous = libxml_use_internal_errors(true);
        try {
            $xml = simplexml_load_string($content, SimpleXMLElement::class, LIBXML_NONET);
            if ($xml === false) {
                throw new RuntimeException('The workbook contains invalid XML.');
            }

            return $xml;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    private function text(SimpleXMLElement $element): string
    {
        $parts = $element->xpath('.//*[local-name()="t"]') ?: [];

        return implode('', array_map(static fn (SimpleXMLElement $text): string => (string) $text, $parts));
    }

    /**
     * @param  list<string>  $strings
     * @return array<int, array<string, array{value: string, style: int, type: string}>>
     */
    private function rows(SimpleXMLElement $worksheet, array $strings): array
    {
        $rows = [];
        foreach ($worksheet->sheetData->row as $row) {
            $number = (int) $row['r'];
            $rows[$number] = [];
            foreach ($row->c as $cell) {
                if (! preg_match('/^([A-Z]+)\d+$/', (string) $cell['r'], $match)) {
                    continue;
                }
                $type = (string) $cell['t'];
                $value = match ($type) {
                    's' => $strings[(int) $cell->v] ?? '',
                    'inlineStr' => $this->text($cell->is),
                    default => (string) $cell->v,
                };
                $rows[$number][$match[1]] = ['value' => $value, 'style' => (int) $cell['s'], 'type' => $type];
            }
        }

        return $rows;
    }

    /**
     * @param  array<int, array<string, array{value: string, style: int, type: string}>>  $rows
     * @return array{number: string, code: string, user: string, months: array<int, string>}
     */
    private function columns(array $rows): array
    {
        $monthNames = ['jan' => 1, 'feb' => 2, 'mar' => 3, 'apr' => 4, 'may' => 5, 'jun' => 6, 'jul' => 7, 'aug' => 8, 'sep' => 9, 'oct' => 10, 'nov' => 11, 'dec' => 12];
        foreach ($rows as $cells) {
            $columns = ['months' => []];
            foreach ($cells as $column => $cell) {
                $label = mb_strtolower(trim($cell['value']));
                if ($label === '#') {
                    $columns['number'] = $column;
                } elseif ($label === 'computer code') {
                    $columns['code'] = $column;
                } elseif ($label === 'user') {
                    $columns['user'] = $column;
                } elseif (isset($monthNames[mb_substr($label, 0, 3)])) {
                    $columns['months'][$monthNames[mb_substr($label, 0, 3)]] = $column;
                }
            }
            if (isset($columns['number'], $columns['code'], $columns['user']) && count($columns['months']) === 12) {
                ksort($columns['months']);

                return $columns;
            }
        }

        throw new RuntimeException('The backup worksheet headers do not match Computer code, User, and January–December.');
    }

    /** @return array<int, true> */
    private function dateStyles(ZipArchive $zip): array
    {
        if ($zip->locateName('xl/styles.xml') === false) {
            return [];
        }
        $xml = $this->xml($zip, 'xl/styles.xml');
        $formats = [];
        foreach ($xml->numFmts->numFmt ?? [] as $format) {
            $formats[(int) $format['numFmtId']] = (string) $format['formatCode'];
        }
        $styles = [];
        $styleIndex = -1;
        foreach ($xml->cellXfs->xf ?? [] as $style) {
            $styleIndex++;
            $format = (int) $style['numFmtId'];
            $code = preg_replace('/"[^"]*"|\[[^\]]*\]|\\\\./', '', $formats[$format] ?? '');
            if (in_array($format, [14, 15, 16, 17, 22], true) || preg_match('/[yd]/i', $code)) {
                $styles[$styleIndex] = true;
            }
        }

        return $styles;
    }

    private function status(string $value, string $type, bool $isDate): BackupStatus
    {
        if ($value === '') {
            return BackupStatus::NotRecorded;
        }
        if ($isDate || ($type === 'b' && $value === '1')) {
            return BackupStatus::Completed;
        }
        $normalized = mb_strtolower(trim($value));
        if (in_array($normalized, ['✓', '✔', '√', 'done', 'complete', 'completed', 'yes', 'ok', 'backed up', 'v', '/', 'y', 'c', 'x'], true)) {
            return BackupStatus::Completed;
        }
        if (($type === 'b' && $value === '0') || in_array($normalized, ['pending', 'not completed', 'no'], true)) {
            return BackupStatus::Pending;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
            if ($date && $date->format('Y-m-d') === $value) {
                return BackupStatus::Completed;
            }
        }

        return BackupStatus::Recorded;
    }
}
