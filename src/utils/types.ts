export type formFieldOptions = {
    name: string;
    label: string;
}

export type formField = {
    name: string;
    inputType: string;
    fieldType: string;
    caption?: string;
    tailwind?: string;
    options?: formFieldOptions[];
}

export type pouchDoc = PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;