import React, { JSX, useState, useEffect, useRef } from "react";
import * as Form from "@radix-ui/react-form";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { formField, formValues, pouchDoc } from "../../utils/types";

interface FormViewerProps {
    children?: React.ReactNode;
    formDoc?: pouchDoc;
    inputFocusHandler?: (arg0?:boolean) => void;
    formActionHandler?: (arg0: formValues, arg1: (arg0:boolean) => void) => void;
    onValuesChange?: (values: formValues) => void;
    errors?: { [key: string]: string };
    fields?: formField[];
}
  
export default function FormViewer(props:FormViewerProps):JSX.Element {
    const { children, formActionHandler = ()=>{}, inputFocusHandler = ()=>{}, onValuesChange, errors = {}, fields, formDoc = {}} = props;
    const [ formdata, setFormData ] = useState<formValues>(formDoc || {});
    const [ updating, setUpdating ] = useState(false);
    const templateFields:formField[] = fields || [];
    // Keys the user has changed since the last saved revision. A document
    // update with the same revision (new template fields, a re-emission) keeps
    // these; a new revision means a save happened and everything resets.
    const dirtyKeys = useRef(new Set<string>());
    const lastRevision = useRef((formDoc as { _rev?: string } | undefined)?._rev);

    const fieldChangeHandler = (event:React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = event.target;
        const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value;
        const changeFormData = { ...formdata, [target.name]: value };
        dirtyKeys.current.add(target.name);
        setFormData(changeFormData);
        onValuesChange?.(changeFormData);
        return false;
    }

    const storedValue = (key:string) => {
        const value = (formDoc as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : '';
    }

    const fieldValue = (key:string) => {
        const value = formdata[key];
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        return '';
    }

    const inputField = (fieldItem:formField) => {
        const { name, label, inputType, fieldType, caption, tailwind } = fieldItem;
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
                    className={`block w-full bg-raised border border-line text-text text-xl rounded-lg focus:ring-accent focus:border-accent p-2.5 ${tailwind}`}
                    />;
                break;
            case 'select':
                // Uncontrolled on purpose. On macOS the native popup is a separate
                // window, and if React rewrites a controlled select while it is open,
                // Chrome discards the pick. The key remounts it only when the stored
                // value or option list changes, such as after a save. No focus reporting either, so
                // opening the popup does not re-render the page.
                // The default comes from the document, not form state, because the
                // select can remount in the same render that changed the document,
                // one effect before form state catches up. A user edit still wins.
                element = <select
                    key={`${name}_${storedValue(name)}_${(fieldItem.options || []).map((option) => option.value).join('|')}`}
                    name={name}
                    defaultValue={dirtyKeys.current.has(name) ? fieldValue(name) : storedValue(name)}
                    onChange={(event) => fieldChangeHandler(event)}
                    className={`appearance-none bg-raised border border-line text-text text-xl rounded-lg focus:ring-accent focus:border-accent block w-full p-2.5 pr-12 ${tailwind}`}
                    >
                    {(fieldItem.options || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.name}</option>
                    ))}
                </select>;
                break;
            case 'boolean':
                element = <input
                    name={name}
                    type="checkbox"
                    checked={Boolean(formdata[name])}
                    onChange={(event) => fieldChangeHandler(event)}
                    className="h-6 w-6 accent-control self-center"
                    />;
                break;
            case 'number':
                element = <input
                    name={name}
                    type="number"
                    step="any"
                    value={fieldValue(name)}
                    onBlur={() => inputFocusHandler(true)}
                    onFocus={() => inputFocusHandler(false)}
                    onChange={(event) => fieldChangeHandler(event)}
                    className={`bg-raised border border-line text-text text-xl rounded-lg focus:ring-accent focus:border-accent block w-60 p-2.5 ${tailwind}`}
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
                    className={`bg-raised border border-line text-text text-xl rounded-lg focus:ring-accent focus:border-accent block w-60 p-2.5 ${tailwind}`}
                    type={inputType}
                    />;
                break;
        }
        if (fieldType === 'header'){
            return <div key={`header_${name}`}>{element}</div>;
        } else {
            return (
                <Form.Field 
                    className="pt-4 flex flex-row justify-items-start content-center gap-4"
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
                        <Form.Label className="text-xl font-bold">{label ?? name}</Form.Label>
                    </div>
                    <div className={`self-center ${fieldType === 'textarea' ? 'grow' : ''}`}>
                        {fieldType === 'select' ? (
                            <div className="relative w-60">
                                <Form.Control asChild className="text-lg">
                                    {element}
                                </Form.Control>
                                <ChevronDownIcon
                                    aria-hidden="true"
                                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-7 w-7 text-text"
                                />
                            </div>
                        ) : (
                            <Form.Control asChild className="text-lg">
                                {element}
                            </Form.Control>
                        )}
                        {errors[name] && (<p className="text-sm pt-1 text-accent">{errors[name]}</p>)}
                    </div>
                    {caption && (<div className="self-center text-sm font-thin max-w-80">
                        {caption && (<Form.Message>{caption}</Form.Message>)}
                    </div>
                    )}
                </Form.Field>
            )
        }
    }

    const submitForm = (event:React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        setUpdating(true);
        if (formActionHandler) {
            const payload = formdata;
            formActionHandler(payload, setUpdating);
        }
        return false;
    }

    useEffect(()=>{
        if (!formDoc) return;
        const revision = (formDoc as { _rev?: string })._rev;
        if (revision !== lastRevision.current) {
            lastRevision.current = revision;
            dirtyKeys.current.clear();
            setFormData(formDoc);
            return;
        }
        setFormData((previous) => {
            const next: formValues = { ...formDoc };
            for (const key of dirtyKeys.current) {
                if (key in previous) next[key] = previous[key];
            }
            return next;
        });
    },[formDoc])

    return (
        <div className="">
            <Form.Root className="FormRoot">
            {templateFields.map((fieldItem:formField) => {
                return inputField(fieldItem)
            })}
                <div className="py-4">
                    <Form.Submit asChild>
                        <button 
                        disabled={updating}
                        className={`bg-control border ${updating ? 'opacity-50' : ''} border-line text-control-text text-xl rounded-lg block w-80 p-2.5`}
                        onClick={(event:React.MouseEvent<HTMLButtonElement, MouseEvent>)=>submitForm(event)}>Update</button>
                    </Form.Submit>
                </div>
            </Form.Root>
            {children}
        </div>
    )
}