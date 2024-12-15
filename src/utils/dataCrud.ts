import PouchDB from 'pouchdb';
import find from 'pouchdb-find';

PouchDB.plugin(find);

type itemRecord = {
    _id: string;
    _rev?: string;
    type:string;
    date?: string;
}

type scanRecord = {
    _id?: string;
    _rev?: string;
    rfid: string;
    type:string;
    date: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pouch:any = new PouchDB('myDB');

export const updateItem = async (puId:string, payload:object) => {
    try {
        const doc = await pouch.get(puId);
        const record:itemRecord = {
            _id: puId,
            type: 'item',
            ...payload
          }
        if (doc._rev) {
            record._rev = doc._rev;
        }
        return pouch.put(record);
    } catch (err) {
        console.log(err);
    }
}

export const logScan = async (puId:string) => {
    try {
        const record:scanRecord = {
            type: 'scan',
            rfid: puId,
            date: new Date().toString(),
          }
        return pouch.post(record);
    } catch (err) {
        console.log(err);
    }
}

export const getDocsByType = async (type:string) => {
    try {
        return pouch.find({
            selector: {type: {$eq: type}}
        });
    } catch (err) {
        console.log(err);
    }
}