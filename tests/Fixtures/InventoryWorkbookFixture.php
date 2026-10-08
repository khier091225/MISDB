<?php

namespace Tests\Fixtures;

use ZipArchive;

class InventoryWorkbookFixture
{
    /** @return array{path: string, directory: string, backups: string} */
    public static function create(): array
    {
        $directory = tempnam(sys_get_temp_dir(), 'misdb-inventory-');
        unlink($directory);
        mkdir($directory);
        $path = $directory.DIRECTORY_SEPARATOR.'inventory.xlsx';
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE);
        $zip->addFromString('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="PC INVENTORY" sheetId="1" r:id="rId1"/><sheet name="LAPTOP INVENTORY" sheetId="2" r:id="rId2"/><sheet name="History" sheetId="3" r:id="rId3"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">&apos;PC INVENTORY&apos;!$A$1:$G$8</definedName></definedNames></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>');
        $zip->addFromString('xl/styles.xml', '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="0" applyBorder="1"/></cellXfs></styleSheet>');
        $pc = [
            1 => ['B' => 'MIS COMPUTER INVENTORY'],
            2 => ['B' => 'FOR THE MONTH OF: DECEMBER 2024'],
            4 => ['B' => 'DEPARTMENT SECTION', 'C' => 'USER', 'D' => 'LABEL', 'E' => 'DESKTOP', 'F' => 'BRAND', 'G' => 'REMARKS'],
            5 => ['A' => '1', 'B' => 'MIS', 'C' => 'Original User', 'D' => 'PC-001', 'E' => 'MONITOR', 'F' => 'AOC', 'G' => 'GOOD'],
            6 => ['E' => 'CPU', 'F' => 'Dell', 'G' => 'GOOD'],
            7 => ['A' => '2', 'B' => 'QA', 'C' => 'Second User', 'D' => 'PC-002', 'E' => 'CPU', 'F' => 'ASUS', 'G' => 'GOOD'],
            8 => ['E' => 'MOUSE', 'F' => 'Logitech', 'G' => 'Defective scroll'],
        ];
        $laptop = [
            1 => ['B' => 'DEPARTMENT SECTION', 'C' => 'BRAND', 'D' => 'MODEL', 'E' => 'SPECIFICATIONS', 'G' => 'REMARKS'],
            2 => ['A' => '1', 'B' => 'Engineering', 'C' => 'Lenovo', 'D' => 'LAP-100', 'E' => 'OS', 'F' => 'Windows 11'],
            3 => ['E' => 'RAM', 'F' => '8 GB', 'G' => 'Upgradable RAM'],
            4 => ['E' => 'PROCESSOR', 'F' => 'Intel i5'],
            5 => ['E' => 'STORAGE', 'F' => '512 GB SSD'],
            6 => ['E' => 'GPU', 'F' => 'Integrated'],
        ];
        $zip->addFromString('xl/worksheets/sheet1.xml', self::worksheet($pc, 8, '<mergeCells count="1"><mergeCell ref="B1:G1"/></mergeCells>'));
        $zip->addFromString('xl/worksheets/sheet2.xml', self::worksheet($laptop, 6, '<mergeCells count="1"><mergeCell ref="E1:F1"/></mergeCells>'));
        $zip->addFromString('xl/worksheets/sheet3.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Unrelated history must remain unchanged</t></is></c></row></sheetData></worksheet>');
        $zip->addFromString('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
        $zip->close();

        return ['path' => $path, 'directory' => $directory, 'backups' => $directory.DIRECTORY_SEPARATOR.'backups'];
    }

    /** @param array<int, array<string, string>> $rows */
    private static function worksheet(array $rows, int $end, string $extra): string
    {
        $xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:G'.$end.'"/><sheetData>';
        foreach ($rows as $number => $cells) {
            $xml .= '<row r="'.$number.'" ht="18" customHeight="1">';
            foreach ($cells as $column => $value) {
                $content = htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
                $xml .= '<c r="'.$column.$number.'" s="1" t="inlineStr"><is><t>'.$content.'</t></is></c>';
            }
            $xml .= '</row>';
        }

        return $xml.'</sheetData>'.$extra.'</worksheet>';
    }
}
