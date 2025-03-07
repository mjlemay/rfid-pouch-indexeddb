
export type formFieldOptions = {
    name: string;
    label: string;
    options?: formFieldOptions[];
}

export type formFieldSelectOption = {
    name: string;
    value: string;
}


export type formField = {
    name: string;
    inputType: string;
    fieldType: string;
    caption?: string;
    tailwind?: string;
    options?: formFieldSelectOption[];
}

export type pouchDoc = PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;

export type pouchDocItem = pouchDoc  & {
    [key: string]: string | number | null;
}