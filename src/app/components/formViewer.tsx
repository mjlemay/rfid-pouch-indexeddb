import React, { JSX, useState, useEffect } from "react";
import * as Form from "@radix-ui/react-form";

interface FormViewerProps {
    children?: React.ReactNode;
    docId?: string;
    formSchema?: {[key:string]:string};
    formActionHandler?: (arg0: string, arg1: object) => void;
}

type formFieldOptions = {
    name: string;
}

type formField ={
    name: string;
    inputType: string;
    fieldType: string;
    options?: formFieldOptions[];
}
  
export default function FormViewer(props:FormViewerProps):JSX.Element {
    const { children, docId = '', formActionHandler, formSchema = {}} = props;
    const [ formdata, setFormData ] = useState({});
    const templateFields:formField[] = [{name: "notes", inputType: "text", fieldType: "textarea" }];

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
        const { name, inputType, fieldType } = fieldItem;
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
            </Form.Field>
        )
    }

    const submitForm = (event:React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (formActionHandler) {
            const payload = formdata || {};
            formActionHandler(docId, payload);
        }
        return false;
    }

    useEffect(()=>{
        if (formSchema) {
            setFormData(formSchema);
        }
    },[formSchema])

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