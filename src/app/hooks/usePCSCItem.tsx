// import { NFC } from 'nfc-pcsc';
import { useState } from "react";

type CardObj = {
    type: string;
    standard: string;
    uid?: string;
    data?: Buffer 
}

export function usePCSCItem(enabled:boolean) {

    const [ card, setCard ] = useState<CardObj | null>(null);

    // const nfc = new NFC(); // optionally you can pass logger

    // if (enabled) {
    // // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // nfc.on('reader', (reader:any) => {

    //     console.log(`${reader.reader.name}  device attached`);

    //     // enable when you want to auto-process ISO 14443-4 tags (standard=TAG_ISO_14443_4)
    //     // when an ISO 14443-4 is detected, SELECT FILE command with the AID is issued
    //     // the response is available as card.data in the card event
    //     // see examples/basic.js line 17 for more info
    //     // reader.aid = 'F222222222';

    //     reader.on('card', (cardObj:CardObj) => {

    //         // card is object containing following data
    //         // [always] String type: TAG_ISO_14443_3 (standard nfc tags like MIFARE) or TAG_ISO_14443_4 (Android HCE and others)
    //         // [always] String standard: same as type
    //         // [only TAG_ISO_14443_3] String uid: tag uid
    //         // [only TAG_ISO_14443_4] Buffer data: raw data from select APDU response

    //         console.log(`${reader.reader.name}  card detected`, cardObj);
    //         setCard(cardObj);
    //     });

    //     reader.on('card.off', (cardObj:CardObj) => {
    //         console.log(`${reader.reader.name}  card removed`, cardObj);
    //         setCard(null);
    //     });

    //     reader.on('error', (err: Error) => {
    //         console.log(`${reader.reader.name}  an error occurred`, err);
    //         setCard(null);
    //     });

    //     reader.on('end', () => {
    //         console.log(`${reader.reader.name}  device removed`);
    //         setCard(null);
    //     });

    // });

    // nfc.on('error', (err: Error) => {
    //     console.log('an nfc error occurred', err);
    //     setCard(null);
    // });
    // }

    return card;
}