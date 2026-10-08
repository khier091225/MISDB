<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveInventoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $text = ['nullable', 'string', 'max:255', 'not_regex:/[\x00-\x08\x0B\x0C\x0E-\x1F]/'];
        $remarks = ['nullable', 'string', 'max:500', 'not_regex:/[\x00-\x08\x0B\x0C\x0E-\x1F]/'];
        $rules = [
            'version' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'],
            'kind' => ['required', Rule::in(['pc', 'laptop'])],
            'department' => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x08\x0B\x0C\x0E-\x1F]/'],
            'code' => ['exclude_unless:kind,pc', Rule::requiredIf(fn (): bool => $this->isMethod('POST') && $this->input('kind') === 'pc'), 'nullable', 'string', 'max:80', 'regex:/^[A-Za-z0-9][A-Za-z0-9 _.\-]*$/'],
            'custodian' => ['exclude_unless:kind,pc', ...$text],
            'components' => ['exclude_unless:kind,pc', 'required', 'array', 'min:1', 'max:20'],
            'components.*' => ['required', 'array:name,brand,remarks'],
            'components.*.name' => ['required', 'string', 'max:80', 'not_regex:/[\x00-\x08\x0B\x0C\x0E-\x1F]/'],
            'components.*.brand' => $text,
            'components.*.remarks' => $remarks,
            'brand' => ['exclude_unless:kind,laptop', 'required', 'string', 'max:120', 'not_regex:/[\x00-\x08\x0B\x0C\x0E-\x1F]/'],
            'model' => ['exclude_unless:kind,laptop', 'required', 'string', 'max:120', 'not_regex:/[\x00-\x08\x0B\x0C\x0E-\x1F]/'],
            'specifications' => ['exclude_unless:kind,laptop', 'required', 'array:os,ram,processor,storage,gpu'],
            'specification_remarks' => ['exclude_unless:kind,laptop', 'nullable', 'array:os,ram,processor,storage,gpu'],
        ];
        foreach (['os', 'ram', 'processor', 'storage', 'gpu'] as $key) {
            $rules['specifications.'.$key] = $text;
            $rules['specification_remarks.'.$key] = $remarks;
        }

        return $rules;
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['code' => 'computer label', 'version' => 'inventory version', 'components.*.name' => 'part name'];
    }
}
