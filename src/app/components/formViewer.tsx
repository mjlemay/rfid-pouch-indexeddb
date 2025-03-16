import React, { JSX, useState, useEffect } from "react";
import * as Form from "@radix-ui/react-form";
import { formField, pouchDoc } from "../../utils/types";
import SelectDropdown from "./selectDropdown";

interface FormViewerProps {
    children?: React.ReactNode;
    formDoc?: pouchDoc;
    inputFocusHandler?: (arg0?:boolean) => void;
    formActionHandler?: (arg0: { [key: string]: string }, arg1: (arg0:boolean) => void) => void;
    fields?: formField[]; 
}
  
export default function FormViewer(props:FormViewerProps):JSX.Element {
    const { children, formActionHandler = ()=>{}, inputFocusHandler = ()=>{}, fields, formDoc = {}} = props;
    const [ formdata, setFormData ] = useState({});
    const [ updating, setUpdating ] = useState(false);
    const templateFields:formField[] = fields || [];

    const fieldChangeHandler = (event:React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value, name } = event.target;
        const changeFormData = JSON.parse(JSON.stringify(formdata));
        changeFormData[`${name}`] = value;
        setFormData(changeFormData);
        return false;
    }

    const selectHandler = (value:string, name:string) => {
        const changeFormData = JSON.parse(JSON.stringify(formdata));
        console.log(name, value);
        changeFormData[`${name}`] = value;
        setFormData(changeFormData);
    }

    const fieldValue = (key:string) => {
        const keyTyped = key as keyof typeof formdata;
        const value = formdata[keyTyped];
        return value ||'';
    }

    const inputField = (fieldItem:formField) => {
        const { condition, name, inputType, fieldType, caption, tailwind } = fieldItem;
        let element;
        switch(fieldType) {
            case 'textarea':
                element = <textarea 
                    name={name}
                    rows={4}
                    value={fieldValue(name)}
                    onBlur={() => inputFocusHandler(true)}
                    onFocus={() => inputFocusHandler(false)}
                    onChange={(event) => fieldChangeHandler(event)}
                    className={`block w-full bg-neutral-800 border border-neutral-600 text-neutral-100 text-xl rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 ${tailwind}`}
                    />;
                break;
            case 'select':
                element = <SelectDropdown
                    options={fieldItem.options || []}
                    value={fieldValue(name)}
                    label={name}
                    onValueChange={(selectValue:string) => selectHandler(selectValue, name)}
                />;
                break;
            case 'header':
                element = <div className="pt-6"><h2 className="text-2xl font-bold">{name}</h2><p>{caption}</p></div>;
                break;
            case 'input':
            default:
                element = <input 
                    name={name}
                    value={fieldValue(name)}
                    onBlur={() => inputFocusHandler(true)}
                    onFocus={() => inputFocusHandler(false)}
                    onChange={(event) => fieldChangeHandler(event)}
                    className={`bg-neutral-800 border border-neutral-600 text-neutral-100 text-xl rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-fit p-2.5 ${tailwind}`}
                    type={inputType}
                    />;
                break;
        }
        if (fieldType === 'header'){
            return shouldDisplay(condition) && <div key={`header_${name}`}>{element}</div>;
        } else {
            return (
                <Form.Field 
                    className={shouldDisplay(condition) ? `pt-4 flex flex-row justify-items-start content-center gap-4` : `hidden`}
                    name={name}
                    key={`field_${name}`}
                >
                    <div
                        className="self-center w-40 min-w-36"
                        style={{
                            display: `${inputType === 'hidden' ? 'none' : 'flex'}`,
                            alignItems: "baseline",
                            justifyContent: "space-between",
                        }}
                    >
                        <Form.Label className="text-xl font-bold">{name}</Form.Label>
                    </div>
                    <div className={`self-center ${fieldType === 'textarea' && 'grow'}`}>
                        <Form.Control asChild className="text-black text-lg">
                            {element}
                        </Form.Control>
                    </div>
                    {caption && (<div className="self-center text-sm font-thin max-w-80">
                        {caption && (<Form.Message>{caption}</Form.Message>)}
                    </div>
                    )}
                </Form.Field>
            )
        }
    }

    const shouldDisplay = (condition:formField['condition']) => {
        if (condition) {
            const { field, value } = condition;
            if (field && value) {
                const fieldTyped = field as keyof typeof formdata;
                return formdata[fieldTyped] === value;
            }
        }
        return true;
    }

    const submitForm = (event:React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        setUpdating(true);
        if (formActionHandler) {
            const payload = formdata || {};
            formActionHandler(payload, setUpdating);
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
            <Form.Root className="FormRoot">
            {templateFields.map((fieldItem:formField) => {
                return inputField(fieldItem)
            })}
                <div className="p-4 w-full flex justify-center">
                    <Form.Submit asChild>
                        <button 
                        disabled={updating}
                        className={`bg-neutral-500 border ${updating && 'opacity-50'} border-neutral-600 text-neutral-100 text-xl rounded-lg block w-80 p-2.5`}
                        onClick={(event:React.MouseEvent<HTMLButtonElement, MouseEvent>)=>submitForm(event)}>Update</button>
                    </Form.Submit>
                </div>
            </Form.Root>
            {children}
        </div>
    )
}