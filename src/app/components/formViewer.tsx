import React, { JSX, useState, useEffect } from "react";
import * as Form from "@radix-ui/react-form";
import { formField } from "../../utils/types";

interface FormViewerProps {
    children?: React.ReactNode;
    formDoc?: PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;
    formActionHandler?: (arg0: { [key: string]: string }) => void;
    fields?: formField[]; 
}
  
export default function FormViewer(props:FormViewerProps):JSX.Element {
    const { children, formActionHandler, fields, formDoc = {}} = props;
    const [ formdata, setFormData ] = useState({});
    const templateFields:formField[] = fields || [];

    const fieldChangeHandler = (event:React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value, name } = event.target;
        const changeFormData = JSON.parse(JSON.stringify(formdata));
        changeFormData[`${name}`] = value;
        setFormData(changeFormData);
        return false;
    }

    const fieldValue = (key:string) => {
        const keyTyped = key as keyof typeof formdata;
        const value = formdata[keyTyped];
        return value ||'';
    }

    const inputField = (fieldItem:formField) => {
        const { name, inputType, fieldType, caption } = fieldItem;
        let element = <></>;
        switch(fieldType) {
            case 'textarea':
                element = <textarea name={name} value={fieldValue(name)} onChange={(event) => fieldChangeHandler(event)} className="textArea" />;
                break;
            case 'input':
            default:
                element = <input name={name} value={fieldValue(name)} onChange={(event) => fieldChangeHandler(event)} className="Input" type={inputType} />;
                break;
        }
        return (
            <Form.Field className="FormField" name={name} key={`field_${name}`}>
                <div
                    style={{
                        display: `${inputType === 'hidden' ? 'none' : 'flex'}`,
                        alignItems: "baseline",
                        justifyContent: "space-between",
                    }}
                >
                    <Form.Label className="FormLabel">{name}</Form.Label>
                </div>
                <Form.Control asChild className="text-black">
                    {element}
                </Form.Control>
                {caption && (<Form.Message>{caption}</Form.Message>)}
            </Form.Field>
        )
    }

    const submitForm = (event:React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (formActionHandler) {
            const payload = formdata || {};
            formActionHandler(payload);
        }
        return false;
    }

    useEffect(()=>{
        if (formDoc) {
            setFormData(formDoc);
        }
    },[formDoc])

    return (
        <div className="">
        <div className=""></div>
        <Form.Root className="FormRoot">
        {templateFields.map((fieldItem:formField) => {
            return inputField(fieldItem)
        })}
            <Form.Submit asChild>
                <button onClick={(event:React.MouseEvent<HTMLButtonElement, MouseEvent>)=>submitForm(event)}>Update</button>
            </Form.Submit>
        </Form.Root>
        {children}
        </div>
    )
}