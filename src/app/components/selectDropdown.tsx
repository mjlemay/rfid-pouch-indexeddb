import * as React from "react";
import * as Select from "@radix-ui/react-select";
import {

    ChevronDownIcon,
    ChevronUpIcon,
} from "@radix-ui/react-icons";

interface SelectItemProps {
    children: React.ReactNode | string | null;
    className?: string;
    groupLabel?: string;
    value?: string | null;
    disabled?: boolean;
    onValueChange?: () => void;
    [key: string]: unknown;
}

interface SelectDropdownProps {
    label?: string;
    value?: string;
    tailwind?: string;
    onValueChange?: (arg1:string, arg2:string) => void;
    options?: Record<string, string>[];
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
    ({ children = null, value = null, ...props }, forwardedRef) => {
        return (
            <Select.Item
                value={value as string}
                {...props}
                ref={forwardedRef}
            >
                <Select.ItemText>{children as React.ReactNode}</Select.ItemText>

            </Select.Item>
        );
    },
);
SelectItem.displayName = "SelectItem";

const SelectDropdown = ({ label = 'Options', onValueChange = () => {}, value, options = [], tailwind, }: SelectDropdownProps) => {

    const selectedLabel = options.find(option => option.value === value)?.name;
    
    return (
        <Select.Root
            onValueChange={(value) => onValueChange(value, label)}
        >
		    <Select.Trigger
                className={`inline-flex items-center content-center text-center justify-between bg-neutral-800 border border-neutral-600 text-neutral-100 text-xl rounded-lg focus:ring-blue-500 focus:border-blue-500 block min-w-[230px] p-2.5 ${tailwind}`}
            >
            <Select.Value placeholder={selectedLabel || "Select"} />
                <Select.Icon>
                    <ChevronDownIcon />
                </Select.Icon>
            </Select.Trigger>
                <Select.Portal>
                    <Select.Content
                        className={`bg-neutral-800 border border-neutral-600 focus:ring-neutral-600 focus:border-neutral-600 text-neutral-100 text-xl rounded-lg block min-w-[230px] p-2.5`}
                    >
                        <Select.ScrollUpButton>
                            <ChevronUpIcon />
                        </Select.ScrollUpButton>
                        <Select.Viewport className="flex">
                        <Select.Group>
                            {options.map(option => (
                                <SelectItem key={option.name} value={option.value} className={`flex min-w-[230px] indent-8 rounded-lg hover:bg-neutral-600 min-w-[230px] p-2.5`}>
                                    {option.name}
                                </SelectItem>
                            ))}
                        </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex h-[25px] cursor-default items-center justify-center">
					    <ChevronDownIcon />
                    </Select.ScrollDownButton>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
};

export default SelectDropdown;