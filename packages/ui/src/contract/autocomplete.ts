export interface AutocompleteOption {
 id: string;
 label: string;
 description?: string;
 group?: string;
 detail?: string;
}
export interface AutocompleteProps {
 placeholder?: string;
 loadOptions: (query: string) => Promise<AutocompleteOption[]>;
 onSelect?: (option: AutocompleteOption) => void;
 onSearch?: (query: string) => void;
 className?: string;
 disabled?: boolean;
}
