
export type formFieldOption = {
    name: string;
    value: string;
}

export type formField = {
    name: string;
    inputType: string;
    fieldType: string;
    caption?: string;
    tailwind?: string;
    options?: formFieldOption[];
}

export type pouchDoc = PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;

export type pouchDocItem = pouchDoc  & {
    [key: string]: string | number | null;
}