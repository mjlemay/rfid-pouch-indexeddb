
export type formFieldOption = {
    name: string;
    value: string;
}

export type formField = {
    name: string;
    label?: string;
    inputType: string;
    fieldType: string;
    caption?: string;
    tailwind?: string;
    options?: formFieldOption[];
}

export type formValues = { [key: string]: unknown };

export type pouchDoc = PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;

export type pouchDocItem = pouchDoc  & {
    [key: string]: string | number | null;
}