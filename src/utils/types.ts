export type formFieldOptions = {
    name: string;
    label: string;
}

export type formField = {
    name: string;
    inputType: string;
    fieldType: string;
    options?: formFieldOptions[];
}