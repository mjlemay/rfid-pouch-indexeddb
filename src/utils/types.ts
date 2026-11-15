
export type formField = {
    name: string;
    inputType: string;
    fieldType: string;
    caption?: string;
    tailwind?: string;
}

export type pouchDoc = PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;

export type pouchDocItem = pouchDoc  & {
    [key: string]: string | number | null;
}