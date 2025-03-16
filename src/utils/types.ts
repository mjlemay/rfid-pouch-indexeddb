
export type formFieldOptions = {
    name: string;
    label: string;
    options?: formFieldOptions[];
}

export type formFieldSelectOption = {
    name: string;
    value: string;
}

type formFieldCondition = {
    field: string;
    value: string;
}

export type formField = {
    name: string;
    inputType: string;
    fieldType: string;
    caption?: string;
    tailwind?: string;
    options?: formFieldSelectOption[];
    condition?: formFieldCondition;
}

export type pouchDoc = PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;

export type pouchDocItem = pouchDoc  & {
    [key: string]: string | number | null;
}