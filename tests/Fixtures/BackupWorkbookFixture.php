<?php

namespace Tests\Fixtures;

use ZipArchive;

class BackupWorkbookFixture
{
    /** @param array<string, array{value: string, type?: string, style?: int}> $entries */
    public static function create(array $entries = []): string
    {
        $path = tempnam(sys_get_temp_dir(), 'misdb-backup-');
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::OVERWRITE);
        $zip->addFromString('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><sheets><sheet name="F-MIS-06 Rev. 0" sheetId="1" r:id="rId1"/><sheet name="2026" sheetId="2" r:id="rId2"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>');
        $zip->addFromString('xl/sharedStrings.xml', '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>SERVER</t></si><si><r><t>K. </t></r><r><t>DIXON</t></r></si></sst>');
        $zip->addFromString('xl/styles.xml', '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>');
        $zip->addFromString('xl/worksheets/sheet1.xml', self::worksheet('Old User', [], 'OUTDATED-PC'));
        $zip->addFromString('xl/worksheets/sheet2.xml', self::worksheet('Current User', $entries));
        $zip->close();

        return $path;
    }

    /** @param array<string, array{value: string, type?: string, style?: int}> $entries */
    public static function worksheet(string $user, array $entries = [], string $code = 'MIS'): string
    {
        $headers = ['A' => '#', 'B' => 'Computer code', 'C' => 'User', 'D' => 'Jan', 'E' => 'Feb ', 'F' => 'Mar', 'G' => 'Apr', 'H' => 'May', 'I' => 'Jun', 'J' => 'Jul', 'K' => 'Aug', 'L' => 'Sep', 'M' => 'Oct', 'N' => 'Nov', 'O' => 'Dec'];
        $header = '';
        foreach ($headers as $column => $label) {
            $header .= self::cell($column.'4', $label);
        }
        $months = '';
        foreach ($entries as $cell => $entry) {
            $months .= self::cell($cell, $entry['value'], $entry['type'] ?? 'inlineStr', $entry['style'] ?? 0);
        }

        return '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="3">'.self::cell('A3', 'Year: 2026').'</row><row r="4">'.$header.'</row><row r="5">'.self::cell('A5', '1', 'n').self::cell('B5', '0', 's').self::cell('C5', '1', 's').$months.'</row><row r="6">'.self::cell('A6', '2', 'n').self::cell('B6', $code).self::cell('C6', $user).'</row><row r="8">'.self::cell('A8', 'Prepared by').'</row></sheetData></worksheet>';
    }

    private static function cell(string $reference, string $value, string $type = 'inlineStr', int $style = 0): string
    {
        $content = htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');

        return '<c r="'.$reference.'" t="'.$type.'" s="'.$style.'">'.($type === 'inlineStr' ? '<is><t>'.$content.'</t></is>' : '<v>'.$content.'</v>').'</c>';
    }
}
